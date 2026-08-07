const mongoose = require('mongoose');

const cashBalanceSnapshotSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    netChange: {
      type: Number,
      default: 0,
    },
    transactionCount: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      enum: ['whatsapp', 'telegram', 'system'],
      default: 'system',
    },
    notes: {
      type: String,
      trim: true,
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

module.exports = mongoose.model('CashBalanceSnapshot', cashBalanceSnapshotSchema);
