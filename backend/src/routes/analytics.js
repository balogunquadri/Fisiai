/**
 * Analytics Routes
 * Market trends, demand forecasts, and business intelligence
 * GET /api/analytics/trends - Historical trends for location/category
 * GET /api/analytics/forecast - AI-powered demand forecast
 * GET /api/analytics/insights/:merchantId - Combined trends + forecast
 * GET /api/analytics/comparison - Actual vs Predicted trends
 */

const express = require('express');
const router = express.Router();
const Merchant = require('../models/Merchant');
const Inventory = require('../models/Inventory');
const Trend = require('../models/Trend');
const trendService = require('../services/trendService');
const demandPredictionService = require('../services/demandPredictionService');

/**
 * GET /api/analytics/trends
 * Get historical market trends for a location/category
 * Query params: state (required), category (optional)
 */
router.get('/trends', async (req, res) => {
  try {
    const { state, category, limit = 10 } = req.query;

    if (!state) {
      return res.status(400).json({ error: 'State is required' });
    }

    console.log(`📊 Fetching trends for ${state}${category ? ` - ${category}` : ''}...`);

    // Get trends from trendService
    const trends = await trendService.getTrendsByLocation(state, category || null, parseInt(limit));

    if (!trends) {
      return res.status(404).json({
        error: 'No trends found for this location',
        message: 'Trends are calculated daily from merchant activity. Check back later.',
      });
    }

    console.log(`✓ Retrieved trends: ${trends.trendingItems?.length || 0} items`);

    return res.json({
      success: true,
      trend: {
        location: state,
        category: category || 'All',
        period: 'Last 7 days',
        generatedAt: trends.updatedAt,
        confidence: trends.confidence,
        sampleSize: trends.sampleSize,
        data: {
          trendingItems: trends.trendingItems?.slice(0, parseInt(limit)) || [],
          marketingTip: trends.marketingTip,
          demandOutlook: trends.demandOutlook,
          status: trends.status,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

/**
 * GET /api/analytics/forecast
 * Get AI-powered demand forecast
 * Query params: location (required), merchantId (optional), force (optional)
 */
router.get('/forecast', async (req, res) => {
  try {
    const { location, merchantId, force } = req.query;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    console.log(`🔮 Fetching forecast for ${location}...`);

    let forecast = null;
    let cached = false;

    // Check for recent cached forecast (unless force=true)
    if (force !== 'true') {
      forecast = await demandPredictionService.getLatestForecast(location);
      
      if (forecast) {
        // Check if less than 1 hour old
        const hourAgo = Date.now() - 3600000;
        if (forecast.forecastGeneratedAt.getTime() > hourAgo) {
          cached = true;
          console.log('📦 Returning cached forecast');
        } else {
          forecast = null; // Refresh if older than 1 hour
        }
      }
    }

    // Generate fresh forecast if needed
    if (!forecast) {
      console.log('🧠 Generating fresh forecast...');

      if (!merchantId) {
        return res.status(400).json({
          error: 'MerchantId is required to generate fresh forecast',
          hint: 'Use ?force=true&merchantId=... to regenerate',
        });
      }

      const merchant = await Merchant.findById(merchantId);
      if (!merchant) {
        return res.status(404).json({ error: 'Merchant not found' });
      }

      const inventory = await Inventory.find({ merchantId, status: 'Active' })
        .select('productName quantity price unit');

      if (inventory.length === 0) {
        return res.status(400).json({
          error: 'No inventory found',
          message: 'Add inventory items first to generate forecast',
        });
      }

      forecast = await demandPredictionService.generateLocationDemandForecast(
        location,
        inventory,
        merchantId
      );

      cached = false;
    }

    console.log(`✓ Forecast ready: ${forecast.trending_items?.length || 0} predictions`);

    return res.json({
      success: true,
      forecast: {
        location: forecast.location,
        period: 'Next 7 days',
        generatedAt: forecast.forecastGeneratedAt || new Date(),
        cached,
        confidence: forecast.confidence,
        data: {
          trendingItems: forecast.trending_items || [],
          marketingTip: forecast.marketingTip,
          riskItems: forecast.riskItems || [],
        },
      },
    });
  } catch (error) {
    console.error('Error fetching forecast:', error);
    return res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

/**
 * GET /api/analytics/insights/:merchantId
 * Combined view: Historical trends + AI forecast
 * Shows both what happened and what will happen
 */
router.get('/insights/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log(`🎯 Generating combined insights for merchant ${merchantId}...`);

    // Get merchant to determine location/category
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    if (!merchant.location || !merchant.state || !merchant.category) {
      return res.status(400).json({
        error: 'Incomplete merchant profile',
        message: 'Add location, state, and category to generate insights',
      });
    }

    // Fetch in parallel
    const [historicalTrends, inventory, forecast] = await Promise.all([
      trendService.getTrendsByLocation(merchant.state, merchant.category),
      Inventory.find({ merchantId, status: 'Active' }).select('productName quantity price'),
      demandPredictionService.getLatestForecast(merchant.location),
    ]);

    // Cross-reference: which items trended last week AND are predicted to trend
    const historicalItems = new Set(
      (historicalTrends?.trendingItems || []).map(t => t.item.toLowerCase())
    );
    const forecastItems = (forecast?.trending_items || []).map(f => f.item.toLowerCase());
    const confirmedItems = forecastItems.filter(item => historicalItems.has(item));

    // Calculate inventory coverage for predicted items
    const inventoryMap = new Map(
      inventory.map(i => [i.productName.toLowerCase(), i])
    );
    const coverageAnalysis = (forecast?.trending_items || []).map(item => {
      const inv = inventoryMap.get(item.item.toLowerCase());
      return {
        item: item.item,
        predicted: item.growthPercentage,
        currentStock: inv?.quantity || 0,
        stockStatus:
          !inv || inv.quantity === 0
            ? 'out-of-stock'
            : inv.quantity < 5
            ? 'critical'
            : inv.quantity < 20
            ? 'low'
            : 'adequate',
      };
    });

    console.log(`✓ Insights generated: ${confirmedItems.length} confirmed items, ${coverageAnalysis.length} inventory gaps`);

    return res.json({
      success: true,
      merchant: {
        name: merchant.name,
        location: merchant.location,
        category: merchant.category,
      },
      whatHappened: {
        period: 'Last 7 days',
        confidence: historicalTrends?.confidence || 0,
        items: (historicalTrends?.trendingItems || []).slice(0, 5),
        insight: historicalTrends?.marketingTip || 'Insufficient data',
        outlook: historicalTrends?.demandOutlook || 'Stable',
      },
      whatWillHappen: {
        period: 'Next 7 days',
        confidence: forecast?.confidence || 0,
        items: (forecast?.trending_items || []).slice(0, 5),
        risks: (forecast?.riskItems || []).slice(0, 3),
        insight: forecast?.marketingTip || 'Unable to forecast',
      },
      analysis: {
        confirmedTrends: confirmedItems,
        inventoryCoverage: coverageAnalysis,
        actionItems: generateActionItems(forecast, inventoryMap),
      },
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return res.status(500).json({ error: 'Failed to generate insights' });
  }
});

/**
 * GET /api/analytics/comparison
 * Compare actual trends vs AI predictions (accuracy check)
 * Query params: state (required), category (required)
 */
router.get('/comparison', async (req, res) => {
  try {
    const { state, category } = req.query;

    if (!state || !category) {
      return res.status(400).json({ error: 'State and category are required' });
    }

    console.log(`📈 Comparing forecast accuracy for ${state} - ${category}...`);

    const comparison = await demandPredictionService.compareForcastVsActual(state, category);

    return res.json({
      success: true,
      comparison: {
        predicted: comparison.forecast || [],
        actual: comparison.actual || [],
        accuracy: comparison.accuracy,
        correctPredictions: comparison.correctPredictions,
        insight:
          comparison.accuracy >= 80
            ? '🎯 High accuracy - Gemini predictions are reliable for this market'
            : comparison.accuracy >= 60
            ? '⚠️ Moderate accuracy - Consider market volatility'
            : '❌ Low accuracy - Market conditions may be changing',
      },
    });
  } catch (error) {
    console.error('Error comparing forecast vs actual:', error);
    return res.status(500).json({ error: 'Failed to compare forecast data' });
  }
});

/**
 * Helper: Generate actionable recommendations
 */
function generateActionItems(forecast, inventoryMap) {
  const actions = [];

  if (!forecast || !forecast.trending_items) return actions;

  forecast.trending_items.forEach(item => {
    const inv = inventoryMap.get(item.item.toLowerCase());

    if (!inv || inv.quantity === 0) {
      actions.push({
        priority: 'critical',
        action: `Urgent: ${item.item} is predicted to trend (+${item.growthPercentage}%) but you're out of stock`,
        recommendation: 'Restock immediately to capture demand',
      });
    } else if (inv.quantity < item.recommendedStock) {
      actions.push({
        priority: 'high',
        action: `${item.item} will be in high demand. Current stock: ${inv.quantity}, Recommended: ${item.recommendedStock}`,
        recommendation: `Increase stock by ${item.recommendedStock - inv.quantity} units`,
      });
    }
  });

  forecast.riskItems?.forEach(risk => {
    actions.push({
      priority: 'medium',
      action: `Risk: ${risk.item} - ${risk.risk}`,
      recommendation: risk.mitigation,
    });
  });

  return actions.slice(0, 5); // Top 5 actions
}

module.exports = router;
