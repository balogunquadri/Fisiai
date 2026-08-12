const fs = require('fs');
const path = require('path');
const axios = require('axios');
const _tg = require('node-telegram-bot-api');
const TelegramBot = _tg && _tg.default ? _tg.default : _tg;
const Merchant = require('../models/Merchant');
const ActivityLog = require('../models/ActivityLog');
const Inventory = require('../models/Inventory');
const Contact = require('../models/Contact');
const BankDetail = require('../models/BankDetail');
const TaskService = require('./taskService');
const DeliveryPartnerService = require('./deliveryPartnerService');
const batchWriteService = require('./batchWriteService');
const cacheService = require('./cacheService');
const receiptGenerator = require('./receiptGenerator');
const CustomerBroadcastEvent = require('../models/CustomerBroadcastEvent');
const { webhookQueue } = require('./queue');

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || null;
    this.botUsername = process.env.TELEGRAM_BOT_USERNAME || null;
    this.webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || null;
    this.apiBaseUrl = this.botToken ? `https://api.telegram.org/bot${this.botToken}` : null;
    this.bot = this.botToken ? new TelegramBot(this.botToken, { polling: false }) : null;
    this.docsPath = path.resolve(__dirname, '..', '..', 'tmp-docs');
  }

  async ensureDocsDirectory() {
    if (!fs.existsSync(this.docsPath)) {
      fs.mkdirSync(this.docsPath, { recursive: true });
    }
    return this.docsPath;
  }

  getPublicDocumentUrl(filename) {
    const baseHost = process.env.NGROK_URL
      ? `https://${process.env.NGROK_URL}`
      : `http://localhost:${process.env.PORT || 5000}`;
    return `${baseHost}/docs/${encodeURIComponent(filename)}`;
  }

  getDashboardUrl(pathname = '/dashboard') {
    const baseHost = process.env.FRONTEND_URL || process.env.NGROK_URL ? `https://${process.env.NGROK_URL}` : 'http://localhost:3000';
    return `${baseHost.replace(/\/$/, '')}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  }

  async writeDocumentToTmpDocs(buffer, filename) {
    await this.ensureDocsDirectory();
    const filePath = path.join(this.docsPath, filename);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  normalizeTelegramChatId(chatId) {
    if (!chatId && chatId !== 0) return null;
    return chatId.toString();
  }

  parseIncomingTelegram(payload) {
    if (!payload) return null;

    const message = payload.message || payload.edited_message || payload.channel_post || payload.edited_channel_post;
    if (!message) return null;

    const chat = message.chat || {};
    const from = message.from || {};
    const chatId = this.normalizeTelegramChatId(chat.id);

    const contact = message.contact
      ? {
          name: [message.contact.first_name, message.contact.last_name].filter(Boolean).join(' ').trim() || null,
          phone: message.contact.phone_number || null,
          role: 'contact',
        }
      : null;

    const mediaAttachments = [];
    let image = null;
    let document = null;
    let audio = null;
    let video = null;

    if (message.photo) {
      const bestPhoto = message.photo[message.photo.length - 1];
      image = { id: bestPhoto.file_id, mime_type: 'image/jpeg' };
      mediaAttachments.push({ type: 'image', photo: message.photo });
    }
    if (message.document) {
      document = {
        id: message.document.file_id,
        mime_type: message.document.mime_type || message.document.mimeType,
        filename: message.document.file_name || null,
      };
      mediaAttachments.push({ type: 'document', document: message.document });
    }
    if (message.audio) {
      audio = {
        id: message.audio.file_id,
        mime_type: message.audio.mime_type || message.audio.mimeType || 'audio/mpeg',
      };
      mediaAttachments.push({ type: 'audio', audio: message.audio });
    }
    if (message.voice) {
      audio = {
        id: message.voice.file_id,
        mime_type: message.voice.mime_type || message.voice.mimeType || 'audio/ogg',
      };
      mediaAttachments.push({ type: 'voice', voice: message.voice });
    }
    if (message.video) {
      video = {
        id: message.video.file_id,
        mime_type: message.video.mime_type || message.video.mimeType || 'video/mp4',
      };
      mediaAttachments.push({ type: 'video', video: message.video });
    }
    if (message.location) {
      mediaAttachments.push({ type: 'location', location: message.location });
    }

    const text = message.text || message.caption || null;
    let type = 'text';
    if (!text) {
      if (message.photo) type = 'image';
      else if (message.document) type = 'document';
      else if (message.audio) type = 'audio';
      else if (message.voice) type = 'voice';
      else if (message.video) type = 'video';
      else if (message.location) type = 'location';
      else type = 'text';
    }

    return {
      messageId: `tg-${chatId}-${message.message_id || message.update_id || Date.now()}`,
      from: from.username || from.id?.toString() || `${from.first_name || 'telegram-user'}`,
      fromUsername: from.username || null,
      chatId,
      chatUsername: chat.username || null,
      timestamp: message.date ? parseInt(`${message.date}`, 10) * 1000 : Date.now(),
      type,
      text,
      mediaAttachments,
      image,
      document,
      audio,
      video,
      contact,
      recipientChatId: chatId,
      source: 'telegram',
      botUsername: this.botUsername,
      provider: 'telegram',
    };
  }

  async resolveMerchantFromIncomingMessage(messageData) {
    const chatId = this.normalizeTelegramChatId(messageData.chatId || messageData.recipientChatId || messageData.chat_id);
    const botUsername = messageData.botUsername || this.botUsername || null;

    const query = [];
    if (chatId) {
      query.push({ telegramChatId: chatId });
    }
    if (botUsername) {
      query.push({ telegramBotUsername: botUsername });
    }

    let merchant = null;
    if (query.length > 0) {
      merchant = await Merchant.findOne({ $or: query }).lean();
    }

    // If merchant exists but lacks telegram linkage, attach chat id and bot username
    if (merchant) {
      const updates = {};
      if (chatId && (!merchant.telegramChatId || merchant.telegramChatId !== chatId)) updates.telegramChatId = chatId;
      if (botUsername && (!merchant.telegramBotUsername || merchant.telegramBotUsername !== botUsername)) updates.telegramBotUsername = botUsername;
      if (Object.keys(updates).length > 0) {
        try {
          await Merchant.findByIdAndUpdate(merchant._id, updates, { new: true });
          merchant = await Merchant.findById(merchant._id).lean();
          console.log(`✓ Auto-linked existing merchant ${merchant._id} to Telegram chat ${chatId}`);
        } catch (err) {
          console.error('Error auto-linking merchant to Telegram chat:', err.message || err);
        }
      }
    }

    if (!merchant && chatId) {
      const placeholderEmail = `merchant-telegram-${chatId}@Fisiai.local`;
      const created = new Merchant({
        phone: `tg-${chatId}`,
        name: `Telegram Merchant ${chatId}`,
        email: placeholderEmail,
        businessType: 'Retail',
        telegramChatId: chatId,
        telegramBotUsername: botUsername,
        telegramEnabled: true,
      });
      merchant = await created.save();
      merchant = merchant.toObject();
      console.log(`✓ Created new merchant mapping for Telegram chat: ${merchant._id}`);
    }

    // If still no merchant, try matching by shared contact phone number (when user shares contact)
    if (!merchant && messageData.contact && messageData.contact.phone) {
      try {
        const normalized = messageData.contact.phone.toString().replace(/[^\d]/g, '');
        const found = await Merchant.findOne({ $or: [ { phone: new RegExp(`${normalized}$`) }, { whatsappBusinessPhone: normalized }, { phone: normalized } ] }).lean();
        if (found) {
          await Merchant.findByIdAndUpdate(found._id, { telegramChatId: chatId, telegramBotUsername: botUsername, telegramEnabled: true });
          merchant = await Merchant.findById(found._id).lean();
          console.log(`✓ Auto-linked existing merchant ${merchant._id} to Telegram chat ${chatId} via contact phone`);
        }
      } catch (err) {
        console.error('Error attempting phone-based auto-link for Telegram:', err.message || err);
      }
    }

    return merchant;
  }

  async sendTextMessage(chatId, message, merchantId = null, inlineKeyboard = null, parseMode = 'MarkdownV2') {
    if (!this.apiBaseUrl) {
      const errorMessage = 'Telegram bot token is not configured';
      console.error('Error sending Telegram message:', errorMessage);
      return { success: false, error: errorMessage };
    }

    try {
      const payload = {
        chat_id: chatId,
        text: parseMode === 'MarkdownV2' ? this.escapeMarkdownV2(message) : message,
      };
      if (parseMode) {
        payload.parse_mode = parseMode;
      }

      if (inlineKeyboard && inlineKeyboard.length > 0) {
        const escapedKeyboard = inlineKeyboard.map((row) => {
          return row.map((button) => {
            const btn = typeof button === 'string' ? { text: button } : { ...button };
            if (parseMode === 'MarkdownV2') {
              btn.text = this.escapeMarkdownV2(btn.text || '');
            }
            return btn;
          });
        });
        payload.reply_markup = { inline_keyboard: escapedKeyboard };
      }

      const response = await axios.post(`${this.apiBaseUrl}/sendMessage`, payload);

      const messageId = response.data.result?.message_id?.toString() || null;
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        entityId: messageId || `telegram-${chatId}-${Date.now()}`,
        details: {
          source: 'telegram',
          provider: 'telegram',
          direction: 'outgoing',
          to: chatId,
          type: 'text',
          content: message,
        },
        ipAddress: 'telegram-bot',
        status: 'Success',
      });

      console.log(`✓ Telegram message sent to chat ${chatId}: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error.response?.data || error.message || 'Unknown Telegram error';
      console.error('Error sending Telegram message:', errorMessage);
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        details: {
          source: 'telegram',
          provider: 'telegram',
          direction: 'outgoing',
          to: chatId,
          type: 'text',
          content: message,
        },
        ipAddress: 'telegram-bot',
        status: 'Failure',
        error: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
      });
      return { success: false, error: errorMessage };
    }
  }
  async sendDocument(chatId, documentBuffer, filename, caption = '', merchantId = null) {
    if (!this.bot) {
      const errorMessage = 'Telegram bot token is not configured';
      console.error('Error sending Telegram document:', errorMessage);
      return { success: false, error: errorMessage };
    }

    try {
      const options = {};
      if (caption) {
        options.caption = this.escapeMarkdownV2(caption);
        options.parse_mode = 'MarkdownV2';
      }

      // node-telegram-bot-api accepts a Buffer via an object with `filename` and `content`.
      const docPayload = Buffer.isBuffer(documentBuffer)
        ? { filename, content: documentBuffer }
        : documentBuffer;
      const response = await this.bot.sendDocument(chatId, docPayload, options);
      const messageId = response.message_id?.toString() || null;

      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        entityId: messageId || `telegram-doc-${chatId}-${Date.now()}`,
        details: {
          source: 'telegram',
          provider: 'telegram',
          direction: 'outgoing',
          to: chatId,
          type: 'document',
          filename,
          caption,
        },
        ipAddress: 'telegram-bot',
        status: 'Success',
      });

      console.log(`✓ Telegram document sent to chat ${chatId}: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error.message || 'Unknown Telegram document error';
      console.error('Error sending Telegram document:', errorMessage);
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'API_CALL',
        entityType: 'System',
        details: {
          source: 'telegram',
          provider: 'telegram',
          direction: 'outgoing',
          to: chatId,
          type: 'document',
          filename,
          caption,
        },
        ipAddress: 'telegram-bot',
        status: 'Failure',
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  async setReceiptSession(chatId, merchantId, intent) {
    if (!merchantId || !chatId) return false;
    return cacheService.setSession(merchantId, chatId, { intent, createdAt: Date.now() }, 900);
  }

  async setBankSession(chatId, merchantId, sessionData) {
    if (!merchantId || !chatId) return false;
    return cacheService.setSession(merchantId, chatId, sessionData, 900);
  }

  async clearBankSession(chatId, merchantId) {
    if (!merchantId || !chatId) return false;
    return cacheService.delSession(merchantId, chatId);
  }

  async clearReceiptSession(chatId, merchantId) {
    if (!merchantId || !chatId) return false;
    return cacheService.delSession(merchantId, chatId);
  }

  async setBusinessInfoFromText(chatId, text, merchant) {
    try {
      const payload = text.includes(':') ? text.split(':').slice(1).join(':') : '';
      const parts = payload.split('|').map((p) => p.trim()).filter(Boolean);
      const name = parts[0] || merchant?.name || null;
      const address = parts[1] || merchant?.businessAddress || '';
      const color = parts[2] || merchant?.receiptColor || '#000000';

      if (!merchant || !merchant._id) {
        await this.sendTextMessage(chatId, '❌ No merchant linked. Use /link to connect your account.', null);
        return true;
      }

      await Merchant.findByIdAndUpdate(merchant._id, { name, businessAddress: address, receiptColor: color }, { new: true });
      await this.sendTextMessage(chatId, `✅ Business info updated.\nName: ${this.escapeMarkdown(name)}\nAddress: ${this.escapeMarkdown(address)}\nColor: ${this.escapeMarkdown(color)}`, merchant._id);
      await this.clearReceiptSession(chatId, merchant._id);
      return true;
    } catch (error) {
      console.error('Error setting business info from text:', error.message || error);
      await this.sendTextMessage(chatId, `❌ Failed to set business info: ${error.message || error}`, merchant?._id);
      return true;
    }
  }

  async createReceiptFromText(chatId, text, merchant) {
    try {
      if (!merchant || !merchant._id) {
        await this.sendTextMessage(chatId, '❌ No merchant linked. Use /link to connect your account.', null);
        return true;
      }

      const normalized = text.trim();
      const totalMatch = normalized.match(/total\s*[:=]?\s*([\d,\.]+)/i);
      const total = totalMatch ? totalMatch[1] : 'N/A';
      const body = totalMatch ? normalized.replace(totalMatch[0], '').trim() : normalized;

      const safeBody = body || 'No receipt details provided.';
      const assets = await receiptGenerator.generateReceiptAssets({
        businessName: merchant.name,
        businessAddress: merchant.businessAddress,
        receiptText: safeBody,
        total,
        receiptColor: merchant.receiptColor,
      });

      const timestamp = Date.now();
      const pdfFilename = `receipt-${merchant._id}-${timestamp}.pdf`;
      const pngFilename = `receipt-${merchant._id}-${timestamp}.png`;
      const pdfPath = await this.writeDocumentToTmpDocs(assets.pdfBuffer, pdfFilename);
      const pngPath = await this.writeDocumentToTmpDocs(assets.pngBuffer, pngFilename);
      const pdfUrl = this.getPublicDocumentUrl(pdfFilename);
      const pngUrl = this.getPublicDocumentUrl(pngFilename);

      console.log(`✓ Receipt files written: ${pdfPath}, ${pngPath}`);
      await this.sendTextMessage(chatId, `✅ Receipt generated and saved.
PDF: ${pdfUrl}
PNG: ${pngUrl}`, merchant._id, null, null);
      await this.sendDocument(chatId, assets.pdfBuffer, pdfFilename, 'Here is your receipt PDF', merchant._id);
      await this.sendDocument(chatId, assets.pngBuffer, pngFilename, 'Here is your receipt image', merchant._id);
      await this.clearReceiptSession(chatId, merchant._id);
      return true;
    } catch (error) {
      console.error('Error creating receipt from text:', error.message || error);
      await this.sendTextMessage(chatId, `❌ Failed to create receipt: ${error.message || error}`, merchant?._id);
      return true;
    }
  }

  async createInvoiceFromText(chatId, text, merchant) {
    try {
      if (!merchant || !merchant._id) {
        await this.sendTextMessage(chatId, '❌ No merchant linked. Use /link to connect your account.', null);
        return true;
      }

      const normalized = text.trim();
      const totalMatch = normalized.match(/total\s*[:=]?\s*([\d,\.]+)/i);
      const total = totalMatch ? totalMatch[1] : 'N/A';
      const body = totalMatch ? normalized.replace(totalMatch[0], '').trim() : normalized;
      const invoiceNumber = `INV-${Date.now()}`;

      const assets = await receiptGenerator.generateInvoiceAssets({
        businessName: merchant.name,
        businessAddress: merchant.businessAddress,
        invoiceText: body,
        total,
        receiptColor: merchant.receiptColor,
        invoiceNumber,
      });

      const timestamp = Date.now();
      const pdfFilename = `invoice-${merchant._id}-${invoiceNumber}-${timestamp}.pdf`;
      const pngFilename = `invoice-${merchant._id}-${invoiceNumber}-${timestamp}.png`;
      const pdfPath = await this.writeDocumentToTmpDocs(assets.pdfBuffer, pdfFilename);
      const pngPath = await this.writeDocumentToTmpDocs(assets.pngBuffer, pngFilename);
      const pdfUrl = this.getPublicDocumentUrl(pdfFilename);
      const pngUrl = this.getPublicDocumentUrl(pngFilename);

      console.log(`✓ Invoice files written: ${pdfPath}, ${pngPath}`);
      await this.sendTextMessage(chatId, `✅ Invoice generated and saved.
PDF: ${pdfUrl}
PNG: ${pngUrl}`, merchant._id, null, null);
      await this.sendDocument(chatId, assets.pdfBuffer, pdfFilename, 'Here is your invoice PDF', merchant._id);
      await this.sendDocument(chatId, assets.pngBuffer, pngFilename, 'Here is your invoice image', merchant._id);
      await this.clearReceiptSession(chatId, merchant._id);
      return true;
    } catch (error) {
      console.error('Error creating invoice from text:', error.message || error);
      await this.sendTextMessage(chatId, `❌ Failed to create invoice: ${error.message || error}`, merchant?._id);
      return true;
    }
  }

  async handleReceiptSession(message, merchant, session) {
    const chatId = message.chatId;
    const text = (message.text || '').trim();
    if (!session || !text) return false;

    if (text.toLowerCase() === 'cancel') {
      await this.clearReceiptSession(chatId, merchant?._id);
      await this.sendTextMessage(chatId, '❌ Receipt workflow cancelled. Use /receipts or /menu to restart.', merchant?._id);
      return true;
    }

    // Bank detail flows (add / edit)
    if (session.intent && session.intent.startsWith('bank_')) {
      // Expect: Bank Name | Account Name | Account Number | Branch (opt) | Currency (opt) | Notes (opt)
      const parts = text.split('|').map((p) => p.trim()).filter(Boolean);
      const bankName = parts[0] || '';
      const accountName = parts[1] || '';
      const accountNumber = parts[2] || '';
      const branch = parts[3] || '';
      const currency = parts[4] || 'NGN';
      const notes = parts[5] || '';

      if (!bankName || !accountName || !accountNumber) {
        await this.sendTextMessage(chatId, '❌ Please provide bank details as: Bank Name | Account Name | Account Number | Branch(optional) | Currency(optional) | Notes(optional)\nType *cancel* to stop.', merchant?._id);
        return true;
      }

      try {
        if (session.intent === 'bank_add') {
          const created = await BankDetail.create({
            merchantId: merchant._id,
            bankName,
            accountName,
            accountNumber,
            branch,
            currency,
            notes,
          });
          await ActivityLog.create({ merchantId: merchant._id, action: 'BANK_DETAIL_ADDED', entityType: 'BankDetail', entityId: created._id, details: { bankName, accountNumber }, status: 'Success' });
          await this.clearBankSession(chatId, merchant._id);
          await this.sendTextMessage(chatId, `✅ Bank detail added:\n*${this.escapeMarkdown(created.bankName)}*\n${this.escapeMarkdown(created.accountName)} – ${this.escapeMarkdown(created.accountNumber)}`, merchant._id, [[{ text: '◀️ Back', callback_data: 'payments_view' }]]);
          return true;
        }

        if (session.intent === 'bank_edit' && session.editId) {
          const updated = await BankDetail.findOneAndUpdate({ _id: session.editId, merchantId: merchant._id }, { $set: { bankName, accountName, accountNumber, branch, currency, notes } }, { new: true }).lean();
          if (!updated) {
            await this.sendTextMessage(chatId, '❌ Could not find the bank detail to update.', merchant._id);
            await this.clearBankSession(chatId, merchant._id);
            return true;
          }
          await ActivityLog.create({ merchantId: merchant._id, action: 'BANK_DETAIL_UPDATED', entityType: 'BankDetail', entityId: updated._id, details: { bankName, accountNumber }, status: 'Success' });
          await this.clearBankSession(chatId, merchant._id);
          await this.sendTextMessage(chatId, `✅ Bank detail updated:\n*${this.escapeMarkdown(updated.bankName)}*\n${this.escapeMarkdown(updated.accountName)} – ${this.escapeMarkdown(updated.accountNumber)}`, merchant._id, [[{ text: '◀️ Back', callback_data: 'payments_view' }]]);
          return true;
        }
      } catch (err) {
        console.error('Error handling bank detail session:', err.message || err);
        await this.sendTextMessage(chatId, `❌ Failed to save bank detail: ${err.message || err}`, merchant?._id);
        await this.clearBankSession(chatId, merchant._id);
        return true;
      }
    }

    if (session.intent === 'receipt_set_info') {
      return this.setBusinessInfoFromText(chatId, text, merchant);
    }

    if (session.intent === 'receipt_create') {
      return this.createReceiptFromText(chatId, text, merchant);
    }

    if (session.intent === 'invoice_create') {
      return this.createInvoiceFromText(chatId, text, merchant);
    }

    if (session.intent === 'task_create') {
      return this.handleTaskSession(message, merchant, session);
    }

    if (session.intent === 'broadcast_create') {
      return this.handleBroadcastSession(message, merchant, session);
    }

    return false;
  }

  async setTaskSession(chatId, merchantId, intent) {
    return cacheService.setSession(merchantId, chatId, { intent, createdAt: Date.now() }, 900);
  }

  async clearTaskSession(chatId, merchantId) {
    return cacheService.delSession(merchantId, chatId);
  }

  async handleTaskSession(message, merchant, session) {
    const chatId = message.chatId;
    const text = (message.text || '').trim();
    if (!session || !text || !merchant?._id) return false;

    if (text.toLowerCase() === 'cancel') {
      await this.clearTaskSession(chatId, merchant._id);
      await this.sendTextMessage(chatId, '❌ Task creation cancelled. Use /menu to continue.', merchant._id);
      return true;
    }

    const parts = text.split('|').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      await this.sendTextMessage(
        chatId,
        '📝 Please send task details as: title | description | due date(optional)\nExample:\nInventory restock | Buy 50 crates of tomatoes | 2026-08-10',
        merchant._id
      );
      return true;
    }

    const title = parts[0];
    const description = parts[1];
    const dueDate = parts[2] ? new Date(parts[2]) : undefined;

    try {
      const task = await TaskService.createTask(merchant._id, {
        title,
        description,
        workflowStage: 'telegram_task',
        status: 'pending',
        dueDate,
        metadata: { createdVia: 'telegram' },
      }, false);

      await this.clearTaskSession(chatId, merchant._id);
      await this.sendTextMessage(
        chatId,
        `✅ Task created successfully:\n*${this.escapeMarkdown(title)}*\nTask ID: ${task.id}\nView it in the dashboard: ${this.escapeMarkdown(this.getDashboardUrl('/dashboard/tasks'))}`,
        merchant._id,
        [[{ text: 'Open Tasks', url: this.getDashboardUrl('/dashboard/tasks') }], [{ text: '◀️ Main Menu', callback_data: 'menu_main' }]]
      );
      return true;
    } catch (err) {
      console.error('Error creating task from Telegram:', err.message || err);
      await this.sendTextMessage(chatId, `❌ Failed to create task: ${err.message || 'Unknown error'}`, merchant._id);
      return true;
    }
  }

  async handleBroadcastSession(message, merchant, session) {
    const chatId = message.chatId;
    const text = (message.text || '').trim();
    if (!session || !text || !merchant?._id) return false;

    if (text.toLowerCase() === 'cancel') {
      await this.clearTaskSession(chatId, merchant._id);
      await this.sendTextMessage(chatId, '❌ Broadcast creation cancelled. Use /menu to continue.', merchant._id);
      return true;
    }

    const parts = text.split('|').map((part) => part.trim());
    const messageBody = parts[0] || '';
    const tags = parts[1] ? parts[1].split(',').map((tag) => tag.trim()).filter(Boolean) : [];

    if (!messageBody) {
      await this.sendTextMessage(
        chatId,
        '📣 Please send broadcast details as: message | tags(optional)\nExample:\nSale today: 20% off all items | loyal,retail',
        merchant._id
      );
      return true;
    }

    try {
      const broadcast = await CustomerBroadcastEvent.create({
        merchantId: merchant._id,
        name: 'Telegram Broadcast',
        message: messageBody,
        tags,
        status: 'Any',
        scheduledAt: new Date(),
        recurrence: 'none',
        nextRunAt: new Date(),
        active: true,
      });

      await this.clearTaskSession(chatId, merchant._id);
      await this.sendTextMessage(
        chatId,
        `✅ Broadcast created successfully and saved to your dashboard.\nMessage: ${this.escapeMarkdown(messageBody)}\nView and send from the dashboard: ${this.escapeMarkdown(this.getDashboardUrl('/dashboard/customers/campaigns'))}`,
        merchant._id,
        [[{ text: 'Open Broadcasts', url: this.getDashboardUrl('/dashboard/customers/campaigns') }], [{ text: '◀️ Main Menu', callback_data: 'menu_main' }]]
      );
      return true;
    } catch (err) {
      console.error('Error creating broadcast from Telegram:', err.message || err);
      await this.sendTextMessage(chatId, `❌ Failed to create broadcast: ${err.message || 'Unknown error'}`, merchant._id);
      return true;
    }
  }

  escapeMarkdownV2(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/([_\*\[\]()~`>#+\-=|{}\.\!])/g, '\\$1');
  }

  escapeMarkdown(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/([_\*\[\]()`])/g, '\\$1');
  }

  // ============================================
  // COMMAND HANDLERS
  // ============================================

  async handleCommand(message, merchant) {
    const text = message.text || '';
    const chatId = message.chatId;
    
    // Extract command and arguments
    const commandMatch = text.match(/^\/(\w+)\s*(.*)/);
    if (!commandMatch) return null;

    const command = commandMatch[1].toLowerCase();
    const args = commandMatch[2].trim();

    console.log(`🤖 Command /${command} from merchant ${merchant?._id}`);

    switch (command) {
      case 'start':
        return this.handleStartCommand(chatId, merchant);
      case 'menu':
        return this.handleMenuCommand(chatId, merchant);
      case 'sales':
        return this.handleSalesCommand(chatId, merchant);
      case 'inventory':
      case 'stock':
        return this.handleInventoryCommand(chatId, merchant, args);
      case 'receipts':
        return this.handleReceiptsCommand(chatId, merchant);
      case 'invoices':
        return this.handleInvoicesCommand(chatId, merchant);
      case 'payments':
        return this.handlePaymentsCommand(chatId, merchant);
      case 'delivery':
        return this.handleDeliveryCommand(chatId, merchant, args);
      case 'leads':
      case 'customers':
      case 'customer':
        return this.handleLeadsCommand(chatId, merchant, args);
      case 'activity':
        return this.handleActivityCommand(chatId, merchant);
      case 'analytics':
        return this.handleAnalyticsCommand(chatId, merchant);
      case 'settings':
        return this.handleSettingsCommand(chatId, merchant);
      case 'link':
        return this.handleLinkCommand(chatId, merchant, args);
      default:
        await this.sendTextMessage(chatId, `❓ Unknown command: /${command}\n\nUse /menu for available commands.`, merchant._id);
        return true;
    }
  }

  async handleStartCommand(chatId, merchant) {
    const greeting = merchant?.name 
      ? `👋 Welcome back, *${this.escapeMarkdown(merchant.name)}*\\!`
      : `👋 Welcome to FisiAI Bot\\!`;

    const message = `${greeting}

Welcome to FisiAI for small businesses\! Use this chat to record daily sales with text, voice notes, or images, then generate receipts and invoices and track payment updates in one place.
• Record sales with simple text or voice notes
• Send a receipt photo or invoice note
• Log payments received and payments made
• Track inventory and business activity from chat

Use /menu to start your daily business log\.`;

    const keyboard = [
      [{ text: '📋 FisiAI Main Menu', callback_data: 'menu_main' }],
      [{ text: '❓ Help', callback_data: 'help' }],
    ];

    return this.sendTextMessage(chatId, message, merchant?._id, keyboard);
  }

  async handleMenuCommand(chatId, merchant) {
    const message = `🔧 *FisiAI Main Menu*

This bot is built for small businesses to record day-to-day sales with text, voice notes, or images. Send a sale update, a receipt photo, an invoice request, or a payment note and the AI will save it for you.

1\. Sales – record daily sales, cash received, and customer payments.
2\. Inventory – view stock, add products, and update quantities.
3\. Receipts – generate or log receipts from chat text or image uploads.
4\. Invoices – create or request invoices from customer sales and orders.
5\. Payments – record payments received and payments made.
6\. Activity – review recent business records and updates.
7\. Customers – manage customer contacts and leads.
8\. Delivery – book a delivery partner and track shipments.
9\. Analytics – see sales and inventory trends.
10\. Settings – manage your business setup and Telegram connection.`

    const keyboard = [
      [
        { text: 'Sales', callback_data: 'sales_view' },
        { text: 'Inventory', callback_data: 'inventory_list' },
      ],
      [
        { text: 'Customers', callback_data: 'leads_list' },
        { text: 'Receipts', callback_data: 'receipts_view' },
      ],
      [
        { text: 'Invoices', callback_data: 'invoices_view' },
        { text: 'Payments', callback_data: 'payments_view' },
      ],
      [
        { text: 'Activity', callback_data: 'activity_view' },
        { text: 'Analytics', callback_data: 'analytics_view' },
      ],
      // Expose delivery, tasks, broadcasts, alerts
      [
        { text: 'Delivery', callback_data: 'delivery_view' },
        { text: 'Tasks', callback_data: 'tasks_view' },
      ],
      [
        { text: 'Broadcasts', callback_data: 'broadcasts_view' },
        { text: 'Alerts', callback_data: 'alerts_view' },
      ],
      // Quick add actions for new users
      [
        { text: '➕ Add Item', callback_data: 'inventory_add' },
        { text: '➕ Add Customer', callback_data: 'leads_add' },
      ],
      [
        { text: 'Settings', callback_data: 'settings_view' },
      ],
    ];

    return this.sendTextMessage(chatId, message, merchant?._id, keyboard);
  }

  async handleSalesCommand(chatId, merchant) {
    const message = `💰 *Sales*

Use this chat to record daily sales, cash received, customer payments, and other business income.

Examples:
• sold 5 shirts today
• received 2,500
• cash sale for 20 bags
• customer payment of 1,200`;

    const keyboard = [[{ text: '◀️ Back', callback_data: 'menu_main' }]];
    return this.sendTextMessage(chatId, message, merchant?._id, keyboard);
  }

  async handleReceiptsCommand(chatId, merchant) {
    const message = `🧾 *Receipts*\n\nSend a photo or a short text summary of a receipt and the bot can help you record it as business activity. You can also generate a receipt using your business details.`;

    const keyboard = [
      [
        { text: '🆕 Create Receipt', callback_data: 'receipts_create' },
        { text: '⚙️ Set Business Info', callback_data: 'receipts_setinfo' },
      ],
      [{ text: '◀️ Back', callback_data: 'menu_main' }],
    ];

    // If merchant exists, show current stored address/color for convenience
    if (merchant) {
      const info = `\n\n*Stored Business Info:*\nName: ${this.escapeMarkdown(merchant.name || '')}\nAddress: ${this.escapeMarkdown(merchant.businessAddress || '')}\nColor: ${this.escapeMarkdown(merchant.receiptColor || '')}`;
      return this.sendTextMessage(chatId, message + info, merchant._id, keyboard);
    }

    return this.sendTextMessage(chatId, message, merchant?._id, keyboard);
  }

  async handleInvoicesCommand(chatId, merchant) {
    const message = `🧾 *Invoices*

Ask for an invoice by describing the sale, customer name, and items. The bot can turn that into a structured invoice summary.`;

    const keyboard = [
      [
        { text: '🆕 Create Invoice', callback_data: 'invoices_create' },
        { text: '⚙️ Set Business Info', callback_data: 'invoices_setinfo' },
      ],
      [{ text: '◀️ Back', callback_data: 'menu_main' }],
    ];
    return this.sendTextMessage(chatId, message, merchant?._id, keyboard);
  }

  async handlePaymentsCommand(chatId, merchant) {
    const message = `💳 *Payments*

Choose an action below.`;

    const keyboard = [
      [ { text: 'Send Payment', callback_data: 'payments_send' }, { text: 'Receive Payment', callback_data: 'payments_receive' } ],
      [ { text: 'Manage Bank Details', callback_data: 'payments_receive' } ],
      [ { text: '◀️ Back', callback_data: 'menu_main' } ],
    ];

    return this.sendTextMessage(chatId, message, merchant?._id, keyboard);
  }

  async handleTasksCommand(chatId, merchant) {
    if (!merchant || !merchant._id) {
      await this.sendTextMessage(chatId, '❌ Not linked to a merchant. Use /link to connect.', null);
      return true;
    }

    try {
      const tasks = await TaskService.listTasks(merchant._id, {});
      if (!tasks || tasks.length === 0) {
        const msg = '📝 *Tasks*\n\nNo tasks found. Create tasks from the dashboard, or use the web UI.';
        await this.sendTextMessage(chatId, msg, merchant._id, [[{ text: '◀️ Back', callback_data: 'menu_main' }]]);
        return true;
      }

      let message = `📝 *Tasks*\n\nHere are the most recent tasks:\n\n`;
      tasks.slice(0, 6).forEach((t, i) => {
        message += `${i + 1}\. *${this.escapeMarkdown(t.title || 'Untitled')}*\n   Status: ${t.status || 'pending'}\n   ${t.delivery?.partner ? `Delivery: ${this.escapeMarkdown(t.delivery.partner)}\n` : ''}\n`;
      });

      const keyboard = [
        [ { text: '➕ Create Task (Dashboard)', callback_data: 'menu_main' } ],
        [ { text: '◀️ Back', callback_data: 'menu_main' } ],
      ];

      await this.sendTextMessage(chatId, message, merchant._id, keyboard);
      return true;
    } catch (err) {
      console.error('Error fetching tasks for telegram:', err.message || err);
      await this.sendTextMessage(chatId, `❌ Error loading tasks: ${err.message || err}`, merchant?._id);
      return true;
    }
  }

  async handleBroadcastsCommand(chatId, merchant) {
    const message = `📣 *Broadcasts*\n\nBroadcast campaigns are managed from the dashboard.\n\nThis feature is coming soon in Telegram chat. Use the dashboard to create and schedule broadcasts.`;
    await this.sendTextMessage(chatId, message, merchant?._id, [[{ text: '◀️ Back', callback_data: 'menu_main' }]]);
    return true;
  }

  async handleAlertsCommand(chatId, merchant) {
    const message = `🔔 *Alerts*\n\nStock alerts, birthday alerts and scheduled alerts are managed from the dashboard.\n\nThis feature will be available from chat soon.`;
    await this.sendTextMessage(chatId, message, merchant?._id, [[{ text: '◀️ Back', callback_data: 'menu_main' }]]);
    return true;
  }

  async handleDeliveryCommand(chatId, merchant, args) {
    const rawArgs = (args || '').trim();

    if (!rawArgs) {
      const message = DeliveryPartnerService.buildDeliveryPartnerListMessage();
      const keyboard = [[{ text: '◀️ Back', callback_data: 'menu_main' }]];
      await this.sendTextMessage(chatId, message, merchant?._id, keyboard);
      return true;
    }

    const command = rawArgs.toLowerCase();
    if (!merchant || !merchant._id) {
      await this.sendTextMessage(chatId, '❌ Not linked to a merchant. Use /link <merchantId> to connect.', null);
      return true;
    }

    if (command.startsWith('book')) {
      const parts = rawArgs.slice(4).split('|').map((part) => part.trim()).filter(Boolean);
      const partnerKey = parts[0] || '';
      const pickupLocation = parts[1] || '';
      const address = parts[2] || '';

      if (!partnerKey || !pickupLocation || !address) {
        await this.sendTextMessage(
          chatId,
          `❌ Delivery booking requires partner, pickup location, and delivery address.\nExample:\n/delivery book FastShip Logistics | Warehouse 14, Lagos | Market Stall 17, Lagos`,
          merchant._id,
          [[{ text: '◀️ Back', callback_data: 'delivery_view' }]]
        );
        return true;
      }

      const partner = DeliveryPartnerService.findDeliveryPartner(partnerKey);
      if (!partner) {
        await this.sendTextMessage(
          chatId,
          `❌ Could not find delivery partner matching '${partnerKey}'. Use /delivery to see available partners.`,
          merchant._id,
          [[{ text: '◀️ Back', callback_data: 'delivery_view' }]]
        );
        return true;
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
          bookedVia: 'telegram',
        },
      };

      const task = await TaskService.createTask(merchant._id, taskPayload, false);
      await this.sendTextMessage(
        chatId,
        `✅ Delivery booking created with *${partner.name}*.\nTask ID: ${task.id}.\nPickup: ${pickupLocation}.\nDrop-off: ${address}.\nTrack this booking from your dashboard.`,
        merchant._id,
        [[{ text: '◀️ Back', callback_data: 'menu_main' }]]
      );
      return true;
    }

    await this.sendTextMessage(chatId, DeliveryPartnerService.buildDeliveryPartnerListMessage(), merchant?._id, [[{ text: '◀️ Back', callback_data: 'menu_main' }]]);
    return true;
  }

  async handleInventoryCommand(chatId, merchant, args) {
    if (!merchant) {
      await this.sendTextMessage(chatId, '❌ Not linked to a merchant\\. Use /link to connect\\.', null);
      return true;
    }

    try {
      // Fetch inventory directly from the database to avoid internal auth requirements
      const items = await Inventory.find({ merchantId: merchant._id })
        .select('productName sku quantity price')
        .sort({ createdAt: -1 })
        .lean();

      if (items.length === 0) {
        await this.sendTextMessage(
          chatId,
          `📦 *Inventory*\n\nNo stock items found yet. Add a new item in the dashboard or send a stock update in chat, then come back here to view it.`,
          merchant._id
        );
        return true;
      }

      let message = `📦 *Inventory*\n\nHere is a quick stock summary. Use the buttons below to add a product or refresh the list.\n\nTop items:\\n\\n`;
      items.slice(0, 5).forEach((item, i) => {
        message += `${i + 1}\\. *${this.escapeMarkdown(item.productName)}*\n   SKU: ${this.escapeMarkdown(item.sku)}\n   Qty: ${item.quantity || 0}\n   ₹${item.price || 0}\n\n`;
      });

      message += `_${items.length} total items listed_`;

      const keyboard = [
        [
          { text: '➕ Add Item', callback_data: 'inventory_add' },
          { text: '🔄 Refresh', callback_data: 'inventory_list' },
        ],
        [{ text: '◀️ Back', callback_data: 'menu_main' }],
      ];

      return this.sendTextMessage(chatId, message, merchant._id, keyboard);
    } catch (error) {
      console.error('Error fetching inventory:', error.message);
      await this.sendTextMessage(chatId, `❌ Error loading inventory: ${error.message}`, merchant._id);
      return true;
    }
  }

  async handleLeadsCommand(chatId, merchant, args) {
    if (!merchant) {
      await this.sendTextMessage(chatId, '❌ Not linked to a merchant\\. Use /link to connect\\.', null);
      return true;
    }

    try {
      // Fetch leads directly from the database to avoid internal auth requirements
      const leads = await Contact.find({ merchantId: merchant._id, leadScore: { $gte: 0 } })
        .select('firstName lastName phone email company leadScore status')
        .sort({ leadScore: -1 })
        .limit(50)
        .lean();
      if (leads.length === 0) {
        await this.sendTextMessage(
          chatId,
          `👥 *Customers*\n\nNo customer leads found yet. Add a new customer in the dashboard or send contact details in chat, then return here to view them.`,
          merchant._id
        );
        return true;
      }

      let message = `👥 *Customer Leads*\n\nHere are your recent customer records. Use the buttons below to add a lead or refresh the list.\n\nTop leads:\\n\\n`;
      leads.slice(0, 5).forEach((lead, i) => {
        const score = lead.leadScore || 0;
        const scoreEmoji = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
        message += `${i + 1}\\. ${scoreEmoji} *${this.escapeMarkdown(lead.firstName || '')} ${this.escapeMarkdown(lead.lastName || '')}*\n   ${this.escapeMarkdown(lead.company || 'N/A')}\n   Status: ${this.escapeMarkdown(lead.status || 'New')}\n\n`;
      });

      message += `_${leads.length} total leads_`;

      const keyboard = [
        [
          { text: '➕ Add Lead', callback_data: 'leads_add' },
          { text: '🔄 Refresh', callback_data: 'leads_list' },
        ],
        [{ text: '◀️ Back', callback_data: 'menu_main' }],
      ];

      return this.sendTextMessage(chatId, message, merchant._id, keyboard);
    } catch (error) {
      console.error('Error fetching leads:', error.message);
      await this.sendTextMessage(chatId, `❌ Error loading leads: ${error.message}`, merchant._id);
      return true;
    }
  }

  async handleActivityCommand(chatId, merchant) {
    if (!merchant) {
      await this.sendTextMessage(chatId, '❌ Not linked to a merchant\\. Use /link to connect\\.', null);
      return true;
    }

    try {
      const [recentActivities, stats] = await Promise.all([
        ActivityLog.find({ merchantId: merchant._id })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        ActivityLog.aggregate([
          { $match: { merchantId: merchant._id } },
          { $group: { _id: null, total: { $sum: 1 }, success: { $sum: { $cond: [{ $eq: ['$status', 'Success'] }, 1, 0] } }, failure: { $sum: { $cond: [{ $eq: ['$status', 'Failure'] }, 1, 0] } } } },
        ]),
      ]);

      const activityStats = stats[0] || { total: 0, success: 0, failure: 0 };
      const lines = recentActivities.length > 0
        ? recentActivities.map((activity, index) => {
            const label = activity.action || 'update';
            const status = activity.status || 'Unknown';
            const when = new Date(activity.createdAt).toLocaleString();
            const summary = activity.details && typeof activity.details === 'object'
              ? JSON.stringify(activity.details).slice(0, 80)
              : '';
            return `${index + 1}\\. ${this.escapeMarkdown(label)} • ${this.escapeMarkdown(status)} • ${this.escapeMarkdown(when)}\\n   ${this.escapeMarkdown(summary)}`;
          }).join('\\n\\n')
        : 'No recent activity logged yet\\.';

      const message = `📝 *Recent Activity*

*Summary*
• Total entries: ${activityStats.total}
• Success: ${activityStats.success}
• Failures: ${activityStats.failure}

*Latest updates*
${lines}`;

      const keyboard = [[{ text: '◀️ Back', callback_data: 'menu_main' }]];
      return this.sendTextMessage(chatId, message, merchant._id, keyboard);
    } catch (error) {
      console.error('Error loading activity feed:', error.message);
      await this.sendTextMessage(chatId, `❌ Unable to load activity feed: ${error.message}`, merchant._id);
      return true;
    }
  }

  async handleAnalyticsCommand(chatId, merchant) {
    if (!merchant) {
      await this.sendTextMessage(chatId, '❌ Not linked to a merchant\\. Use /link to connect\\.', null);
      return true;
    }

    try {
      const [inventory, contacts, activityCount] = await Promise.all([
        Inventory.find({ merchantId: merchant._id, status: 'Active' }).select('productName quantity price').lean(),
        Contact.countDocuments({ merchantId: merchant._id }),
        ActivityLog.countDocuments({ merchantId: merchant._id }),
      ]);

      const lowStock = inventory.filter((item) => (item.quantity || 0) < 5);
      const totalValue = inventory.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0);
      const merchantProfile = [merchant.location, merchant.state, merchant.category].filter(Boolean).join(' • ');
      let message = `📊 *Analytics & Insights*

*Merchant profile*
• Name: ${this.escapeMarkdown(merchant.name || 'Unnamed merchant')}
• Location: ${this.escapeMarkdown(merchantProfile || 'Not configured')}
• Inventory items: ${inventory.length}
• Low stock items: ${lowStock.length}
• Estimated stock value: ${this.escapeMarkdown(`₹${totalValue.toLocaleString()}`)}
• Contacts saved: ${contacts}
• Activity entries: ${activityCount}`;

      try {
        const response = await axios.get(
          `${process.env.API_INTERNAL_URL || 'http://localhost:5000'}/api/analytics/insights/${merchant._id}`,
          { headers: { 'X-Internal-Request': 'true' } }
        );

        const data = response.data || {};
        if (data.success) {
          const whatHappened = data.whatHappened || {};
          const whatWillHappen = data.whatWillHappen || {};
          const confirmed = (data.analysis?.confirmedTrends || []).slice(0, 3);
          const actions = (data.analysis?.actionItems || []).slice(0, 3).map((item) => `• ${item.action || 'Review trend data'}${item.reason ? ` (${item.reason})` : ''}`);
          message += `

*Forecast snapshot*
• Confidence: ${whatWillHappen.confidence || 0}%
• What happened: ${this.escapeMarkdown((whatHappened.insight || 'No recent signal').toString())}
• What will happen: ${this.escapeMarkdown((whatWillHappen.insight || 'No forecast yet').toString())}`;

          if (confirmed.length > 0) {
            message += `

*Confirmed trends*\n${confirmed.map((item) => `• ${this.escapeMarkdown(item)}`).join('\n')}`;
          }

          if (actions.length > 0) {
            message += `

*Recommended actions*\n${actions.join('\n')}`;
          }
        }
      } catch (analyticsError) {
        console.warn('Analytics endpoint unavailable for Telegram summary:', analyticsError.message);
        message += `

*Forecast snapshot*
• Confidence: 0%
• What happened: Local activity data is being used until the insights service is fully configured.`;
      }

      const keyboard = [[{ text: '◀️ Back', callback_data: 'menu_main' }]];
      return this.sendTextMessage(chatId, message, merchant._id, keyboard);
    } catch (error) {
      console.error('Error loading analytics:', error.message);
      await this.sendTextMessage(chatId, `❌ Unable to load analytics: ${error.message}`, merchant._id);
      return true;
    }
  }

  async handleSettingsCommand(chatId, merchant) {
    if (!merchant) {
      await this.sendTextMessage(chatId, '❌ Not linked to a merchant\\. Use /link to connect\\.', null);
      return true;
    }

    const whatsappPhone = merchant.whatsappBusinessPhone || process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE || 'Not configured';
    const telegramEnabled = merchant.telegramEnabled !== false;
    const message = `⚙️ *Settings*

*Business profile*
• Name: ${this.escapeMarkdown(merchant.name || 'Unnamed merchant')}
• Address: ${this.escapeMarkdown(merchant.businessAddress || 'Not set')}
• Color: ${this.escapeMarkdown(merchant.receiptColor || '#000000')}
• Business type: ${this.escapeMarkdown(merchant.businessType || 'Retail')}

*Channel configuration*
• Telegram bot: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Missing'}
• Telegram enabled: ${telegramEnabled ? 'Yes' : 'No'}
• Telegram chat ID: ${this.escapeMarkdown(merchant.telegramChatId || 'Not linked')}
• Telegram username: ${this.escapeMarkdown(merchant.telegramBotUsername || 'Not set')}
• WhatsApp number: ${this.escapeMarkdown(whatsappPhone)}
• WhatsApp provider: ${process.env.USE_TWILIO === 'true' ? 'Twilio' : 'Meta Graph API'}
• Docs base URL: ${this.escapeMarkdown(process.env.NGROK_URL ? `https://${process.env.NGROK_URL}` : `http://localhost:${process.env.PORT || 5000}`)}`;

    const keyboard = [
      [{ text: 'ℹ️ Account Info', callback_data: 'settings_info' }],
      [{ text: '🔐 Privacy', callback_data: 'settings_privacy' }],
      [{ text: '◀️ Back', callback_data: 'menu_main' }],
    ];

    return this.sendTextMessage(chatId, message, merchant._id, keyboard);
  }

  async handleLinkCommand(chatId, merchant, merchantId) {
    if (!merchantId) {
      await this.sendTextMessage(
        chatId,
        '❌ Usage: /link <merchantId>\n\nExample: /link 507f1f77bcf86cd799439011',
        null
      );
      return true;
    }

    try {
      // Verify merchant exists
      const foundMerchant = await Merchant.findById(merchantId).lean();
      if (!foundMerchant) {
        await this.sendTextMessage(chatId, `❌ Merchant not found: ${merchantId}`, null);
        return true;
      }

      // Update merchant with telegram chat ID
      await Merchant.findByIdAndUpdate(merchantId, {
        telegramChatId: chatId,
        telegramEnabled: true,
      });

      await this.sendTextMessage(
        chatId,
        `✅ Linked successfully\\! You are now ${this.escapeMarkdown(foundMerchant.name)}\n\nUse /menu to get started\\.`,
        merchantId
      );
      return true;
    } catch (error) {
      console.error('Error linking merchant:', error.message);
      await this.sendTextMessage(chatId, `❌ Error: ${error.message}`, null);
      return true;
    }
  }

  // ============================================
  // CALLBACK QUERY HANDLERS
  // ============================================

  async handleCallbackQuery(callbackQuery, merchant) {
    const chatId = callbackQuery.message?.chat?.id;
    const callbackData = callbackQuery.data;
    const messageId = callbackQuery.message?.message_id;

    if (!chatId || !callbackData) return null;

    console.log(`🎯 Callback: ${callbackData} from chat ${chatId}`);

    // Route callback to handler
    const [action, subaction] = callbackData.split('_');

    try {
      if (action === 'menu' && subaction === 'main') {
        await this.handleMenuCommand(chatId, merchant);
      } else if (action === 'sales' && subaction === 'view') {
        await this.handleSalesCommand(chatId, merchant);
      } else if (action === 'inventory' && subaction === 'list') {
        await this.handleInventoryCommand(chatId, merchant, '');
      } else if (action === 'receipts' && subaction === 'view') {
        await this.handleReceiptsCommand(chatId, merchant);
      } else if (action === 'receipts' && subaction === 'create') {
        await this.setReceiptSession(chatId, merchant?._id, 'receipt_create');
        await this.sendTextMessage(
          chatId,
          `🆕 *Create Receipt*\n\nSend the receipt details in one message and I will generate a PDF and PNG receipt for you.\n\nExample:\nSale of 10 shirts | total: 5000 | note: cash sale`,
          merchant?._id
        );
      } else if (action === 'receipts' && subaction === 'setinfo') {
        await this.setReceiptSession(chatId, merchant?._id, 'receipt_set_info');
        await this.sendTextMessage(
          chatId,
          `⚙️ *Set Business Info*\n\nSend your business info in one message with fields separated by |\nExample:\nMy Shop|12 Market Rd, Lagos|#0077CC\n\nType *cancel* to stop.`,
          merchant?._id
        );
      } else if (action === 'invoices' && subaction === 'view') {
        await this.handleInvoicesCommand(chatId, merchant);
      } else if (action === 'invoices' && subaction === 'create') {
        await this.setReceiptSession(chatId, merchant?._id, 'invoice_create');
        await this.sendTextMessage(
          chatId,
          `🆕 *Create Invoice*\n\nSend the invoice details in one message and I will generate a PDF and PNG invoice for you.\n\nExample:\nCustomer: John Doe | Service: Repair work | total: 5000`,
          merchant?._id
        );
      } else if (action === 'invoices' && subaction === 'setinfo') {
        await this.setReceiptSession(chatId, merchant?._id, 'receipt_set_info');
        await this.sendTextMessage(
          chatId,
          `⚙️ *Set Business Info*\n\nSend your business info in one message with fields separated by |\nExample:\nMy Shop|12 Market Rd, Lagos|#0077CC\n\nType *cancel* to stop.`,
          merchant?._id
        );
      } else if (action === 'payments' && subaction === 'view') {
        await this.handlePaymentsCommand(chatId, merchant);
      } else if (action === 'payments' && subaction === 'send') {
        await this.sendTextMessage(chatId, `Send Payment – Feature Coming Soon.`, merchant?._id, [[{ text: '◀️ Back', callback_data: 'payments_view' }]]);
      } else if (action === 'payments' && subaction === 'receive') {
        // List bank details for merchant and offer manage actions
        if (!merchant || !merchant._id) {
          await this.sendTextMessage(chatId, '❌ Not linked to a merchant. Use /link to connect.', null, [[{ text: '◀️ Back', callback_data: 'menu_main' }]]);
        } else {
          const details = await BankDetail.find({ merchantId: merchant._id }).sort({ createdAt: -1 }).lean();
          if (!details || details.length === 0) {
            await this.sendTextMessage(chatId, '📭 No bank details saved yet. Add one now to receive payments.', merchant._id, [[{ text: '➕ Add Bank Detail', callback_data: 'payments_bank_add' }],[{ text: '◀️ Back', callback_data: 'menu_main' }]]);
          } else {
            // Build a summary message
            let message = `📥 *Receive Payment*\n\nHere are your saved bank details:\n\n`;
            details.slice(0, 8).forEach((d, i) => {
              message += `${i + 1}\. *${this.escapeMarkdown(d.bankName)}*\n   ${this.escapeMarkdown(d.accountName)} – ${this.escapeMarkdown(d.accountNumber)}\n   ${this.escapeMarkdown(d.branch || 'Branch: N/A')}\n\n`;
            });

            // Build keyboard with per-detail actions
            const keyboard = [];
            details.slice(0, 8).forEach((d) => {
              keyboard.push([
                { text: `✏️ Edit ${d.bankName}`, callback_data: `payments_bank_edit_${d._id}` },
                { text: `🗑️ Delete`, callback_data: `payments_bank_delete_${d._id}` },
                { text: `📤 Share`, callback_data: `payments_bank_share_${d._id}` },
              ]);
            });
            keyboard.push([{ text: '➕ Add Bank Detail', callback_data: 'payments_bank_add' }]);
            keyboard.push([{ text: '◀️ Back', callback_data: 'menu_main' }]);

            await this.sendTextMessage(chatId, message, merchant._id, keyboard);
          }
        }
      } else if (callbackData && callbackData.startsWith('payments_bank_')) {
        const parts = callbackData.split('_');
        const op = parts[2];
        const id = parts.slice(3).join('_') || null;
        if (op === 'add') {
          await this.setBankSession(chatId, merchant?._id, { intent: 'bank_add', createdAt: Date.now() });
          await this.sendTextMessage(chatId, `➕ *Add Bank Detail*\n\nSend the bank information in one message using this format:\nBank Name | Account Name | Account Number | Branch(optional) | Currency(optional) | Notes(optional)\n\nType *cancel* to stop.`, merchant?._id, [[{ text: '◀️ Back', callback_data: 'payments_view' }]]);
        } else if (op === 'edit' && id) {
          await this.setBankSession(chatId, merchant?._id, { intent: 'bank_edit', editId: id, createdAt: Date.now() });
          await this.sendTextMessage(chatId, `✏️ *Edit Bank Detail*\n\nSend the updated bank information in one message using this format:\nBank Name | Account Name | Account Number | Branch(optional) | Currency(optional) | Notes(optional)\n\nType *cancel* to stop.`, merchant?._id, [[{ text: '◀️ Back', callback_data: 'payments_view' }]]);
        } else if (op === 'delete' && id) {
          try {
            const deleted = await BankDetail.findOneAndDelete({ _id: id, merchantId: merchant?._id }).lean();
            if (!deleted) {
              await this.sendTextMessage(chatId, '❌ Bank detail not found or already deleted.', merchant?._id, [[{ text: '◀️ Back', callback_data: 'payments_view' }]]);
            } else {
              await ActivityLog.create({ merchantId: merchant?._id, action: 'BANK_DETAIL_DELETED', entityType: 'BankDetail', entityId: deleted._id, details: { accountNumber: deleted.accountNumber }, status: 'Success' });
              await this.sendTextMessage(chatId, `✅ Deleted bank detail: ${this.escapeMarkdown(deleted.bankName)} – ${this.escapeMarkdown(deleted.accountNumber)}`, merchant?._id, [[{ text: '◀️ Back', callback_data: 'payments_view' }]]);
            }
          } catch (err) {
            console.error('Error deleting bank detail from Telegram:', err.message || err);
            await this.sendTextMessage(chatId, `❌ Failed to delete bank detail: ${err.message || err}`, merchant?._id);
          }
        } else if (op === 'share' && id) {
          try {
            const detail = await BankDetail.findOne({ _id: id, merchantId: merchant?._id }).lean();
            if (!detail) {
              await this.sendTextMessage(chatId, '❌ Bank detail not found.', merchant?._id, [[{ text: '◀️ Back', callback_data: 'payments_view' }]]);
            } else {
              const shareMessage = `📤 *Bank Payment Details*\nBank: ${this.escapeMarkdown(detail.bankName)}\nAccount name: ${this.escapeMarkdown(detail.accountName)}\nAccount number: ${this.escapeMarkdown(detail.accountNumber)}\nType: ${this.escapeMarkdown(detail.accountType || 'N/A')}\nBranch: ${this.escapeMarkdown(detail.branch || 'N/A')}\nCurrency: ${this.escapeMarkdown(detail.currency || '')}\n${detail.notes ? `Notes: ${this.escapeMarkdown(detail.notes)}\n` : ''}`;
              await this.sendTextMessage(chatId, shareMessage, merchant?._id, [[{ text: '◀️ Back', callback_data: 'payments_view' }]]);
            }
          } catch (err) {
            console.error('Error sharing bank detail from Telegram:', err.message || err);
            await this.sendTextMessage(chatId, `❌ Failed to prepare share message: ${err.message || err}`, merchant?._id);
          }
        }
      } else if (action === 'inventory' && subaction === 'add') {
        await this.sendTextMessage(
          chatId,
          `📦 *Add New Item*\n\nSend the following in one message:\nproductName, sku, quantity, price\n\nExample: T-Shirt, TSH001, 50, 299`,
          merchant._id
        );
      } else if (action === 'leads' && subaction === 'list') {
        await this.handleLeadsCommand(chatId, merchant, '');
      } else if (action === 'leads' && subaction === 'add') {
        await this.sendTextMessage(
          chatId,
          `👥 *Add New Lead*\n\nSend the following in one message:\nfirstName, lastName, phone, email, company, status\n\nExample: John, Doe, 9999999999, john@example.com, Acme Inc, New`,
          merchant._id
        );
      } else if (action === 'analytics' && subaction === 'view') {
        await this.handleAnalyticsCommand(chatId, merchant);
      } else if (action === 'delivery' && subaction === 'view') {
        await this.handleDeliveryCommand(chatId, merchant, '');
      } else if (action === 'tasks' && subaction === 'view') {
        await this.handleTasksCommand(chatId, merchant);
      } else if (action === 'broadcasts' && subaction === 'view') {
        await this.handleBroadcastsCommand(chatId, merchant);
      } else if (action === 'alerts' && subaction === 'view') {
        await this.handleAlertsCommand(chatId, merchant);
      } else if (action === 'activity' && subaction === 'view') {
        await this.handleActivityCommand(chatId, merchant);
      } else if (action === 'settings' && subaction === 'info') {
        await this.sendTextMessage(
          chatId,
          `🧾 *Account Info*\n\n• Name: ${this.escapeMarkdown(merchant?.name || 'Not configured')}\n• Address: ${this.escapeMarkdown(merchant?.businessAddress || 'Not set')}\n• Business type: ${this.escapeMarkdown(merchant?.businessType || 'Retail')}\n• Phone: ${this.escapeMarkdown(merchant?.phone || merchant?.whatsappBusinessPhone || 'Not configured')}\n• Email: ${this.escapeMarkdown(merchant?.email || 'Not configured')}\n\nUse /settings or the back button to return to the Settings menu.`,
          merchant?._id,
          [[{ text: '◀️ Back', callback_data: 'settings_view' }]]
        );
      } else if (action === 'settings' && subaction === 'privacy') {
        await this.sendTextMessage(
          chatId,
          `🔐 *Privacy & Security*\n\n• Business data is stored securely for merchant operations.\n• Chat transcripts are used only to power your business workflows.\n• We do not share your private data without permission.\n\nUse /settings or the back button to return to the Settings menu.`,
          merchant?._id,
          [[{ text: '◀️ Back', callback_data: 'settings_view' }]]
        );
      } else if (action === 'settings' && subaction === 'view') {
        await this.handleSettingsCommand(chatId, merchant);
      } else if (action === 'help') {
        await this.sendTextMessage(
          chatId,
          `❓ *Help*\n\nThis bot is built for small businesses to record daily sales with text, voice notes, or images, then generate receipts and invoices and track payment updates in one place.\n\n*Easy start for newbies:*\n• Tap *View Inventory* to see stock and update quantities.\n• Tap *View Customers* to see saved leads and customer contacts.\n• Type /inventory or /customers if you prefer commands.\n\n*Available Commands:*\n/menu \- Main menu\n/sales \- Record daily sales and payment updates\n/inventory \- View inventory and stock items\n/stock \- Alias for inventory\n/customers \- Manage customer contacts and leads\n/customer \- Alias for customers\n/receipts \- Log or request receipts\n/invoices \- Create or request invoices\n/payments \- Record payment updates\n/activity \- View recent activity\n/analytics \- View insights\n/settings \- Account settings\n\n*Or* use the buttons below\!`,
          merchant?._id,
          [[{ text: '📋 FisiAI Main Menu', callback_data: 'menu_main' }]]
        );
      }

      // Acknowledge callback
      await this.answerCallbackQuery(callbackQuery.id);
      return true;
    } catch (error) {
      console.error('Error handling callback:', error.message);
      await this.answerCallbackQuery(callbackQuery.id, `❌ Error: ${error.message}`, true);
      return true;
    }
  }

  async answerCallbackQuery(callbackQueryId, text = 'Done', isError = false) {
    if (!this.apiBaseUrl) return { success: false };

    try {
      await axios.post(`${this.apiBaseUrl}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: text || undefined,
        show_alert: isError,
      });
      return { success: true };
    } catch (error) {
      console.error('Error answering callback query:', error.message);
      return { success: false };
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  escapeMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/_/g, '\\_')
      .replace(/\*/g, '\\*')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/\-/g, '\\-')
      .replace(/\=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!');
  }

  detectMainMenuMessage(text) {
    if (!text) return false;
    const normalized = text.toLowerCase().trim();
    const menuTriggers = [
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

    if (menuTriggers.includes(normalized)) {
      return true;
    }

    return /^(menu|help|options|show menu|show options|start|begin|get started)(\s|$)/.test(normalized);
  }

  getMainMenuText() {
    return `🔧 *FisiAI Main Menu*\n\nThis bot is built for small businesses to record day-to-day sales with text, voice notes, or images. Send a sale update, a receipt photo, an invoice request, or a payment note and the AI will save it for you.\n\n1\. Sales – record daily sales, cash received, and customer payments.\n2\. Inventory – view stock, add products, and update quantities.\n3\. Receipts – generate or log receipts from chat text or image uploads.\n4\. Invoices – create or request invoices from customer sales and orders.\n5\. Payments – record payments received and payments made.\n6\. Activity – review recent business records and updates.\n7\. Analytics – see sales and inventory trends.\n8\. Settings – manage your business setup and Telegram connection.\n\nReply with the number or type one of these:\n• sales\n• inventory\n• receipts\n• invoices\n• payments\n• activity\n• analytics\n• settings\n\nExamples:\n• sold 5 shirts today\n• received 2,500\n• paid supplier 3,000\n• photo of receipt\n• photo of invoice\n• voice note: cash sale for 20 bags`;}

  async handleIncomingMessage(message, merchant) {
    const chatId = message.chatId;
    const session = merchant?._id ? await cacheService.getSession(merchant._id, chatId).catch(() => null) : null;

    // Handle an active receipt flow first
    if (message.type === 'text' && message.text && session && await this.handleReceiptSession(message, merchant, session)) {
      return true;
    }

    // Check if this is a command
    if (message.type === 'text' && message.text && message.text.startsWith('/')) {
      return this.handleCommand(message, merchant);
    }

    // If the user is updating business info with a structured message starting with "business info:"
    if (message.type === 'text' && message.text && message.text.toLowerCase().startsWith('business info:')) {
      return this.setBusinessInfoFromText(chatId, message.text, merchant);
    }

    // If the user is creating a receipt with a message starting with "receipt:"
    if (message.type === 'text' && message.text && message.text.toLowerCase().startsWith('receipt:')) {
      return this.createReceiptFromText(chatId, message.text, merchant);
    }

    // If the user is creating an invoice with a message starting with "invoice:"
    if (message.type === 'text' && message.text && message.text.toLowerCase().startsWith('invoice:')) {
      return this.createInvoiceFromText(chatId, message.text, merchant);
    }

    // If user asked for the menu or help keywords, show the main menu
    if (message.type === 'text' && message.text && this.detectMainMenuMessage(message.text)) {
      const menuText = this.getMainMenuText();
      await this.sendTextMessage(chatId, menuText, merchant?._id, [[{ text: '📋 Main Menu', callback_data: 'menu_main' }]]);
      return true;
    }

    // Send any non-command message to the Gemini-powered AI bot, including media
    const isDuplicate = await WhatsAppService.recordProcessedWebhookMessage(message, merchant?._id).catch(() => false);
    if (isDuplicate) {
      return true;
    }

    try {
      const job = await webhookQueue.add('process-webhook-message', {
        merchant,
        messageData: message,
      }, {
        priority: 10,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
      console.log(`✓ Enqueued Telegram AI message job ${job.id} for ${message.from}`);
    } catch (err) {
      console.error('✗ Failed to enqueue Telegram AI message:', err.message || err);
      await this.sendTextMessage(chatId, '⚠️ Sorry, I could not process your message right now. Please try again in a moment.', merchant?._id);
    }
    return true;
  }
}

module.exports = new TelegramService();
