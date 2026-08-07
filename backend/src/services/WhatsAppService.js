const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ActivityLog = require('../models/ActivityLog');
const Merchant = require('../models/Merchant');
const Inventory = require('../models/Inventory');
const Contact = require('../models/Contact');
const ProcessedWebhookMessage = require('../models/ProcessedWebhookMessage');
const TaskService = require('./taskService');
const DeliveryPartnerService = require('./deliveryPartnerService');
const batchWriteService = require('./batchWriteService');

let twilioClient = null;
try {
  if (process.env.USE_TWILIO === 'true') {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (err) {
  console.warn('Twilio SDK not available or failed to initialize:', err.message);
}

class WhatsAppService {
  constructor() {
    this.useTwilio = process.env.USE_TWILIO === 'true' && Boolean(twilioClient);

    // Meta (Graph API) settings
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v19.0';
    this.baseURL = `https://graph.facebook.com/${this.apiVersion}`;

    // Twilio settings
    if (this.useTwilio && twilioClient) {
      this.twilio = twilioClient;
      this.twilioFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+1415...
      if (!this.twilioFrom || !this.twilioFrom.startsWith('whatsapp:')) {
        console.warn('Invalid TWILIO_WHATSAPP_FROM configuration; disabling Twilio WhatsApp sender:', this.twilioFrom);
        this.useTwilio = false;
      }
    }
  }

  /**
   * Parse incoming message payload from Meta
   */
  parseIncomingMessage(payload) {
    try {
      const entry = payload.entry[0];
      const changes = entry.changes[0];
      const message = changes.value.messages?.[0];
      const contact = changes.value.contacts?.[0];
      const metadata = changes.value.metadata || {};

      if (!message) {
        return null;
      }

      const mediaAttachments = [];
      if (message.image) {
        mediaAttachments.push({ type: 'image', id: message.image.id, mime_type: message.image.mime_type || message.image.mimeType, caption: message.image.caption || null });
      }
      if (message.document) {
        mediaAttachments.push({ type: 'document', id: message.document.id, mime_type: message.document.mime_type || message.document.mimeType, filename: message.document.filename || null });
      }
      if (message.audio) {
        mediaAttachments.push({ type: 'audio', id: message.audio.id, mime_type: message.audio.mime_type || message.audio.mimeType });
      }
      if (message.voice) {
        mediaAttachments.push({ type: 'voice', id: message.voice.id, mime_type: message.voice.mime_type || message.voice.mimeType });
      }
      if (message.video) {
        mediaAttachments.push({ type: 'video', id: message.video.id, mime_type: message.video.mime_type || message.video.mimeType });
      }

      return {
        messageId: message.id,
        from: message.from,
        timestamp: parseInt(message.timestamp),
        type: message.type,
        text: message.text?.body || null,
        mediaAttachments,
        image: message.image || null,
        document: message.document || null,
        audio: message.audio || null,
        video: message.video || null,
        voice: message.voice || null,
        location: message.location || null,
        interactive: message.interactive || null,
        contact: message.contact || contact || null,
        referral: message.referral || null,
        recipientPhone: metadata.display_phone_number || null,
        recipientPhoneNumberId: metadata.phone_number_id || null,
        businessProfileName: metadata.display_phone_number || null,
        source: 'meta',
      };
    } catch (error) {
      console.error('Error parsing message:', error);
      return null;
    }
  }

  /**
   * Parse incoming message payload from Twilio (form-encoded)
   */
  parseIncomingTwilio(body) {
    try {
      if (!body) return null;

      // Normalize keys to lowercase to be resilient to form parsers
      const normalized = {};
      Object.keys(body).forEach((k) => {
        normalized[k.toLowerCase()] = body[k];
      });

      const fromRaw = normalized.from || null;
      if (!fromRaw) {
        // Debug: log keys present to help identify why From is missing
        console.debug('Twilio webhook body keys:', Object.keys(body));
        return null;
      }

      const numMedia = parseInt(normalized.nummedia || normalized['num_media'] || '0', 10);
      const rawBody = (normalized.body || normalized.text || normalized.message || '').toString().trim();
      const structuredPayload = normalized.structuredmessage || normalized.structured_message || null;
      const structuredText = this.extractStructuredMessageText(structuredPayload);
      const text = rawBody || structuredText;
      if (numMedia === 0 && !text) {
        const statusFields = [
          normalized.messagestatus,
          normalized.message_status,
          normalized.smsstatus,
          normalized.status,
          normalized.eventtype,
          normalized.event_type,
          normalized.accountsid,
        ];
        const hasStatusFields = statusFields.some((value) => value !== undefined && value !== null && value !== '');
        if (hasStatusFields) {
          return {
            ignore: true,
            reason: 'twilio_status_callback',
            status: normalized.messagestatus || normalized.message_status || normalized.smsstatus || normalized.status || null,
            messageSid: normalized.messagesid || normalized.messagesid || normalized.smssid || normalized.messagesid || null,
          };
        }

        console.debug('Twilio webhook has no text or media, ignoring payload. Keys:', Object.keys(body));
        return null;
      }

      const media = [];
      for (let i = 0; i < numMedia; i++) {
        media.push({ url: normalized[`mediaurl${i}`], contentType: normalized[`mediacontenttype${i}`] });
      }

      const messageId = normalized.messagesid || normalized.smsmessagesid || normalized.smsid || `${Date.now()}-${Math.random()}`;
      const messageType = numMedia > 0 ? 'media' : 'text';

      return {
        messageId,
        from: (fromRaw || '').toString().replace('whatsapp:', ''),
        to: (normalized.to || '').toString().replace('whatsapp:', '') || null,
        recipientPhone: (normalized.to || '').toString().replace('whatsapp:', '') || null,
        timestamp: Date.now(),
        type: messageType,
        text: text || null,
        media,
        contact: null,
        referral: null,
        businessProfileName: null,
        source: 'twilio',
      };
    } catch (error) {
      console.error('Error parsing Twilio message:', error);
      return null;
    }
  }

  extractStructuredMessageText(structuredMessage) {
    if (!structuredMessage) return null;

    let payload = structuredMessage;
    if (typeof structuredMessage === 'string') {
      try {
        payload = JSON.parse(structuredMessage);
      } catch {
        payload = structuredMessage;
      }
    }

    if (typeof payload === 'string') {
      return payload.trim() || null;
    }

    if (typeof payload !== 'object') {
      return null;
    }

    const candidates = [];
    const maybeText = (value) => typeof value === 'string' && value.trim() && value.trim();

    if (maybeText(payload.body)) candidates.push(payload.body.trim());
    if (maybeText(payload.text)) candidates.push(payload.text.trim());
    if (maybeText(payload.message)) candidates.push(payload.message.trim());
    if (maybeText(payload.caption)) candidates.push(payload.caption.trim());
    if (maybeText(payload.description)) candidates.push(payload.description.trim());

    if (Array.isArray(payload.content)) {
      payload.content.forEach((item) => {
        if (typeof item === 'string' && item.trim()) {
          candidates.push(item.trim());
        } else if (item && typeof item === 'object') {
          if (maybeText(item.text)) candidates.push(item.text.trim());
          if (maybeText(item.body)) candidates.push(item.body.trim());
        }
      });
    }

    return candidates.length > 0 ? candidates.join(' ').trim() : null;
  }

  /**
   * Log incoming message to database (BUFFERED)
   */
  normalizeWhatsAppPhoneNumber(phone) {
    if (!phone) return null;
    const normalized = phone.toString().replace(/[^\d]/g, '');
    return normalized || null;
  }

  normalizeTelegramChatId(chatId) {
    if (chatId === null || chatId === undefined) return null;
    return chatId.toString();
  }

  async resolveMerchantFromIncomingMessage(messageData) {
    const source = messageData.source || 'whatsapp';

    if (source === 'telegram') {
      const chatId = this.normalizeTelegramChatId(messageData.chatId || messageData.recipientChatId || messageData.chat_id);
      const botUsername = messageData.botUsername || process.env.TELEGRAM_BOT_USERNAME || null;

      const lookupConditions = [];
      if (chatId) lookupConditions.push({ telegramChatId: chatId });
      if (botUsername) lookupConditions.push({ telegramBotUsername: botUsername });

      let merchant = null;
      if (lookupConditions.length > 0) {
        merchant = await Merchant.findOne({ $or: lookupConditions }).lean();
      }

      if (!merchant && chatId) {
        const created = new Merchant({
          phone: `tg-${chatId}`,
          name: `Telegram Merchant ${chatId}`,
          email: `merchant-telegram-${chatId}@Fisiai.local`,
          businessType: 'Retail',
          telegramChatId: chatId,
          telegramBotUsername: botUsername,
          telegramEnabled: true,
        });
        merchant = await created.save();
        merchant = merchant.toObject();
        console.log(`✓ Created new merchant mapping for Telegram chat: ${merchant._id}`);
      }

      return merchant;
    }

    const normalizedRecipientPhone = this.normalizeWhatsAppPhoneNumber(
      messageData.recipientPhone || messageData.to
    );
    const whatsAppPhoneNumberId = messageData.recipientPhoneNumberId || null;
    const businessProfileName = messageData.businessProfileName || null;

    const lookupConditions = [];
    if (whatsAppPhoneNumberId) {
      lookupConditions.push({ whatsappPhoneNumberId: whatsAppPhoneNumberId });
    }
    if (normalizedRecipientPhone) {
      lookupConditions.push({ whatsappBusinessPhone: normalizedRecipientPhone });
      lookupConditions.push({ phone: new RegExp(`${normalizedRecipientPhone}$`) });
    }

    let merchant = null;
    if (lookupConditions.length > 0) {
      merchant = await Merchant.findOne({ $or: lookupConditions }).lean();
    }

    // If we found a merchant via lookup but it lacks canonical WhatsApp fields,
    // attach the recipient phone / phoneNumberId so merchants who signed up earlier
    // with only a `phone` can be linked automatically when a WhatsApp message
    // arrives for their business number.
    if (merchant) {
      const updates = {};
      if (normalizedRecipientPhone && (!merchant.whatsappBusinessPhone || merchant.whatsappBusinessPhone !== normalizedRecipientPhone)) {
        updates.whatsappBusinessPhone = normalizedRecipientPhone;
      }
      if (whatsAppPhoneNumberId && (!merchant.whatsappPhoneNumberId || merchant.whatsappPhoneNumberId !== whatsAppPhoneNumberId)) {
        updates.whatsappPhoneNumberId = whatsAppPhoneNumberId;
      }
      if (businessProfileName && (!merchant.whatsappBusinessName || merchant.whatsappBusinessName !== businessProfileName)) {
        updates.whatsappBusinessName = businessProfileName;
      }

      if (Object.keys(updates).length > 0) {
        try {
          await Merchant.findByIdAndUpdate(merchant._id, updates, { new: true });
          merchant = await Merchant.findById(merchant._id).lean();
          console.log(`✓ Auto-linked existing merchant ${merchant._id} to WhatsApp receiver ${normalizedRecipientPhone}`);
        } catch (err) {
          console.error('Error auto-linking merchant to WhatsApp receiver:', err.message || err);
        }
      }
    }

    if (!merchant && whatsAppPhoneNumberId) {
      merchant = await Merchant.findOne({ whatsappPhoneNumberId: whatsAppPhoneNumberId }).lean();
    }

    if (!merchant && normalizedRecipientPhone) {
      merchant = await Merchant.findOne({ whatsappBusinessPhone: normalizedRecipientPhone }).lean();
    }

    if (!merchant) {
      const phoneForRecord = normalizedRecipientPhone || messageData.to || `unknown-${Date.now()}`;
      const created = new Merchant({
        phone: phoneForRecord,
        name: `Merchant ${phoneForRecord}`,
        email: `merchant-${Date.now()}@Fisiai.local`,
        businessType: 'Retail',
        whatsappBusinessPhone: normalizedRecipientPhone,
        whatsappPhoneNumberId: whatsAppPhoneNumberId,
        whatsappBusinessName: businessProfileName,
      });
      merchant = await created.save();
      merchant = merchant.toObject();
      console.log(`✓ Created new merchant mapping for WhatsApp receiver: ${merchant._id}`);
    }

    return merchant;
  }

  async recordProcessedWebhookMessage(messageData, merchantId = null) {
    const messageId = messageData.messageId;
    const source = messageData.source || 'whatsapp';
    const businessIdentifier =
      messageData.recipientPhone ||
      messageData.to ||
      messageData.chatId ||
      messageData.recipientChatId ||
      null;

    if (!messageId) {
      throw new Error('Missing messageId for webhook deduplication');
    }

    try {
      await ProcessedWebhookMessage.create({
        merchantId: merchantId || 'unknown',
        messageId,
        source,
        receivedFrom: this.normalizeWhatsAppPhoneNumber(messageData.from) || messageData.from,
        businessPhone: this.normalizeWhatsAppPhoneNumber(businessIdentifier) || businessIdentifier,
        payloadHash: null,
      });
      console.log(`✓ Recorded webhook message: ${messageId}`);
      return false;
    } catch (err) {
      if (err.code === 11000) {
        console.log(`ℹ Duplicate webhook event ignored: ${messageId}`);
        return true;
      }
      throw err;
    }
  }

  async logIncomingMessage(messageData, merchantId = null) {
    try {
      const source = messageData.source || 'whatsapp';
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        entityId: messageData.messageId,
        details: {
          source,
          provider: messageData.provider || source,
          from: messageData.from,
          to: messageData.recipientPhone || messageData.to || messageData.chatId || messageData.recipientChatId || null,
          type: messageData.type,
          content: messageData.text || `[${messageData.type}]`,
        },
        ipAddress: source === 'telegram' ? 'telegram-webhook' : 'whatsapp-webhook',
        userAgent: source === 'telegram' ? 'Telegram Bot' : messageData.source === 'twilio' ? 'Twilio WhatsApp' : 'Meta WhatsApp Platform',
        status: 'Success',
      });

      console.log(`✓ Buffered incoming message: ${messageData.messageId}`);
      return true;
    } catch (error) {
      console.error('Error buffering message log:', error);
    }
  }

  /**
   * Send text message via WhatsApp API (Meta or Twilio)
   */
  async sendTextMessage(recipientPhone, message, merchantId = null) {
    if (this.useTwilio && this.twilio) {
      try {
        const to = `whatsapp:${recipientPhone}`;
        const resp = await this.twilio.messages.create({ from: this.twilioFrom, to, body: message });

        const messageId = resp.sid;
        const twilioStatus = resp.status || 'unknown';
        const twilioError = resp.errorMessage || null;

        batchWriteService.bufferActivityLog({
          merchantId,
          action: 'API_CALL',
          entityType: 'System',
          entityId: messageId,
          details: {
            source: 'whatsapp',
            provider: 'twilio',
            direction: 'outgoing',
            to: recipientPhone,
            type: 'text',
            content: message,
            providerStatus: twilioStatus,
            providerError: twilioError,
          },
          ipAddress: 'twilio-bot',
          status: 'Success',
        });

        console.log(`✓ Twilio message sent: ${messageId} status=${twilioStatus}${twilioError ? ` error=${twilioError}` : ''}`);
        return { success: true, messageId, status: twilioStatus, error: twilioError };
      } catch (error) {
        const errorMessage = error.message || JSON.stringify(error);
        console.error('Error sending Twilio message:', errorMessage);
        batchWriteService.bufferActivityLog({
          merchantId,
          action: 'API_CALL',
          entityType: 'System',
          details: {
            source: 'whatsapp',
            provider: 'twilio',
            direction: 'outgoing',
            to: recipientPhone,
            type: 'text',
          },
          status: 'Failure',
          error: errorMessage,
        });

        const shouldFallbackToMeta =
          errorMessage.includes('Channel with the specified From address') ||
          errorMessage.includes('From address') ||
          errorMessage.includes('not a valid WhatsApp');

        if (shouldFallbackToMeta && this.phoneNumberId && this.accessToken) {
          console.warn('Twilio failed, attempting Meta fallback for welcome message');
          return this.sendTextMessageViaMeta(recipientPhone, message, merchantId);
        }

        return { success: false, error: errorMessage };
      }
    }

    return this.sendTextMessageViaMeta(recipientPhone, message, merchantId);
  }

  async sendTextMessageViaMeta(recipientPhone, message, merchantId = null) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const messageId = response.data.messages[0].id;
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        entityId: messageId,
        details: {
          source: 'whatsapp',
          provider: 'meta',
          direction: 'outgoing',
          to: recipientPhone,
          type: 'text',
          content: message,
        },
        ipAddress: 'whatsapp-bot',
        status: 'Success',
      });

      console.log(`✓ Meta WhatsApp message sent: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      const errorData = error.response?.data || error.message;
      console.error('Error sending Meta WhatsApp message:', errorData);
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        details: {
          source: 'whatsapp',
          provider: 'meta',
          direction: 'outgoing',
          to: recipientPhone,
          type: 'text',
        },
        status: 'Failure',
        error: error.response?.data?.error?.message || error.message,
      });
      return { success: false, error: errorData };
    }
  }

  async sendWhatsAppMenu(recipientPhone, merchantId = null) {
    const title = 'FisiAI WhatsApp Main Menu';
    const options = [
      { title: 'Sales' },
      { title: 'View Inventory' },
      { title: '➕ Add Item' },
      { title: 'View Customers' },
      { title: '➕ Add Customer' },
      { title: 'Receipts' },
      { title: 'Invoices' },
      { title: 'Payments' },
      { title: 'Activity' },
      { title: 'Analytics' },
      { title: 'Settings' },
    ];

    const result = await this.sendInteractiveMessage(recipientPhone, title, options, merchantId);
    if (!result.success) {
      return this.sendTextMessage(recipientPhone, this.getBotMenuText(), merchantId);
    }
    return result;
  }

  async showWhatsAppInventory(recipientPhone, merchantId = null) {
    if (!merchantId) {
      return this.sendTextMessage(recipientPhone, '❌ No merchant linked. Use your dashboard to connect a merchant account.', null);
    }

    const items = await Inventory.find({ merchantId, status: 'Active' })
      .select('productName sku quantity price')
      .sort({ quantity: 1 })
      .limit(10)
      .lean();

    if (!items || items.length === 0) {
      return this.sendTextMessage(
        recipientPhone,
        `📦 *Inventory*\n\nNo stock items found yet. Add inventory via the dashboard or send a stock update in chat.`,
        merchantId
      );
    }

    let message = `📦 *Inventory Overview*\n\nTop stock items (most recent):\n\n`;
    items.forEach((item, index) => {
      message += `${index + 1}\. *${item.productName || 'Item'}*\n   SKU: ${item.sku || 'N/A'}\n   Qty: ${item.quantity || 0}\n   Price: ₦${item.price || 0}\n\n`;
    });
    message += `_Showing ${items.length} items_\n\nReply with *inventory* again to refresh or send stock changes like "added 20 bottles".`;

    return this.sendTextMessage(recipientPhone, message, merchantId);
  }

  async showWhatsAppAddItem(recipientPhone, merchantId = null) {
    const sample = 'T-Shirt, TSH001, 50, 299';
    return this.sendTextMessage(
      recipientPhone,
      `📦 *Add Item*\n\nSend the following in one message to add an item:\nproductName, sku, quantity, price\n\nExample:\n${sample}`,
      merchantId
    );
  }

  async showWhatsAppCustomers(recipientPhone, merchantId = null) {
    if (!merchantId) {
      return this.sendTextMessage(recipientPhone, '❌ No merchant linked. Use your dashboard to connect a merchant account.', null);
    }

    const customers = await Contact.find({ merchantId })
      .select('firstName lastName phone email company status birthday')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    if (!customers || customers.length === 0) {
      return this.sendTextMessage(
        recipientPhone,
        `👥 *Customers*\n\nNo customer records found yet. Add customer details in chat or via the dashboard, then use this command again to view leads.`,
        merchantId
      );
    }

    let message = `👥 *Customer Leads*\n\nRecent contacts:\n\n`;
    customers.forEach((customer, index) => {
      message += `${index + 1}\. *${customer.firstName || ''} ${customer.lastName || ''}*\n   Phone: ${customer.phone || 'N/A'}\n   Email: ${customer.email || 'N/A'}\n   Company: ${customer.company || 'N/A'}\n   Status: ${customer.status || 'Active'}\n\n`;
    });
    message += `_Showing ${customers.length} customers_\n\nUse *customers* to refresh or send a contact note like "John, +2348012345678, vip customer".`;

    return this.sendTextMessage(recipientPhone, message, merchantId);
  }

  async showWhatsAppAddCustomer(recipientPhone, merchantId = null) {
    const sample = 'John, Doe, +2348012345678, john@example.com, Acme Inc, 1990-05-12';
    return this.sendTextMessage(
      recipientPhone,
      `👥 *Add Customer*\n\nSend the following in one message to add a customer:\nfirstName, lastName, phone, email, company, birthday(YYYY-MM-DD)\n\nExample:\n${sample}`,
      merchantId
    );
  }

  normalizeText(text) {
    return (text || '').toString().trim().toLowerCase();
  }

  getBotMenuText() {
    return `🔧 *FisiAI WhatsApp Main Menu*\n\nThis bot is built for small businesses to record day-to-day sales, track stock, and save customer contacts with easy chat commands. If you're new, start with *menu* and tap one of these quick actions: \n\n1\. Sales – record daily sales, cash received, and customer payments.\n2\. Inventory – view your stock levels and restock status.\n3\. Customers – see your saved customer leads and follow-up details.\n4\. Receipts – log receipt photos or text receipts.\n5\. Invoices – create or request invoices.\n6\. Payments – record payments and receive payment updates.\n7\. Activity – review recent business notes and updates.\n8\. Analytics – see sales and inventory trends.\n9\. Settings – manage your business setup and WhatsApp connection.\n\nReply with the number or type one of these commands:\n• sales\n• inventory\n• customers\n• receipts\n• invoices\n• payments\n• activity\n• analytics\n• settings\n\nExamples:\n• sold 5 shirts today\n• inventory\n• customers\n• received 2,500\n• photo of receipt\n• photo of invoice\n\nSend *menu* or *help* to see this list again.`;
  }

  async buildSettingsSummary(merchantId) {
    if (!merchantId) {
      return '❌ No merchant linked. Connect your merchant account to see settings details.';
    }

    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) {
      return '❌ Merchant not found. Please reconnect your account.';
    }

    const whatsappPhone = merchant.whatsappBusinessPhone || process.env.WHATSAPP_BUSINESS_PHONE || merchant.phone || 'Not configured';
    const telegramEnabled = merchant.telegramEnabled !== false ? 'Yes' : 'No';

    return `⚙️ *Settings Overview*\n\n*Business profile*\n• Name: ${merchant.name || 'Not configured'}\n• Address: ${merchant.businessAddress || 'Not configured'}\n• Type: ${merchant.businessType || 'Retail'}\n• Phone: ${whatsappPhone}\n\n*Channel settings*\n• WhatsApp provider: ${process.env.USE_TWILIO === 'true' ? 'Twilio' : 'Meta Graph API'}\n• Telegram enabled: ${telegramEnabled}\n• Telegram bot: ${merchant.telegramBotUsername || 'Not configured'}\n• Telegram chat ID: ${merchant.telegramChatId || 'Not linked'}\n\n*Notifications*\n• Low stock alerts: enabled\n• Order notifications: enabled\n• Weekly reports: enabled\n\nReply with *menu* to return to the main menu.`;
  }

  async buildAnalyticsSummary(merchantId) {
    if (!merchantId) {
      return '❌ No merchant linked. Connect your merchant account to see analytics insights.';
    }

    const [inventory, contacts, activityCount] = await Promise.all([
      Inventory.find({ merchantId, status: 'Active' }).select('productName quantity price').lean(),
      Contact.countDocuments({ merchantId }),
      ActivityLog.countDocuments({ merchantId }),
    ]);

    const lowStock = inventory.filter((item) => (item.quantity || 0) < 5);
    const totalValue = inventory.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0);
    const lowStockList = lowStock.length
      ? lowStock.slice(0, 4).map((item) => `• ${item.productName || 'Item'} (${item.quantity || 0})`).join('\n')
      : '• None';

    return `📊 *Analytics Overview*\n\n*Inventory summary*\n• Active SKUs: ${inventory.length}\n• Low stock SKUs: ${lowStock.length}\n• Estimated stock value: ₦${totalValue.toLocaleString()}\n\n*Business signals*\n• Contacts saved: ${contacts}\n• Activity entries: ${activityCount}\n\n*Low stock priority*\n${lowStockList}\n\n*Suggested next steps*\n• Restock critical items first\n• Update inventory when new shipments arrive\n• Review top-selling items for reorder planning\n\nReply with *menu* to return to the main menu.`;
  }

  isMainMenuKeyword(text) {
    const normalized = this.normalizeText(text);
    const menuKeywords = [
      'menu',
      'main menu',
      'show menu',
      'show options',
      'options',
      'help',
      'start',
      'begin',
      'get started',
    ];
    return menuKeywords.includes(normalized) || /^(menu|help|options|show menu|show options|start|begin|get started)(\s|$)/.test(normalized);
  }

  extractCommand(text) {
    const normalized = this.normalizeText(text).replace(/^\//, '');
    if (!normalized) return null;

    const numberMap = {
      '1': 'sales',
      '2': 'inventory',
      '3': 'receipts',
      '4': 'invoices',
      '5': 'payments',
      '6': 'activity',
      '7': 'analytics',
      '8': 'settings',
      '9': 'customers',
    };

    if (numberMap[normalized]) return numberMap[normalized];
    if (this.isMainMenuKeyword(normalized)) return 'menu';

    if (normalized === 'sales' || normalized.startsWith('sales ')) return 'sales';
    if (normalized === 'inventory' || normalized.startsWith('inventory ')) return 'inventory';
    if (normalized.startsWith('add item') || normalized === 'additem' || normalized === 'add inventory' || normalized === 'inventory add') return 'inventory_add';
    if (normalized === 'stock' || normalized.startsWith('stock ')) return 'inventory';
    if (normalized === 'receipt' || normalized.startsWith('receipt ')) return 'receipts';
    if (normalized === 'receipts' || normalized.startsWith('receipts ')) return 'receipts';
    if (normalized === 'invoice' || normalized.startsWith('invoice ')) return 'invoices';
    if (normalized === 'invoices' || normalized.startsWith('invoices ')) return 'invoices';
    if (normalized === 'payment' || normalized.startsWith('payment ')) return 'payments';
    if (normalized === 'payments' || normalized.startsWith('payments ')) return 'payments';
    if (normalized === 'cash' || normalized.startsWith('cash ')) return 'sales';
    if (normalized === 'activity' || normalized.startsWith('activity ')) return 'activity';
    if (normalized === 'analytics' || normalized.startsWith('analytics ')) return 'analytics';
    if (normalized === 'settings' || normalized.startsWith('settings ')) return 'settings';
    if (normalized === 'leads' || normalized.startsWith('leads ')) return 'leads';
    if (normalized === 'customers' || normalized.startsWith('customers ')) return 'leads';
    if (normalized === 'customer' || normalized.startsWith('customer ')) return 'leads';
    if (normalized.startsWith('add customer') || normalized === 'addcustomer' || normalized === 'add lead' || normalized === 'addlead') return 'leads_add';
    return null;
  }

  async handleTextCommand(recipientPhone, text, merchantId = null) {
    const command = this.extractCommand(text);
    // If no explicit command, attempt to parse add-item or add-customer one-line messages
    if (!command) {
      const parsedItem = this.parseInventoryLine(text);
      if (parsedItem && merchantId) {
        try {
          const created = await Inventory.create({
            merchantId,
            productName: parsedItem.productName,
            sku: parsedItem.sku,
            quantity: parsedItem.quantity,
            price: parsedItem.price,
            category: parsedItem.category || 'General',
          });
          await this.sendTextMessage(recipientPhone, `✅ Item added: *${created.productName}* (SKU: ${created.sku}) Qty: ${created.quantity}`, merchantId);
          return true;
        } catch (err) {
          console.error('Error creating inventory from text:', err.message || err);
          await this.sendTextMessage(recipientPhone, `❌ Could not add item: ${err.message || err}`, merchantId);
          return true;
        }
      }

      const parsedCustomer = this.parseCustomerLine(text);
      if (parsedCustomer && merchantId) {
        try {
          const existing = await Contact.findOne({ merchantId, phone: parsedCustomer.phone }).lean();
          if (existing) {
            await this.sendTextMessage(recipientPhone, `ℹ Customer already exists: *${existing.firstName} ${existing.lastName}*`, merchantId);
            return true;
          }
          const created = await Contact.create({
            merchantId,
            firstName: parsedCustomer.firstName,
            lastName: parsedCustomer.lastName || ' ',
            phone: parsedCustomer.phone,
            email: parsedCustomer.email || '',
            company: parsedCustomer.company || '',
            birthday: parsedCustomer.birthday || undefined,
            source: 'whatsapp_chat',
          });
          await this.sendTextMessage(recipientPhone, `✅ Customer added: *${created.firstName} ${created.lastName}* (${created.phone})`, merchantId);
          return true;
        } catch (err) {
          console.error('Error creating customer from text:', err.message || err);
          await this.sendTextMessage(recipientPhone, `❌ Could not add customer: ${err.message || err}`, merchantId);
          return true;
        }
      }

      return null;
    }

    switch (command) {
      case 'menu':
        return this.sendWhatsAppMenu(recipientPhone, merchantId);
      case 'sales':
        return this.sendTextMessage(
          recipientPhone,
          `💰 *Sales Command*\n\nUse this chat to record daily sales, cash received, customer payments, and other business income.\n\nExamples:\n• sold 5 shirts today\n• received 2,500\n• cash sale for 20 bags\n• customer payment of 1,200`,
          merchantId
        );
      case 'inventory':
        return this.showWhatsAppInventory(recipientPhone, merchantId);
      case 'inventory_add':
        return this.showWhatsAppAddItem(recipientPhone, merchantId);
      case 'receipts':
        return this.sendTextMessage(
          recipientPhone,
          `🧾 *Receipts Command*\n\nSend a photo or a short text summary of a receipt and the bot can help you record it as business activity.\n\nExamples:\n• photo of receipt\n• receipt for 3 boxes of sugar`,
          merchantId
        );
      case 'invoices':
        return this.sendTextMessage(
          recipientPhone,
          `🧾 *Invoices Command*\n\nAsk for an invoice by describing the sale, customer name, and items. The bot can turn that into a structured invoice summary.`,
          merchantId
        );
      case 'payments':
        return this.sendTextMessage(
          recipientPhone,
          `💳 *Payments Command*\n\nSend Payment – Feature Coming Soon.

Receive Payment – manage your bank details in the dashboard, then share them easily via WhatsApp or Telegram.

You can also log payments received from customers or payments made to suppliers.\n\nExamples:\n• received 2,500 from customer\n• paid supplier 3,000`,
          merchantId
        );
      case 'delivery':
        return this.handleWhatsAppDeliveryCommand(recipientPhone, text, merchantId);
      case 'customers':
      case 'leads':
        return this.showWhatsAppCustomers(recipientPhone, merchantId);
      case 'leads_add':
        return this.showWhatsAppAddCustomer(recipientPhone, merchantId);
      case 'activity':
        return this.sendTextMessage(
          recipientPhone,
          `📝 *Activity Command*\n\nYou can use this chat to review recent sales, stock movements, payment records, and business notes.`,
          merchantId
        );
      case 'analytics':
        return this.sendTextMessage(
          recipientPhone,
          await this.buildAnalyticsSummary(merchantId),
          merchantId
        );
      case 'settings':
        return this.sendTextMessage(
          recipientPhone,
          await this.buildSettingsSummary(merchantId),
          merchantId
        );
      default:
        return null;
    }
  }

    parseInventoryLine(text) {
      if (!text || typeof text !== 'string') return null;
      const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
      // Expect: productName, sku, quantity, price [, category]
      if (parts.length < 4) return null;
      const [productName, sku, qtyRaw, priceRaw, category] = parts;
      const quantity = Number(qtyRaw.replace(/[^0-9.-]/g, ''));
      const price = Number(priceRaw.replace(/[^0-9.-]/g, ''));
      if (!productName || !sku || Number.isNaN(quantity) || Number.isNaN(price)) return null;
      return { productName, sku, quantity, price, category };
    }

    parseCustomerLine(text) {
      if (!text || typeof text !== 'string') return null;
      const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
      // Expect: firstName, lastName, phone, email?, company?, birthday?
      if (parts.length < 3) return null;
      const [firstName, lastName, phoneRaw, email, company, birthdayRaw] = parts;
      const phone = phoneRaw.replace(/[^+0-9]/g, '');
      let birthday = undefined;
      if (birthdayRaw) {
        const d = new Date(birthdayRaw);
        if (!Number.isNaN(d.getTime())) birthday = d;
      }
      if (!firstName || !phone) return null;
      return { firstName, lastName: lastName || ' ', phone, email, company, birthday };
    }

  async handleWhatsAppDeliveryCommand(recipientPhone, text, merchantId = null) {
    const normalized = (text || '').trim().toLowerCase();
    const commandText = normalized.replace(/^\//, '');

    if (!merchantId) {
      return this.sendTextMessage(recipientPhone, '❌ No merchant linked. Use your dashboard config to connect a merchant account.', null);
    }

    if (commandText === 'delivery') {
      return this.sendTextMessage(recipientPhone, DeliveryPartnerService.buildDeliveryPartnerListMessage(), merchantId);
    }

    if (commandText.startsWith('delivery book')) {
      const payload = commandText.slice('delivery book'.length).trim();
      const parts = payload.split('|').map((part) => part.trim()).filter(Boolean);
      const partnerName = parts[0] || '';
      const pickupLocation = parts[1] || '';
      const address = parts[2] || '';

      if (!partnerName || !pickupLocation || !address) {
        return this.sendTextMessage(
          recipientPhone,
          '❌ Delivery booking requires partner, pickup location, and delivery address.\nExample:\n/delivery book FastShip Logistics | Warehouse 14, Lagos | Market Stall 17, Lagos',
          merchantId
        );
      }

      const partner = DeliveryPartnerService.findDeliveryPartner(partnerName);
      if (!partner) {
        return this.sendTextMessage(
          recipientPhone,
          `❌ Could not find delivery partner matching '${partnerName}'. Use /delivery to see available partners.`,
          merchantId
        );
      }

      const taskPayload = {
        title: `Delivery booking with ${partner.name}`,
        description: `Book ${partner.name} from ${pickupLocation} to ${address}.`,
        workflowStage: 'delivery_booking',
        delivery: {
          partner: partner.name,
          pickupLocation,
          address,
        },
        status: 'pending',
        metadata: {
          bookedVia: 'whatsapp',
        },
      };

      const task = await TaskService.createTask(merchantId, taskPayload, false);
      return this.sendTextMessage(
        recipientPhone,
        `✅ Delivery booking created with *${partner.name}*.\nTask ID: ${task.id}.\nPickup: ${pickupLocation}.\nDrop-off: ${address}.\nTrack this booking from your dashboard.`,
        merchantId
      );
    }

    return this.sendTextMessage(recipientPhone, DeliveryPartnerService.buildDeliveryPartnerListMessage(), merchantId);
  }

  getPublicFileUrl(filename) {
    const baseHost = process.env.NGROK_URL
      ? `https://${process.env.NGROK_URL}`
      : `http://localhost:${process.env.PORT || 5000}`;
    return `${baseHost}/docs/${encodeURIComponent(filename)}`;
  }

  async ensureDocsDirectory() {
    const docsPath = path.resolve(__dirname, '..', '..', 'tmp-docs');
    if (!fs.existsSync(docsPath)) {
      fs.mkdirSync(docsPath, { recursive: true });
    }
    return docsPath;
  }

  async writeDocumentToPublicUrl(buffer, filename) {
    const docsPath = await this.ensureDocsDirectory();
    const filePath = path.join(docsPath, filename);
    await fs.promises.writeFile(filePath, buffer);
    return this.getPublicFileUrl(filename);
  }

  async sendDocumentAttachment(recipientPhone, documentSource, filename, caption = '', merchantId = null) {
    if (this.useTwilio && this.twilio) {
      if (Buffer.isBuffer(documentSource)) {
        const publicUrl = await this.writeDocumentToPublicUrl(documentSource, filename);
        try {
          const to = `whatsapp:${recipientPhone}`;
          const resp = await this.twilio.messages.create({
            from: this.twilioFrom,
            to,
            body: caption || filename,
            mediaUrl: [publicUrl],
          });
          const messageId = resp.sid;
          batchWriteService.bufferActivityLog({
            merchantId,
            action: 'API_CALL',
            entityType: 'System',
            entityId: messageId,
            details: {
              source: 'whatsapp',
              provider: 'twilio',
              direction: 'outgoing',
              to: recipientPhone,
              type: 'document',
              filename,
              caption,
            },
            ipAddress: 'twilio-bot',
            status: 'Success',
          });
          console.log(`✓ Twilio document sent: ${messageId}`);
          return { success: true, messageId };
        } catch (error) {
          const errorMessage = error.message || JSON.stringify(error);
          console.error('Error sending Twilio document:', errorMessage);
          batchWriteService.bufferActivityLog({
            merchantId,
            action: 'API_CALL',
            entityType: 'System',
            details: {
              source: 'whatsapp',
              provider: 'twilio',
              direction: 'outgoing',
              to: recipientPhone,
              type: 'document',
              filename,
              caption,
            },
            status: 'Failure',
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      }

      if (typeof documentSource === 'string') {
        try {
          const to = `whatsapp:${recipientPhone}`;
          const resp = await this.twilio.messages.create({
            from: this.twilioFrom,
            to,
            body: caption || filename,
            mediaUrl: [documentSource],
          });
          const messageId = resp.sid;
          batchWriteService.bufferActivityLog({
            merchantId,
            action: 'API_CALL',
            entityType: 'System',
            entityId: messageId,
            details: {
              source: 'whatsapp',
              provider: 'twilio',
              direction: 'outgoing',
              to: recipientPhone,
              type: 'document',
              filename,
              caption,
            },
            ipAddress: 'twilio-bot',
            status: 'Success',
          });

          console.log(`✓ Twilio document sent: ${messageId}`);
          return { success: true, messageId };
        } catch (error) {
          const errorMessage = error.message || JSON.stringify(error);
          console.error('Error sending Twilio document:', errorMessage);
          batchWriteService.bufferActivityLog({
            merchantId,
            action: 'API_CALL',
            entityType: 'System',
            details: {
              source: 'whatsapp',
              provider: 'twilio',
              direction: 'outgoing',
              to: recipientPhone,
              type: 'document',
              filename,
              caption,
            },
            status: 'Failure',
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      }

      return {
        success: false,
        error: 'Twilio document attachments require a public media URL or an uploaded document URL.',
      };
    }

    return this.sendDocumentAttachmentViaMeta(recipientPhone, documentSource, filename, caption, merchantId);
  }

  async sendDocumentAttachmentViaMeta(recipientPhone, documentBuffer, filename, caption = '', merchantId = null) {
    try {
      const formData = new FormData();
      formData.append('file', documentBuffer, filename);
      formData.append('type', 'document');

      const uploadResponse = await fetch(
        `${this.baseURL}/${this.phoneNumberId}/media`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: formData,
        }
      );

      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadData.id) {
        const err = uploadData.error?.message || JSON.stringify(uploadData);
        console.error('Error uploading document to Meta:', err);
        return { success: false, error: err };
      }

      const mediaId = uploadData.id;
      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'document',
          document: {
            id: mediaId,
            filename,
            caption,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const messageId = response.data.messages[0].id;
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        entityId: messageId,
        details: {
          source: 'whatsapp',
          provider: 'meta',
          direction: 'outgoing',
          to: recipientPhone,
          type: 'document',
          filename,
          caption,
        },
        ipAddress: 'whatsapp-bot',
        status: 'Success',
      });

      console.log(`✓ Meta WhatsApp document sent: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      const errorData = error.response?.data || error.message;
      console.error('Error sending Meta WhatsApp document:', errorData);
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        details: {
          source: 'whatsapp',
          provider: 'meta',
          direction: 'outgoing',
          to: recipientPhone,
          type: 'document',
          filename,
          caption,
        },
        status: 'Failure',
        error: error.response?.data?.error?.message || error.message,
      });
      return { success: false, error: errorData };
    }
  }

  /**
   * Send interactive message with buttons
   * For Twilio we fall back to a text list if true interactive not supported
   */
  async sendInteractiveMessage(recipientPhone, title, options, merchantId = null) {
    if (this.useTwilio && this.twilio) {
      const body = `${title}\n` + options.map((o, i) => `${i + 1}. ${o.title}`).join('\n');
      return this.sendTextMessage(recipientPhone, body, merchantId);
    }

    // Meta implementation
    try {
      const buttons = options.map((option, index) => ({
        type: 'reply',
        reply: {
          id: String(index + 1),
          title: option.title,
        },
      }));

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: title,
            },
            action: {
              buttons,
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const messageId = response.data.messages[0].id;
      
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        entityId: messageId,
        details: {
          source: 'whatsapp',
          direction: 'outgoing',
          to: recipientPhone,
          type: 'interactive',
          title,
          options,
        },
        status: 'Success',
      });

      console.log(`✓ Interactive message sent: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      console.error('Error sending interactive message:', error.response?.data || error.message);
      
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        details: {
          source: 'whatsapp',
          direction: 'outgoing',
          to: recipientPhone,
          type: 'interactive',
        },
        status: 'Failure',
        error: error.response?.data?.error?.message || error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId) {
    if (this.useTwilio) {
      // Twilio does not support marking as read via API; no-op
      console.log(`ℹ Twilio: markMessageAsRead no-op for ${messageId}`);
      return;
    }

    try {
      await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`✓ Message marked as read: ${messageId}`);
    } catch (error) {
      console.error('Error marking message as read:', error.response?.data || error.message);
    }
  }
}

module.exports = new WhatsAppService();
