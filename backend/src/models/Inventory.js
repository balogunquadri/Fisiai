const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const inventorySchema = new mongoose.Schema(
  {
    inventoryId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    cost: {
      type: Number,
      min: [0, 'Cost cannot be negative'],
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Discontinued'],
      default: 'Active',
      index: true,
    },
    lastRestocked: {
      type: Date,
    },
    // ============================================
    // UNIT & AI EXTRACTION FIELDS (new)
    // ============================================
    unit: {
      type: String,
      trim: true,
      // e.g., "bags", "crates", "liters", "pieces", "cartons"
      // Critical for informal retail where units vary
    },
    aiExtraction: {
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        // AI extraction confidence score (0-100)
        // Used to assess AI accuracy over time
      },
      extractedFrom: {
        type: String,
        enum: ['text', 'image', 'audio', 'video', 'manual'],
        // Source of data extraction
        // Helps track which media types are most reliable
      },
      lastExtractedAt: {
        type: Date,
        // When this item was last mentioned in AI extraction
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient merchantId + productName queries (used in upserts)
inventorySchema.index({ merchantId: 1, productName: 1 });
// Index for inventory status and category queries
inventorySchema.index({ merchantId: 1, status: 1, category: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
