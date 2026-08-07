const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const contactSchema = new mongoose.Schema(
  {
    contactId: {
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
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ['API', 'Import', 'Manual', 'Lead', 'Other', 'whatsapp_chat', 'telegram_chat'],
      required: [true, 'Source is required'],
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Prospect'],
      default: 'Active',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // ============================================
    // SALES PIPELINE FIELDS (new)
    // ============================================
    interactionCount: {
      type: Number,
      default: 0,
      // Number of times contacted/interacted
      // Used for lead scoring and engagement tracking
    },
    lastContactDate: {
      type: Date,
      // Last time this contact was reached out to
    },
    nextFollowUpDate: {
      type: Date,
      // Scheduled follow-up date for sales pipeline
    },
    birthday: {
      type: Date,
      // Customer's birthday for alerts
    },
    conversionValue: {
      type: Number,
      default: 0,
      min: 0,
      // Revenue generated from this contact (if converted)
    },
    leadScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      // Lead quality score (0-100)
      // Prioritize high-value leads for follow-up
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for merchant and source tracking
contactSchema.index({ merchantId: 1, source: 1 });
// Index for sales pipeline queries
contactSchema.index({ merchantId: 1, leadScore: -1 });
contactSchema.index({ merchantId: 1, nextFollowUpDate: 1 });

module.exports = mongoose.model('Contact', contactSchema);
