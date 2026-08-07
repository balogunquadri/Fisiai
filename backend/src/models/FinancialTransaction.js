const mongoose = require('mongoose');

const financialTransactionSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['whatsapp', 'telegram'],
      default: 'whatsapp',
      index: true,
    },
    messageId: {
      type: String,
      trim: true,
      index: true,
    },
    chatId: {
      type: String,
      trim: true,
      index: true,
    },
    senderPhone: {
      type: String,
      trim: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
      index: true,
    },
    transactionType: {
      type: String,
      enum: ['income', 'expense', 'transfer', 'tax', 'adjustment'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      trim: true,
      default: 'NGN',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
    vendor: {
      type: String,
      trim: true,
    },
    customer: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    taxable: {
      type: Boolean,
      default: false,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

financialTransactionSchema.index(
  { merchantId: 1, messageId: 1, source: 1, transactionType: 1, amount: 1, date: 1 },
  { unique: true, sparse: true }
);

financialTransactionSchema.index({ merchantId: 1, date: -1 });
financialTransactionSchema.index({ merchantId: 1, transactionType: 1, category: 1 });

module.exports = mongoose.model('FinancialTransaction', financialTransactionSchema);
