/**
 * Trend Analytics Service
 * Aggregates market trends from merchant messages and inventory data
 * Identifies: top-selling products, price patterns, demand forecast
 */

const Trend = require('../models/Trend');
const Merchant = require('../models/Merchant');
const Inventory = require('../models/Inventory');
const ChatHistory = require('../models/ChatHistory');

/**
 * Calculate trends for a specific market (state + category)
 * Called after batch processing or on-demand for dashboard
 */
async function calculateMarketTrends(state, category) {
  try {
    console.log(`📊 Calculating trends for ${state} - ${category}...`);

    // Find all merchants in this market
    const merchants = await Merchant.find({ state, category, isActive: true });

    if (!merchants.length) {
      console.warn(`⚠ No active merchants found for ${state} - ${category}`);
      return null;
    }

    const merchantIds = merchants.map(m => m._id);

    // Get chat messages from last 7 days with AI extraction data
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const chatRecords = await ChatHistory.find({
      merchantId: { $in: merchantIds },
      direction: 'inbound',
      createdAt: { $gte: sixDaysAgo },
      'aiExtractedData.inventoryUpdates': { $exists: true, $ne: [] },
    });

    // Aggregate item statistics
    const itemStats = {};
    const priceStats = {};

    for (const chat of chatRecords) {
      if (chat.aiExtractedData?.inventoryUpdates) {
        chat.aiExtractedData.inventoryUpdates.forEach(update => {
          if (!itemStats[update.name]) {
            itemStats[update.name] = {
              item: update.name,
              totalQuantityChange: 0,
              mentions: 0,
              merchants: new Set(),
              maxChange: 0,
            };
          }
          itemStats[update.name].totalQuantityChange += update.quantity_change;
          itemStats[update.name].mentions += 1;
          itemStats[update.name].merchants.add(chat.merchantId.toString());
          itemStats[update.name].maxChange = Math.max(
            itemStats[update.name].maxChange,
            Math.abs(update.quantity_change)
          );
        });
      }
    }

    // Get current prices for these items from inventory
    const inventory = await Inventory.find({
      merchantId: { $in: merchantIds },
      status: 'Active',
    }).select('productName price cost unit');

    inventory.forEach(item => {
      const normalizedName = item.productName.toLowerCase().trim();
      if (!priceStats[normalizedName]) {
        priceStats[normalizedName] = { prices: [], costs: [], units: new Set() };
      }
      priceStats[normalizedName].prices.push(item.price);
      if (item.cost) priceStats[normalizedName].costs.push(item.cost);
      if (item.unit) priceStats[normalizedName].units.add(item.unit);
    });

    // Transform to trending items with insights
    const trendingItems = Object.values(itemStats)
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10)
      .map(item => {
        const itemNameLower = item.item.toLowerCase().trim();
        const prices = priceStats[itemNameLower]?.prices || [];
        const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b) / prices.length : 0;
        const units = priceStats[itemNameLower]?.units || new Set();

        return {
          item: item.item,
          quantity: Math.round(item.totalQuantityChange / item.mentions),
          growthPercentage: (item.mentions / chatRecords.length) * 100,
          reason: interpretTrend(item.totalQuantityChange, item.mentions),
          merchants: Array.from(item.merchants),
          averagePrice: Math.round(avgPrice * 100) / 100,
          unit: units.size > 0 ? Array.from(units)[0] : 'unit',
        };
      });

    // Calculate overall market insights
    const demandOutlook = calculateDemandOutlook(
      Object.values(itemStats),
      chatRecords.length
    );

    // Generate marketing tips
    const marketingTip = generateMarketingTip(state, category, trendingItems);

    // Calculate confidence
    const sampleSize = merchants.length;
    const confidence = Math.min(100, Math.round((sampleSize / 10) * (chatRecords.length / 50) * 100));

    // Upsert trend record
    const weekNumber = getISOWeek(new Date());
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const trend = await Trend.findOneAndUpdate(
      {
        state,
        category,
        weekNumber,
        month,
        year,
      },
      {
        state,
        category,
        trendingItems,
        marketingTip,
        demandOutlook,
        sampleSize,
        confidence,
        weekNumber,
        month,
        year,
        status: confidence > 60 ? 'Active' : 'Emerging',
        updatedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      }
    );

    console.log(
      `✓ Trend calculated: ${trendingItems.length} items, confidence: ${confidence}%, sample: ${sampleSize} merchants`
    );
    return trend;
  } catch (error) {
    console.error('Error calculating trends:', error.message);
    throw error;
  }
}

/**
 * Get trending items for a specific location/state
 * Used by dashboard for displaying market insights
 */
async function getTrendsByLocation(state, category = null, limit = 5) {
  try {
    const query = { state, status: { $in: ['Active', 'Emerging'] } };
    if (category) query.category = category;

    const trends = await Trend.find(query)
      .sort({ updatedAt: -1, confidence: -1 })
      .limit(1)
      .select('trendingItems marketingTip demandOutlook confidence state category');

    return trends[0] || null;
  } catch (error) {
    console.error('Error fetching trends:', error.message);
    throw error;
  }
}

/**
 * Get trending items across all merchants (no location filter)
 * Global market view
 */
async function getGlobalTrends(category = null, limit = 10) {
  try {
    const query = { status: { $in: ['Active', 'Emerging'] } };
    if (category) query.category = category;

    const trends = await Trend.find(query)
      .sort({ confidence: -1, updatedAt: -1 })
      .select('state category trendingItems demandOutlook confidence')
      .limit(limit);

    return trends;
  } catch (error) {
    console.error('Error fetching global trends:', error.message);
    throw error;
  }
}

/**
 * Helper: Interpret trend direction
 */
function interpretTrend(totalChange, mentions) {
  if (totalChange > 0) {
    return `Rising demand (avg +${Math.round(totalChange / mentions)} units/transaction)`;
  } else if (totalChange < 0) {
    return `High sales volume (avg ${Math.round(totalChange / mentions)} units sold)`;
  }
  return 'Stable demand';
}

/**
 * Helper: Determine overall demand outlook
 */
function calculateDemandOutlook(itemStats, totalMentions) {
  const avgChange = Object.values(itemStats).reduce((sum, item) => sum + item.totalQuantityChange, 0) / Math.max(1, Object.keys(itemStats).length);

  if (avgChange > 10) return 'Rising';
  if (avgChange < -10) return 'Declining';
  return 'Stable';
}

/**
 * Helper: Generate contextual marketing tips
 */
function generateMarketingTip(state, category, trendingItems) {
  const season = getCurrentSeason();
  const topItem = trendingItems[0]?.item || 'products';

  const tips = {
    'Provision Store': {
      Rising: `Stock up on ${topItem} during ${season}. Demand is increasing!`,
      Stable: `Maintain balanced inventory of trending items like ${topItem}.`,
      Declining: `Clear ${topItem} inventory gradually. Focus on seasonal items instead.`,
    },
    'Tailoring': {
      Rising: `${season} is peak season! Advertise tailoring services on WhatsApp.`,
      Stable: `Bundle services to attract more customers during slow periods.`,
      Declining: `Launch discount campaigns. Focus on bridal/formal wear.`,
    },
    Electronics: {
      Rising: `Launch new tech bundles featuring ${topItem}. Demand is strong!`,
      Stable: `Maintain competitive pricing on popular items.`,
      Declining: `Offer trade-in programs for old ${topItem}.`,
    },
  };

  const categoryTips = tips[category] || tips['Provision Store'];
  return categoryTips['Rising'] || 'Optimize inventory based on customer demand.';
}

/**
 * Helper: Get current season (Nigerian context)
 */
function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 11 || month <= 2) return 'festive season';
  if (month >= 3 && month <= 5) return 'dry season';
  if (month >= 6 && month <= 10) return 'rainy season';
  return 'current season';
}

/**
 * Helper: Get ISO week number
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = {
  calculateMarketTrends,
  getTrendsByLocation,
  getGlobalTrends,
};
