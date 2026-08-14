const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const merchantSchema = new mongoose.Schema(
  {
    merchantId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Merchant name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      // Simpler, permissive email validation to accept common addresses (including +)
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    emailVerificationToken: {
      type: String,
      index: true,
      select: false,
    },
    emailVerificationTokenExpires: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
      index: true,
      select: false,
    },
    resetPasswordTokenExpires: {
      type: Date,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
    },
    whatsappPhoneNumberId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    whatsappBusinessPhone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    whatsappBusinessName: {
      type: String,
      trim: true,
    },
    telegramBotUsername: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    telegramChatId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    telegramEnabled: {
      type: Boolean,
      default: false,
    },
    // Automatic forwarding settings
    forwardEnabled: {
      type: Boolean,
      default: false,
    },
    forwardTelegramChatId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    forwardWhatsAppPhone: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    defaultCurrency: {
      type: String,
      trim: true,
      default: 'NGN',
    },
    defaultTaxRate: {
      type: Number,
      default: 0,
    },
    taxJurisdiction: {
      type: String,
      trim: true,
      default: 'Local',
    },
    preferredExpenseCategories: {
      type: [String],
      default: ['Supplies', 'Transport', 'Rent', 'Utilities', 'Staff'],
    },
    passwordHash: {
      type: String,
      trim: true,
      select: false,
    },
    businessType: {
      type: String,
      enum: ['Retail', 'E-Commerce', 'Service', 'Consulting', 'Other'],
      default: 'Other',
    },
    // ============================================
    // LOCALIZATION FIELDS (new)
    // ============================================
    location: {
      type: String,
      trim: true,
      // e.g., "Bodija Market, Ibadan"
      // Used for: localized trends, geo-targeting, competitive analysis
    },
    category: {
      type: String,
      trim: true,
      index: true,
      // e.g., "Provision Store", "Tailoring", "Electronics"
      // Used for: industry-specific trends, benchmarking
    },
    state: {
      type: String,
      trim: true,
      index: true,
      // e.g., "Lagos", "Ibadan", "Abuja"
      // Used for: state-level trend aggregation, regional insights
    },
    apiKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    subscriptionTier: {
      type: String,
      enum: ['Free', 'Pro', 'Enterprise'],
      default: 'Free',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Business appearance and receipt preferences
    businessAddress: {
      type: String,
      trim: true,
      default: '',
    },
    receiptColor: {
      type: String,
      trim: true,
      default: '#14b8a6',
    },
    // Friendly color name for UX (e.g., 'teal', 'emerald')
    receiptColorName: {
      type: String,
      trim: true,
      default: 'teal',
    },
    // Public URL to merchant logo (served from /docs)
    logoUrl: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index for localized trend queries
merchantSchema.index({ state: 1, category: 1 });
merchantSchema.index({ location: 1, category: 1 });

module.exports = mongoose.model('Merchant', merchantSchema);
