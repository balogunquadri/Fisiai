const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const activityLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      index: true,
      enum: [
        'CREATE',
        'UPDATE',
        'DELETE',
        'API_CALL',
        'AI_PROCESSING',
        'MESSAGE_PROCESSING_ERROR',
        'WEBHOOK_RECEIVED',
        'WEBHOOK_PROCESS',
        'JOB_FAILURE',
        'MEDIA_PROCESS',
        'MESSAGE_SEND',
        'MESSAGE_RECEIVE',
        'AUTH',
        'LOGIN',
        'LOGOUT',
        'OTHER',
      ],
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      index: true,
      enum: [
        'System',
        'Message',
        'ChatHistory',
        'Merchant',
        'Inventory',
        'Contact',
        'Webhook',
        'WebhookWorker',
        'JobFailure',
        'ProcessedWebhookMessage',
        'ActivityLog',
        'Other',
      ],
    },
    entityId: {
      type: String,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Success', 'Failure', 'Pending'],
      default: 'Success',
      index: true,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient audit trail queries
activityLogSchema.index({ merchantId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
