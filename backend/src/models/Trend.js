const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const trendSchema = new mongoose.Schema(
  {
    trendId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    // GEOGRAPHIC TARGETING
    state: {
      type: String,
      required: [true, 'State is required for trend aggregation'],
      index: true,
      // e.g., "Lagos", "Ibadan", "Abuja"
    },
    location: {
      type: String,
      // e.g., "Bodija Market, Ibadan"
      // More granular than state for hyper-local insights
    },
    // CATEGORY & INDUSTRY
    category: {
      type: String,
      required: [true, 'Category is required'],
      index: true,
      // e.g., "Provision Store", "Tailoring", "Electronics"
    },
    // TRENDING ITEMS DATA
    trendingItems: [
      {
        item: {
          type: String,
          // Product name, e.g., "Rice", "Palm Oil"
        },
        quantity: {
          type: Number,
          // Average quantity mentioned in messages
        },
        growthPercentage: {
          type: Number,
          // Growth rate vs. previous week/month (%)
          // Positive = increasing demand, Negative = declining
        },
        reason: {
          type: String,
          // Human-readable reason for trend
          // e.g., "Rainy season increase", "Ramadan preparation", "Festival demand"
        },
        merchants: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Merchant',
            // Which merchants are tracking this item
          },
        ],
        averagePrice: {
          type: Number,
          // Average price reported by merchants
        },
        priceChange: {
          type: Number,
          // Price change from previous period (%)
        },
      },
    ],
    // INSIGHTS & RECOMMENDATIONS
    marketingTip: {
      type: String,
      // AI-generated marketing insight
      // e.g., "Stock up on rice for Ramadan", "Reduce inventory before monsoon"
    },
    demandOutlook: {
      type: String,
      enum: ['Rising', 'Stable', 'Declining'],
      default: 'Stable',
      // Overall demand direction
    },
    competitorPrice: {
      type: Number,
      // Average competitor price in this market
    },
    recommendedAction: {
      type: String,
      // Action merchants should take
      // e.g., "Increase stock", "Reduce price", "Clear inventory"
    },
    // TIME & AGGREGATION
    weekNumber: {
      type: Number,
      // ISO week number for seasonal analysis
    },
    month: {
      type: Number,
      // Month (1-12) for seasonal patterns
    },
    year: {
      type: Number,
      // Year for multi-year trend analysis
    },
    // QUALITY METRICS
    sampleSize: {
      type: Number,
      default: 0,
      // Number of merchants/messages aggregated
      // Higher = more reliable trend
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
      // Confidence score (0-100)
      // Based on sample size and data consistency
    },
    // TRACKING
    status: {
      type: String,
      enum: ['Active', 'Emerging', 'Declining', 'Archive'],
      default: 'Active',
      index: true,
      // Active = currently relevant, Emerging = new trend, Declining = fading out
    },
    updatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// INDEXES FOR EFFICIENT QUERIES
// Find trends for a specific market
trendSchema.index({ state: 1, category: 1, updatedAt: -1 });
// Find hyper-local trends
trendSchema.index({ location: 1, updatedAt: -1 });
// Track trend evolution over time
trendSchema.index({ category: 1, month: 1, year: 1 });
// Find high-confidence trends
trendSchema.index({ confidence: -1, updatedAt: -1 });
// Find emerging opportunities
trendSchema.index({ demandOutlook: 1, status: 1 });

/**
 * Static method to aggregate trends from inventory updates
 * Called by cron job or after batch of Gemini extractions
 */
trendSchema.statics.aggregateTrends = async function (state, category, timeframe = 'week') {
  const Merchant = require('./Merchant');
  const Inventory = require('./Inventory');
  const ChatHistory = require('./ChatHistory');

  // Find merchants in this market
  const merchants = await Merchant.find({ state, category });
  if (!merchants.length) return null;

  const merchantIds = merchants.map(m => m._id);

  // Aggregate inventory updates from chat history
  const chatRecords = await ChatHistory.find({
    merchantId: { $in: merchantIds },
    direction: 'inbound',
    createdAt: {
      $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    },
  });

  // Count item mentions and aggregate data
  const itemStats = {};
  chatRecords.forEach(chat => {
    if (chat.aiExtractedData?.inventoryUpdates) {
      chat.aiExtractedData.inventoryUpdates.forEach(update => {
        if (!itemStats[update.name]) {
          itemStats[update.name] = {
            item: update.name,
            quantity: 0,
            mentions: 0,
            merchants: new Set(),
          };
        }
        itemStats[update.name].quantity += update.quantity_change;
        itemStats[update.name].mentions += 1;
        itemStats[update.name].merchants.add(chat.merchantId.toString());
      });
    }
  });

  // Calculate growth percentages and create trending items
  const trendingItems = Object.values(itemStats)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10) // Top 10 items
    .map(item => ({
      item: item.item,
      quantity: Math.round(item.quantity / item.mentions),
      growthPercentage: (item.mentions / chatRecords.length) * 100,
      reason: 'Based on merchant messages and activity',
      merchants: Array.from(item.merchants).map(id => new mongoose.Types.ObjectId(id)),
    }));

  return {
    trendingItems,
    sampleSize: merchants.length,
    confidence: Math.min(100, merchants.length * 10),
  };
};

module.exports = mongoose.model('Trend', trendSchema);
