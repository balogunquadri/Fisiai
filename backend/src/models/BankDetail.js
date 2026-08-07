const mongoose = require('mongoose');

const bankDetailSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
    },
    accountName: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true,
      index: true,
    },
    accountType: {
      type: String,
      trim: true,
      default: 'Current',
    },
    branch: {
      type: String,
      trim: true,
      default: '',
    },
    currency: {
      type: String,
      trim: true,
      default: 'NGN',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

bankDetailSchema.index({ merchantId: 1, accountNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('BankDetail', bankDetailSchema);
