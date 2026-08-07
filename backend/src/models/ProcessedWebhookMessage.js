const mongoose = require('mongoose');

const processedWebhookMessageSchema = new mongoose.Schema(
  {
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      required: true,
      default: 'whatsapp',
    },
    receivedFrom: {
      type: String,
      trim: true,
    },
    businessPhone: {
      type: String,
      trim: true,
      index: true,
    },
    payloadHash: {
      type: String,
      trim: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

processedWebhookMessageSchema.index(
  { merchantId: 1, messageId: 1, source: 1 },
  { unique: true }
);

module.exports = mongoose.model('ProcessedWebhookMessage', processedWebhookMessageSchema);
