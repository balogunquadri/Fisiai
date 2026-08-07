/**
 * Demand Prediction Service
 * Uses Gemini AI to forecast inventory restocking needs based on:
 * - Current inventory levels
 * - Location context (geo-targeting)
 * - Seasonal patterns & local events
 * - Weather forecasts (regional context)
 *
 * Complements trendService.js which analyzes PAST trends
 * This service PREDICTS future demand
 */

const { GoogleGenAI } = require('@google/genai');
const Trend = require('../models/Trend');
const Merchant = require('../models/Merchant');
const ActivityLog = require('../models/ActivityLog');

// Initialize Gemini AI
let ai = null;
try {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY not configured in environment');
  }
  ai = new GoogleGenAI({ apiKey: geminiApiKey });
  console.log('✓ Demand Prediction Service initialized');
} catch (err) {
  console.error('✗ Failed to initialize Demand Prediction Service:', err.message);
}

/**
 * Generate AI-powered demand forecast for a location
 * Considers: current inventory, seasonal patterns, weather, events
 *
 * @param {String} location - Location name (e.g., "Bodija Market, Ibadan")
 * @param {Array} currentInventory - Array of inventory documents
 * @param {ObjectId} merchantId - Optional merchant ID for activity logging
 * @returns {Object} Forecast with trending items, marketing tips, risk analysis
 */
async function generateLocationDemandForecast(location, currentInventory, merchantId = null) {
  try {
    if (!ai) {
      throw new Error('Gemini AI not initialized for demand prediction');
    }

    console.log(`\n🔮 Generating demand forecast for ${location}...`);

    // Validate and format inventory data
    if (!Array.isArray(currentInventory) || currentInventory.length === 0) {
      console.warn(`⚠ No inventory data provided for ${location}`);
      return {
        location,
        trending_items: [],
        marketingTip: 'Unable to generate forecast. Please add inventory items first.',
        riskItems: [],
        confidence: 0,
      };
    }

    const inventoryJson = currentInventory.map(inv => ({
      name: inv.productName || inv.name || 'Unknown',
      quantity: inv.quantity || 0,
      price: inv.price || 0,
      unit: inv.unit || 'pieces',
      status: inv.status || 'Active',
      lastRestocked: inv.lastRestocked ? inv.lastRestocked.toISOString().split('T')[0] : 'Never',
    }));

    console.log(`📦 Analyzing ${inventoryJson.length} inventory items...`);

    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are an expert inventory planning advisor for African informal retail shops.
Analyze the provided inventory and predict what items will experience high demand in the next 7 days.

IMPORTANT FACTORS TO CONSIDER:
1. Seasonal patterns (festivals, holidays, weather cycles)
2. Local market dynamics (location demographics, buying patterns)
3. Current stock levels (low stock = risk of stock-outs and lost sales)
4. Typical customer behavior for this time of year
5. Upcoming Nigerian holidays and events
6. Regional weather impacts (rainy/dry season)

RESPONSE REQUIREMENTS:
- Return ONLY valid JSON. NO markdown, NO code blocks, NO explanations outside JSON.
- Each trending_item should have actionable insights.
- Confidence score reflects prediction reliability (0-100).
- Risk items are things that could go out of stock.

REQUIRED JSON STRUCTURE (exactly):
{
  "location": "string",
  "trending_items": [
    {
      "item": "string (product name)",
      "growthPercentage": number (0-100, predicted growth vs now),
      "reason": "string (why demand will increase)",
      "recommendedStock": number (suggested qty to have in next 7 days),
      "marketingAction": "string (promotional idea)"
    }
  ],
  "marketingTip": "string (one actionable tip for this location/time)",
  "riskItems": [
    {
      "item": "string",
      "risk": "string (what could go wrong)",
      "mitigation": "string (how to prevent it)"
    }
  ],
  "confidence": number (0-100, how confident in this forecast)
}`;

    const prompt = `Analyze this inventory for a shop in ${location}:

${JSON.stringify(inventoryJson, null, 2)}

Based on the current season, location, and inventory levels, predict what items will have high demand in the next 7 days.
Consider seasonal demand, local events, weather patterns, and customer buying behavior specific to ${location}.

Provide:
1. Top 5-10 items expected to trend
2. Growth percentage for each
3. Recommended stock levels
4. Marketing actions
5. Risk items that might go out of stock
6. Overall confidence in this forecast`;

    console.log(`🧠 Calling Gemini to analyze demand patterns...`);

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.7, // Some creativity but mostly factual
      },
    });

    let forecastData = null;

    try {
      const responseText = response.text();
      console.log(`📝 Parsing Gemini response...`);
      forecastData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('✗ Failed to parse Gemini JSON response:', parseErr.message);
      console.error('Raw response was:', response.text().substring(0, 500));

      // Fallback to safe structure
      forecastData = {
        location,
        trending_items: [],
        marketingTip: 'Unable to parse forecast. Please check inventory data format.',
        riskItems: [],
        confidence: 0,
      };
    }

    // Validate response structure
    if (!forecastData.location) forecastData.location = location;
    if (!Array.isArray(forecastData.trending_items)) forecastData.trending_items = [];
    if (!Array.isArray(forecastData.riskItems)) forecastData.riskItems = [];
    if (!forecastData.marketingTip) forecastData.marketingTip = 'Keep inventory balanced based on sales trends.';
    if (typeof forecastData.confidence !== 'number' || forecastData.confidence < 0 || forecastData.confidence > 100) {
      forecastData.confidence = 50;
    }

    console.log(`✓ Forecast generated: ${forecastData.trending_items.length} trending items, ${forecastData.riskItems.length} risk items`);

    // Store forecast in database with expiration logic
    try {
      const state = extractState(location);
      const weekNumber = getISOWeek(new Date());
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();

      const forecast = await Trend.findOneAndUpdate(
        {
          location,
          state,
          status: 'Forecast',
          weekNumber,
        },
        {
          location,
          state,
          status: 'Forecast',
          trendingItems: forecastData.trending_items || [],
          marketingTip: forecastData.marketingTip,
          riskItems: forecastData.riskItems || [],
          confidence: forecastData.confidence || 50,
          demandOutlook: forecastData.trending_items.length > 0 ? 'Rising' : 'Stable',
          weekNumber,
          month,
          year,
          forecastGeneratedAt: new Date(),
          updatedAt: new Date(),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      console.log(`💾 Forecast stored in database`);

      // Log activity
      if (merchantId) {
        await ActivityLog.create({
          merchantId,
          action: 'DEMAND_FORECAST_GENERATED',
          entityType: 'Inventory',
          details: {
            location,
            itemsForecasted: forecastData.trending_items?.length || 0,
            riskItems: forecastData.riskItems?.length || 0,
            confidence: forecastData.confidence,
          },
          status: 'Success',
        }).catch(e => console.error('Error logging activity:', e.message));
      }

      console.log(`✅ Forecast complete: ${forecastData.trending_items.length} items, confidence: ${forecastData.confidence}%\n`);

      return forecastData;
    } catch (dbErr) {
      console.error('Error storing forecast in database:', dbErr.message);
      // Still return forecast even if storage fails
      return forecastData;
    }
  } catch (error) {
    console.error('✗ Error generating demand forecast:', error.message);

    // Log error
    if (merchantId) {
      await ActivityLog.create({
        action: 'DEMAND_FORECAST_FAILED',
        entityType: 'Inventory',
        entityId: merchantId,
        details: { location, error: error.message },
        status: 'Failure',
        error: error.message,
      }).catch(e => console.error('Error logging activity:', e.message));
    }

    // Return safe fallback
    return {
      location,
      trending_items: [],
      marketingTip: 'Unable to generate forecast. Please try again later.',
      riskItems: [],
      confidence: 0,
    };
  }
}

/**
 * Get all active forecasts for a merchant's state/location
 * Used by dashboard to display predictions
 *
 * @param {String} state - State name (e.g., "Lagos")
 * @param {String} location - Optional specific location
 * @returns {Array} Array of forecast documents
 */
async function getForecastsByLocation(state, location = null) {
  try {
    console.log(`📍 Fetching forecasts for ${state}${location ? ' - ' + location : ''}...`);

    const query = {
      state,
      status: 'Forecast',
      weekNumber: getISOWeek(new Date()), // Current week only
    };

    if (location) {
      query.location = location;
    }

    const forecasts = await Trend.find(query)
      .sort({ forecastGeneratedAt: -1 })
      .limit(10)
      .select('location state trendingItems marketingTip riskItems confidence forecastGeneratedAt');

    console.log(`✓ Retrieved ${forecasts.length} forecasts`);
    return forecasts;
  } catch (error) {
    console.error('Error fetching forecasts:', error.message);
    return [];
  }
}

/**
 * Get latest forecast for a specific location
 *
 * @param {String} location - Location name
 * @returns {Object} Latest forecast or null
 */
async function getLatestForecast(location) {
  try {
    const forecast = await Trend.findOne({
      location,
      status: 'Forecast',
    })
      .sort({ forecastGeneratedAt: -1 })
      .select('location trendingItems marketingTip riskItems confidence forecastGeneratedAt');

    return forecast || null;
  } catch (error) {
    console.error('Error fetching latest forecast:', error.message);
    return null;
  }
}

/**
 * Compare actual trends vs predicted trends
 * Helps improve forecast accuracy over time
 *
 * @param {String} state - State name
 * @param {String} category - Category name
 * @returns {Object} Comparison of predictions vs actual
 */
async function compareForcastVsActual(state, category) {
  try {
    console.log(`📊 Comparing forecast vs actual for ${state} - ${category}...`);

    const weekNumber = getISOWeek(new Date());

    // Get forecast from this week
    const forecast = await Trend.findOne({
      state,
      category,
      status: 'Forecast',
      weekNumber,
    });

    // Get actual trend from this week
    const actual = await Trend.findOne({
      state,
      category,
      status: 'Active',
      weekNumber,
    });

    if (!forecast || !actual) {
      console.warn('⚠ Incomplete data for comparison');
      return {
        forecast: forecast ? forecast.trendingItems : [],
        actual: actual ? actual.trendingItems : [],
        accuracy: 0,
      };
    }

    // Calculate accuracy (items that were predicted AND trended)
    const predictedItems = new Set(forecast.trendingItems.map(t => t.item.toLowerCase()));
    const actualItems = actual.trendingItems.map(t => t.item.toLowerCase());
    const correctPredictions = actualItems.filter(item => predictedItems.has(item)).length;
    const accuracy = (correctPredictions / Math.max(1, actualItems.length)) * 100;

    console.log(`✓ Comparison complete: ${accuracy.toFixed(1)}% accuracy`);

    return {
      forecast: forecast.trendingItems,
      actual: actual.trendingItems,
      correctPredictions,
      accuracy: Math.round(accuracy),
    };
  } catch (error) {
    console.error('Error comparing forecast vs actual:', error.message);
    return { accuracy: 0 };
  }
}

/**
 * Helper: Extract state from location string
 * Maps common location names to states
 *
 * @param {String} location - Location name
 * @returns {String} State name
 */
function extractState(location) {
  if (!location) return 'Unknown';

  const stateMap = {
    Lagos: 'Lagos',
    Lekki: 'Lagos',
    Victoria: 'Lagos',
    'Island': 'Lagos',
    Ibadan: 'Oyo',
    Bodija: 'Oyo',
    Abeokuta: 'Ogun',
    Abuja: 'FCT',
    Kano: 'Kano',
    Enugu: 'Enugu',
    'Port Harcourt': 'Rivers',
    Calabar: 'Cross River',
    Benin: 'Edo',
    Oshogbo: 'Osun',
  };

  for (const [key, state] of Object.entries(stateMap)) {
    if (location.toLowerCase().includes(key.toLowerCase())) {
      return state;
    }
  }

  return 'Unknown';
}

/**
 * Helper: Get ISO week number for date
 * Used for weekly aggregation
 *
 * @param {Date} date - Date to get week for
 * @returns {Number} ISO week number
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = {
  generateLocationDemandForecast,
  getForecastsByLocation,
  getLatestForecast,
  compareForcastVsActual,
};
