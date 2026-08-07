const mongoose = require('mongoose');

const customerBroadcastEventSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: 'Customer Broadcast',
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Broadcast message is required'],
      trim: true,
    },
    customerIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Contact',
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Prospect', 'Any'],
      default: 'Any',
    },
    scheduledAt: {
      type: Date,
      default: () => new Date(),
    },
    recurrence: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'monthly'],
      default: 'none',
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastRunAt: {
      type: Date,
    },
    nextRunAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

customerBroadcastEventSchema.index({ merchantId: 1, active: 1, nextRunAt: 1 });

module.exports = mongoose.model('CustomerBroadcastEvent', customerBroadcastEventSchema);
