const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const chatHistorySchema = new mongoose.Schema(
  {
    chatHistoryId: {
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
    senderPhone: {
      type: String,
      required: true,
      trim: true,
    },
    chatId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    chatUsername: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ['whatsapp', 'telegram'],
      default: 'whatsapp',
      index: true,
    },
    messageBody: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'document', 'voice'],
      default: 'text',
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed', 'pending'],
      default: 'pending',
    },
    aiExtractedData: {
      inventoryUpdates: [
        {
          name: String,
          quantity_change: Number,
        },
      ],
      extractedContacts: [
        {
          name: String,
          phone: String,
          email: String,
          role: String,
        },
      ],
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
