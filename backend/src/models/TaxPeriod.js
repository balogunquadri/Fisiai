const mongoose = require('mongoose');

const taxPeriodSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    periodType: {
      type: String,
      enum: ['month', 'quarter', 'year'],
      required: true,
      default: 'month',
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalTaxable: {
      type: Number,
      default: 0,
    },
    taxDue: {
      type: Number,
      default: 0,
    },
    taxPaid: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

taxPeriodSchema.index({ merchantId: 1, periodType: 1, startDate: 1 }, { unique: true });

module.exports = mongoose.model('TaxPeriod', taxPeriodSchema);
