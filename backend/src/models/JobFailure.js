const mongoose = require('mongoose');

/**
 * Job Failure Log
 * Tracks failed webhook processing jobs, retry attempts, and error details
 * Supports dead-letter queue analysis and error pattern detection
 */
const jobFailureSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      index: true,
      required: true,
    },
    jobType: {
      type: String,
      enum: ['webhook-process', 'media-process'],
      index: true,
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      index: true,
    },
    messageId: {
      type: String,
      index: true,
    },
    senderPhone: {
      type: String,
      index: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'document', 'voice', 'location', 'contact'],
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    error: {
      message: String,
      Fisi: String,
      code: String,
    },
    failureReason: {
      type: String,
      enum: [
        'ai_processing_error',
        'database_error',
        'whatsapp_send_failed',
        'merchant_not_found',
        'media_download_failed',
        'timeout',
        'queue_full',
        'unknown',
      ],
      index: true,
    },
    originalJobData: mongoose.Schema.Types.Mixed,
    retryable: {
      type: Boolean,
      default: true,
    },
    deadLettered: {
      type: Boolean,
      default: false,
      index: true,
    },
    deadLetterReason: String,
    resolvedAt: Date,
    resolvedBy: String, // 'manual_retry', 'auto_retry', 'abandoned'
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
jobFailureSchema.index({ merchantId: 1, createdAt: -1 });
jobFailureSchema.index({ jobType: 1, deadLettered: 1, createdAt: -1 });
jobFailureSchema.index({ failureReason: 1, deadLettered: 1 });
jobFailureSchema.index({ createdAt: -1 });

module.exports = mongoose.model('JobFailure', jobFailureSchema);
