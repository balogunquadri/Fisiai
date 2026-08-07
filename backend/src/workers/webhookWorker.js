const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { connectDB } = require('../db');
const { webhookQueue } = require('../services/queue');
const WhatsAppService = require('../services/WhatsAppService');
const { processMerchantMessage } = require('../services/aiAgentService');
const ActivityLog = require('../models/ActivityLog');
const FailureTrackingService = require('../services/failureTrackingService');

/**
 * Determine failure reason from error
 */
function determineFailureReason(error) {
  if (!error) return 'unknown';
  const msg = error.message?.toLowerCase() || '';
  if (msg.includes('ai') || msg.includes('gemini')) return 'ai_processing_error';
  if (msg.includes('database') || msg.includes('mongodb')) return 'database_error';
  if (msg.includes('whatsapp') || msg.includes('send')) return 'whatsapp_send_failed';
  if (msg.includes('merchant not found')) return 'merchant_not_found';
  if (msg.includes('media') || msg.includes('download')) return 'media_download_failed';
  if (msg.includes('timeout')) return 'timeout';
  return 'unknown';
}

webhookQueue.process('process-webhook-message', async (job) => {
  const { merchant, messageData } = job.data;
  const fromPhone = messageData.from || messageData.phone || 'unknown';
  const merchantId = merchant?._id || null;

  try {
    console.log(`[Worker] Processing webhook job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);

    await WhatsAppService.logIncomingMessage(messageData, merchantId);
    await WhatsAppService.markMessageAsRead(messageData.messageId);
    await processMerchantMessage(merchant, fromPhone, messageData);

    await ActivityLog.create({
      merchantId,
      action: 'WEBHOOK_PROCESS',
      entityType: 'WebhookWorker',
      entityId: messageData.messageId,
      details: {
        from: fromPhone,
        messageType: messageData.type,
        source: messageData.source || 'whatsapp',
        jobId: job.id,
        attempts: job.attemptsMade + 1,
      },
      status: 'Success',
    });

    return { success: true, jobId: job.id };
  } catch (err) {
    const failureReason = determineFailureReason(err);
    console.error(`[Worker] Webhook job ${job.id} failed (attempt ${job.attemptsMade + 1}/${job.opts.attempts}):`, err.message);

    // Log the failure for monitoring
    await FailureTrackingService.logJobFailure(
      job.id,
      'webhook-process',
      messageData,
      err,
      {
        merchantId,
        messageId: messageData.messageId,
        senderPhone: fromPhone,
        messageType: messageData.type,
        attemptNumber: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts,
        failureReason,
        retryable: job.attemptsMade < job.opts.attempts - 1,
      }
    );

    // Log to ActivityLog as well
    try {
      await ActivityLog.create({
        merchantId,
        action: 'WEBHOOK_PROCESS',
        entityType: 'WebhookWorker',
        entityId: messageData?.messageId || 'unknown',
        details: {
          messageData: {
            from: fromPhone,
            messageType: messageData.type,
            source: messageData.source || 'whatsapp',
          },
          error: err.message,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
          failureReason,
        },
        status: 'Failure',
        error: err.message,
      });
    } catch (logErr) {
      console.warn('[Worker] Failed to log webhook failure to ActivityLog:', logErr.message);
    }

    // If this was the last attempt, move to dead-letter
    if (job.attemptsMade >= job.opts.attempts - 1) {
      await FailureTrackingService.moveToDeadLetter(
        job.id,
        `Max retries exceeded (${job.opts.attempts}): ${failureReason}`
      );
    }

    // Rethrow to trigger queue retry mechanism
    throw err;
  }
});

const startWebhookWorker = async () => {
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.error('✗ webhookWorker aborted: MongoDB connection is required.');
    process.exit(1);
  }

  console.log('Starting webhookWorker...');
};

if (require.main === module) {
  startWebhookWorker();
}
