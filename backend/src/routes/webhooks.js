const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../middleware/webhookVerification');
const WhatsAppService = require('../services/WhatsAppService');
const TelegramService = require('../services/TelegramService');
const { processMerchantMessage } = require('../services/aiAgentService');
const { webhookQueue } = require('../services/queue');
const FailureTrackingService = require('../services/failureTrackingService');

const isTwilioMode = () => process.env.USE_TWILIO === 'true';

/**
 * GET /api/webhooks/whatsapp
 * Webhook verification challenge from Meta
 * For Twilio we just return 200 OK (Twilio uses a different verification flow)
 */
router.get('/whatsapp', (req, res) => {
  try {
    const useTwilio = isTwilioMode();
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Meta verification must take precedence whenever Meta sends the verify parameters.
    if (mode === 'subscribe' && token && challenge) {
      const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

      if (!expectedToken) {
        console.error('✗ WHATSAPP_VERIFY_TOKEN not configured');
        return res.status(500).json({ error: 'Server misconfiguration' });
      }

      if (token === expectedToken) {
        console.log('✓ Webhook verified successfully');
        return res.status(200).send(challenge);
      }

      console.warn('✗ Webhook verification failed - invalid token');
      return res.status(403).json({ error: 'Verification token mismatch' });
    }

    if (useTwilio) {
      return res.status(200).send('Twilio webhook configured');
    }

    return res.status(400).json({ error: 'Missing webhook verification parameters' });
  } catch (error) {
    console.error('Error in webhook verification:', error);
    return res.status(500).json({ error: 'Verification error' });
  }
});

/**
 * GET /api/webhooks/telegram
 * Optional Telegram webhook verification endpoint
 */
router.get('/telegram', (req, res) => {
  try {
    const secret = req.header('X-Telegram-Bot-Api-Secret-Token') || req.query.secret;
    if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Invalid Telegram webhook secret' });
    }

    return res.status(200).send('Telegram webhook configured');
  } catch (error) {
    console.error('Error in Telegram webhook verification:', error);
    return res.status(500).json({ error: 'Telegram verification error' });
  }
});

/**
 * POST /api/webhooks/telegram or /api/webhooks/telegram/:secret
 * Receive incoming messages from Telegram
 */
const handleTelegramWebhook = async (req, res) => {
  try {
    const secret = req.params.secret || req.header('X-Telegram-Bot-Api-Secret-Token') || req.query.secret;
    if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('✗ Invalid Telegram webhook secret');
      return res.status(403).json({ error: 'Invalid Telegram webhook secret' });
    }

    // Handle callback_query (button presses) first — Telegram sends these without a top-level "message"
    const callbackQuery = req.body.callback_query;
    if (callbackQuery) {
      console.log(`🎯 Callback Query: ${callbackQuery.data} from ${callbackQuery.from?.id}`);
      // Build a minimal update payload so parseIncomingTelegram can extract chat/merchant info
      const pseudoPayload = { message: callbackQuery.message };
      const merchantForCallback = await TelegramService.resolveMerchantFromIncomingMessage(
        TelegramService.parseIncomingTelegram(pseudoPayload)
      );
      await TelegramService.handleCallbackQuery(callbackQuery, merchantForCallback);
      return res.status(200).json({ received: true });
    }

    const message = TelegramService.parseIncomingTelegram(req.body);
    if (!message) {
      console.log('ℹ Telegram webhook received but no message data');
      return res.status(200).json({ received: true });
    }

    console.log(`\n📨 Incoming Telegram Message`);
    console.log(`   From: ${message.from}`);
    console.log(`   Chat: ${message.chatId || '[unknown]'}`);
    console.log(`   Type: ${message.type}`);
    console.log(`   Text: ${message.text || '[non-text]'}`);

    const merchant = await TelegramService.resolveMerchantFromIncomingMessage(message);

    if (message.type === 'text' && message.text) {
      if (message.text.startsWith('/')) {
        await TelegramService.handleCommand(message, merchant);
      } else {
        await TelegramService.handleIncomingMessage(message, merchant);
      }
      return res.status(200).json({ received: true });
    }

    // callback_query already handled earlier

    const isDuplicate = await WhatsAppService.recordProcessedWebhookMessage(message, merchant?._id);
    if (isDuplicate) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    try {
      const job = await webhookQueue.add('process-webhook-message', {
        merchant,
        messageData: message,
      }, {
        priority: message.type === 'text' ? 10 : 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
      console.log(`✓ Job ${job.id} enqueued for Telegram message from ${message.from}`);
    } catch (queueErr) {
      console.error('Failed to enqueue Telegram job:', queueErr.message);
      await FailureTrackingService.logJobFailure(
        `telegram-webhook-${Date.now()}`,
        'webhook-process',
        message,
        queueErr,
        {
          merchantId: merchant?._id,
          messageId: message.messageId,
          senderPhone: message.from,
          messageType: message.type,
          failureReason: 'queue_full',
          retryable: false,
        }
      );
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing Telegram webhook:', error);
    try {
      res.status(200).json({ error: 'Processing error', received: true });
    } catch (e) {
      // ignore
    }
  }
};

router.post('/telegram', handleTelegramWebhook);
router.post('/telegram/:secret', handleTelegramWebhook);

/**
 * POST /api/webhooks/whatsapp
 * Receive incoming messages from WhatsApp (Meta) or Twilio
 */
router.post('/whatsapp', async (req, res) => {
  try {
    const useTwilio = isTwilioMode();

    // If using Meta, verify signature first
    if (!useTwilio) {
      // If signature verification middleware is synchronous it can be used here,
      // but we already have a middleware function available. Call it explicitly.
      await new Promise((resolve, reject) => {
        verifyWebhookSignature(req, res, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    let message = null;

    if (useTwilio) {
      // Twilio sends form-encoded body: From, Body, NumMedia, MediaUrl0, etc.
      message = WhatsAppService.parseIncomingTwilio(req.body);
      if (!message || message.ignore) {
        if (message?.ignore) {
          console.debug(`ℹ Twilio webhook ignored: ${message.reason}`);
        } else {
          console.log('ℹ Twilio webhook received but no message found');
          if (req.body && Object.keys(req.body).length > 0) {
            console.log('   Twilio payload keys:', Object.keys(req.body).join(', '));
          }
        }
        return res.status(200).send('OK');
      }

      console.log(`\n📨 Incoming Twilio WhatsApp Message`);
      console.log(`   From: ${message.from}`);
      console.log(`   To: ${message.to || '[unknown]'}`);
      console.log(`   Type: ${message.type}`);
      console.log(`   Text: ${message.text || '[non-text]'}`);

      const merchant = await WhatsAppService.resolveMerchantFromIncomingMessage(message);
      const isDuplicate = await WhatsAppService.recordProcessedWebhookMessage(message, merchant?._id);
      if (isDuplicate) {
        return res.status(200).send('OK');
      }

      // Enqueue message for async processing with improved config
      try {
        const job = await webhookQueue.add('process-webhook-message', {
          merchant,
          messageData: message,
        }, {
          priority: message.type === 'text' ? 10 : 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false, // Keep for failure analysis
        });
        console.log(`✓ Job ${job.id} enqueued for Twilio message from ${message.from}`);
      } catch (queueErr) {
        console.error('Failed to enqueue job:', queueErr.message);
        await FailureTrackingService.logJobFailure(
          `webhook-${Date.now()}`,
          'webhook-process',
          message,
          queueErr,
          {
            merchantId: merchant?._id,
            messageId: message.messageId,
            senderPhone: message.from,
            messageType: message.type,
            failureReason: 'queue_full',
            retryable: false,
          }
        );
      }

      // Acknowledge Twilio quickly
      return res.status(200).send('OK');
    }

    // Meta path
    const payload = req.body;

    // Check if this is an incoming message
    if (!payload.entry || !payload.entry[0].changes) {
      console.log('ℹ Received webhook but no message data');
      return res.status(200).json({ received: true });
    }

    // Parse the incoming message
    message = WhatsAppService.parseIncomingMessage(payload);

    if (!message) {
      console.log('ℹ Webhook received but no message found');
      return res.status(200).json({ received: true });
    }

    console.log(`\n📨 Incoming WhatsApp Message`);
    console.log(`   From: ${message.from}`);
    console.log(`   To: ${message.recipientPhone || '[unknown]'}`);
    console.log(`   Type: ${message.type}`);
    console.log(`   Text: ${message.text || '[non-text]'}`);

    const merchant = await WhatsAppService.resolveMerchantFromIncomingMessage(message);
    const isDuplicate = await WhatsAppService.recordProcessedWebhookMessage(message, merchant?._id);
    if (isDuplicate) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Enqueue message for async processing with improved config
    try {
      const job = await webhookQueue.add('process-webhook-message', {
        merchant,
        messageData: message,
      }, {
        priority: message.type === 'text' ? 10 : 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep for failure analysis
      });
      console.log(`✓ Job ${job.id} enqueued for Meta message from ${message.from}`);
    } catch (queueErr) {
      console.error('Failed to enqueue job:', queueErr.message);
      await FailureTrackingService.logJobFailure(
        `webhook-${Date.now()}`,
        'webhook-process',
        message,
        queueErr,
        {
          merchantId: merchant?._id,
          messageId: message.messageId,
          senderPhone: message.from,
          messageType: message.type,
          failureReason: 'queue_full',
          retryable: false,
        }
      );
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Always return 200 to avoid retries
    try {
      res.status(200).json({ error: 'Processing error', received: true });
    } catch (e) {
      // ignore
    }
  }
});

module.exports = router;
