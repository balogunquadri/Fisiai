// src/services/aiAgentService.js
/**
 * AI Agent Service - Processes WhatsApp messages with Google Gemini
 * Handles:
 * - Text & media message parsing
 * - Inventory extraction from unstructured input
 * - Contact harvesting from conversations
 * - Database transactions (inventory updates, contact upserts)
 * - WhatsApp reply generation
 */

const { GoogleGenAI } = require('@google/genai');
const Merchant = require('../models/Merchant');
const Inventory = require('../models/Inventory');
const Contact = require('../models/Contact');
const ChatHistory = require('../models/ChatHistory');
const ActivityLog = require('../models/ActivityLog');
const axios = require('axios');
const WhatsAppService = require('./WhatsAppService');
const TelegramService = require('./TelegramService');
const financialService = require('./financialService');
const cacheService = require('./cacheService');
const batchWriteService = require('./batchWriteService');
const mediaOptimizationService = require('./mediaOptimizationService');
const receiptGenerator = require('./receiptGenerator');
const modelGateway = require('./modelGateway');
const TaskService = require('./taskService');
const DeliveryPartnerService = require('./deliveryPartnerService');

// Initialize Gemini AI
let ai = null;
try {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY not configured in environment');
  }
  ai = new GoogleGenAI({ apiKey: geminiApiKey });
  console.log('✓ Gemini AI initialized');
} catch (err) {
  console.error('✗ Failed to initialize Gemini AI:', err.message);
}

/**
 * Process incoming merchant message from WhatsApp
 * Extracts inventory updates and contacts via Gemini AI
 */
function detectIntent(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (t.startsWith('update stock') || t.includes('update stock') || t.includes('stock update')) return 'update_stock';
  if (t.startsWith('add contact') || t.includes('add contact')) return 'add_contact';
  if (t.includes('generate invoice') || t.includes('create invoice') || t.includes('send invoice') || t.includes('invoice')) return 'generate_invoice';
  if (t.includes('generate receipt') || t.includes('create receipt') || t.includes('send receipt') || t.includes('receipt')) return 'generate_receipt';
  if (t.includes('log receipt') || t.includes('record receipt') || t.includes('receipt log')) return 'log_receipt';
  if (t.includes('show sales') || t.includes('sales report') || t.includes('sales')) return 'show_sales';
  if (t.includes('cash flow') || t.includes('cashflow') || t.includes('cash position') || t.includes('cash balance')) return 'show_cashflow';
  if (t.includes('expense') || t.includes('paid') || t.includes('payment') || t.includes('cost') || t.includes('spent')) return 'record_expense';
  if (t.includes('received') || t.includes('income') || t.includes('got paid') || t.includes('sale')) return 'record_income';
  if (t.includes('cash in') || t.includes('money in') || t.includes('received payment') || t.includes('payment received')) return 'cash_inflow';
  if (t.includes('cash out') || t.includes('money out') || t.includes('payment made') || t.includes('paid out')) return 'cash_outflow';
  if (t.includes('tax entry') || t.includes('record tax') || t.includes('tax payment')) return 'tax_entry';
  if (t.includes('tax') || t.includes('vat') || t.includes('tax due') || t.includes('tax estimate')) return 'tax_query';
  if (t.includes('low stock') || t.includes('what is low stock') || t.includes('low on')) return 'low_stock_query';
  if (t === 'yes' || t === 'ok' || t === 'okay') return 'confirmation';
  return null;
}

function detectMainMenuMessage(text) {
  if (!text) return false;
  const normalized = text.toLowerCase().trim();
  const baseMenuPhrases = [
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

  if (baseMenuPhrases.includes(normalized)) {
    return true;
  }

  if (/^(menu|help|options|show menu|show options|start|begin|get started)(\s|$)/.test(normalized)) {
    return true;
  }

  return false;
}

function getMainMenuText() {
  return `🔧 *FisiAI Main Menu*\n\nThis bot is built for small businesses to record day-to-day sales with text, voice notes, or images, then generate receipts and invoices and track payment updates in one place.\n\n1\. Inventory – view stock, add new items, and update stock levels.\n2\. Leads – save customer contacts and follow-up details.\n3\. Activity – review your recent business records.\n4\. Analytics – see sales and inventory trends.\n5\. Settings – manage your business setup.\n\nReply with the number or the keyword:\n• inventory\n• leads\n• activity\n• analytics\n• settings\n• /delivery\n\nYou can also send sales notes like:\n• sold 5 shirts today\n• received 2,500\n• paid suppliers 3,000\n• photo of invoice 123`; }

function parseDeliveryCommandArgs(text) {
  const parts = text.split(/\s+/).slice(2).join(' ').split('|').map((value) => value.trim()).filter(Boolean);
  return {
    partner: parts[0] || '',
    pickupLocation: parts[1] || '',
    address: parts[2] || '',
  };
}

async function handleDeliveryCommand(merchant, customerPhone, messageData) {
  const rawText = (messageData.text || '').trim();
  const normalized = rawText.toLowerCase();

  if (normalized === '/delivery') {
    const listMessage = DeliveryPartnerService.buildDeliveryPartnerListMessage();
    await sendMessageReply(customerPhone, listMessage, messageData, merchant?._id);
    return true;
  }

  if (normalized.startsWith('/delivery book')) {
    if (!merchant || !merchant._id) {
      await sendMessageReply(customerPhone, '❌ No merchant linked. Use /link to connect your account.', messageData);
      return true;
    }

    const { partner, pickupLocation, address } = parseDeliveryCommandArgs(rawText);
    if (!partner || !pickupLocation || !address) {
      await sendMessageReply(
        customerPhone,
        '❌ Delivery booking must include partner, pickup location, and delivery address.\nExample:\n`/delivery book FastShip Logistics | Warehouse 14, Lagos | Market Stall 17, Lagos`',
        messageData,
        merchant._id
      );
      return true;
    }

    const partnerData = DeliveryPartnerService.findDeliveryPartner(partner);
    if (!partnerData) {
      await sendMessageReply(
        customerPhone,
        `❌ Could not find a delivery partner matching '${partner}'. Reply with /delivery to see available partners.`,
        messageData,
        merchant._id
      );
      return true;
    }

    const taskPayload = {
      title: `Delivery booking with ${partnerData.name}`,
      description: `Book ${partnerData.name} from ${pickupLocation} to ${address}.`,
      delivery: {
        partner: partnerData.name,
        pickupLocation,
        address,
      },
      status: 'pending',
      workflowStage: 'delivery_booking',
      metadata: {
        bookedVia: messageData.source || 'chat',
      },
    };

    const task = await TaskService.createTask(merchant._id, taskPayload, false);
    await sendMessageReply(
      customerPhone,
      `✅ Delivery booking created with *${partnerData.name}*\.\nTask ID: ${task.id}\.\nPickup: ${pickupLocation}\.\nDrop-off: ${address}\.\nYou can track this on the dashboard.`,
      messageData,
      merchant._id
    );
    return true;
  }

  return false;
}

function detectWelcomeMessage(text) {
  if (!text) return false;
  const normalized = text.toLowerCase().trim();
  const starters = ['hi', 'hello', 'hey', 'start', 'menu', 'help', 'welcome'];
  return starters.some((word) => normalized === word || normalized.startsWith(`${word} `));
}

function parseBusinessInfoPayload(text) {
  const payload = text.includes(':') ? text.split(':').slice(1).join(':') : '';
  const parts = payload.split('|').map((part) => part.trim()).filter(Boolean);
  return {
    name: parts[0] || null,
    address: parts[1] || '',
    color: parts[2] || '#000000',
  };
}

async function handleBusinessInfoText(merchant, customerPhone, messageData) {
  const text = (messageData.text || '').trim();
  const { name, address, color } = parseBusinessInfoPayload(text);

  if (!merchant || !merchant._id) {
    await sendMessageReply(customerPhone, '❌ No merchant linked. Use /link to connect your account.', messageData);
    return true;
  }

  await Merchant.findByIdAndUpdate(merchant._id, { name, businessAddress: address, receiptColor: color }, { new: true });
  await cacheService.delSession(merchant._id, customerPhone);
  const replyText = `✅ Business info updated.\nName: ${name || merchant.name}\nAddress: ${address || merchant.businessAddress}\nColor: ${color}`;
  await sendMessageReply(customerPhone, replyText, messageData, merchant._id);
  return true;
}

async function createReceiptFromText(merchant, customerPhone, messageData) {
  const rawText = (messageData.text || '').trim();
  if (!merchant || !merchant._id) {
    await sendMessageReply(customerPhone, '❌ No merchant linked. Use /link to connect your account.', messageData);
    return true;
  }

  const totalMatch = rawText.match(/total\s*[:=]?\s*([\d,\.]+)/i);
  const total = totalMatch ? totalMatch[1] : 'N/A';
  const body = totalMatch ? rawText.replace(totalMatch[0], '').trim() : rawText;
  const safeBody = body || 'Receipt details not provided.';

  const assets = await receiptGenerator.generateReceiptAssets({
    businessName: merchant.name,
    businessAddress: merchant.businessAddress,
    receiptText: safeBody,
    total,
    receiptColor: merchant.receiptColor,
  });

  await sendMessageReply(customerPhone, '✅ Receipt generated. Sending PDF and PNG now...', messageData, merchant._id);

  const pdfResult = await WhatsAppService.sendDocumentAttachment(customerPhone, assets.pdfBuffer, 'receipt.pdf', 'Your receipt PDF', merchant._id);
  if (!pdfResult.success) {
    await sendMessageReply(customerPhone, `⚠️ Receipt PDF could not be sent: ${pdfResult.error}`, messageData, merchant._id);
  }

  const pngResult = await WhatsAppService.sendDocumentAttachment(customerPhone, assets.pngBuffer, 'receipt.png', 'Your receipt image', merchant._id);
  if (!pngResult.success) {
    await sendMessageReply(customerPhone, `⚠️ Receipt PNG could not be sent: ${pngResult.error}`, messageData, merchant._id);
  }

  await cacheService.delSession(merchant._id, customerPhone);
  return true;
}

async function createInvoiceFromText(merchant, customerPhone, messageData) {
  const rawText = (messageData.text || '').trim();
  if (!merchant || !merchant._id) {
    await sendMessageReply(customerPhone, '❌ No merchant linked. Use /link to connect your account.', messageData);
    return true;
  }

  const totalMatch = rawText.match(/total\s*[:=]?\s*([\d,\.]+)/i);
  const total = totalMatch ? totalMatch[1] : 'N/A';
  const body = totalMatch ? rawText.replace(totalMatch[0], '').trim() : rawText;
  const safeBody = body || 'Invoice details not provided.';

  const invoiceNumber = `INV-${Date.now()}`;
  const assets = await receiptGenerator.generateInvoiceAssets({
    businessName: merchant.name,
    businessAddress: merchant.businessAddress,
    invoiceText: safeBody,
    total,
    receiptColor: merchant.receiptColor,
    invoiceNumber,
  });

  await sendMessageReply(customerPhone, '✅ Invoice generated. Sending PDF and PNG now...', messageData, merchant._id);

  const pdfResult = await WhatsAppService.sendDocumentAttachment(customerPhone, assets.pdfBuffer, `${invoiceNumber}.pdf`, 'Your invoice PDF', merchant._id);
  if (!pdfResult.success) {
    await sendMessageReply(customerPhone, `⚠️ Invoice PDF could not be sent: ${pdfResult.error}`, messageData, merchant._id);
  }

  const pngResult = await WhatsAppService.sendDocumentAttachment(customerPhone, assets.pngBuffer, `${invoiceNumber}.png`, 'Your invoice image', merchant._id);
  if (!pngResult.success) {
    await sendMessageReply(customerPhone, `⚠️ Invoice PNG could not be sent: ${pngResult.error}`, messageData, merchant._id);
  }

  await cacheService.delSession(merchant._id, customerPhone);
  return true;
}

async function handleReceiptInvoiceSession(merchant, customerPhone, messageData, session) {
  const text = (messageData.text || '').trim();
  if (!session || !text) return false;
  const lower = text.toLowerCase();

  if (lower === 'cancel') {
    await cacheService.delSession(merchant._id, customerPhone);
    await sendMessageReply(customerPhone, '❌ Workflow cancelled. Use receipts or invoices again to restart.', messageData, merchant._id);
    return true;
  }

  // Handle numeric or title-based replies from interactive options
  if (['1', '2', '3'].includes(lower)) {
    // Map numbers to actions consistent with the interactive options we send
    if (lower === '1') {
      // Set business info
      await cacheService.setSession(merchant._id, customerPhone, { intent: 'business_info', createdAt: Date.now() }, 900);
      await sendMessageReply(customerPhone, 'Please send your business info in one message like:\nbusiness info: My Shop | 123 Market St | #FF6600', messageData, merchant._id);
      return true;
    }

    if (lower === '2') {
      // Create receipt/invoice now -> prompt for details
      const newIntent = session.intent === 'invoice_create' ? 'invoice_create' : 'receipt_create';
      await cacheService.setSession(merchant._id, customerPhone, { intent: newIntent, createdAt: Date.now() }, 900);
      await sendMessageReply(customerPhone, `Send the ${newIntent === 'invoice_create' ? 'invoice' : 'receipt'} details now in one message like:\n${newIntent === 'invoice_create' ? 'invoice:' : 'receipt:'} Customer | items | total: 5000`, messageData, merchant._id);
      return true;
    }

    if (lower === '3') {
      await cacheService.delSession(merchant._id, customerPhone);
      await sendMessageReply(customerPhone, '❌ Workflow cancelled. Use receipts or invoices again to restart.', messageData, merchant._id);
      return true;
    }
  }

  // Also handle title-based replies (e.g., 'Set business info', 'Create receipt now')
  if (lower.includes('business info')) {
    await cacheService.setSession(merchant._id, customerPhone, { intent: 'business_info', createdAt: Date.now() }, 900);
    await sendMessageReply(customerPhone, 'Please send your business info in one message like:\nbusiness info: My Shop | 123 Market St | #FF6600', messageData, merchant._id);
    return true;
  }

  if (lower.includes('create receipt') || (session.intent === 'receipt_create' && lower.startsWith('receipt'))) {
    // If user already provided receipt details, create it; otherwise prompt
    if (lower.startsWith('receipt') || lower.startsWith('receipt:')) {
      return createReceiptFromText(merchant, customerPhone, messageData);
    }
    await cacheService.setSession(merchant._id, customerPhone, { intent: 'receipt_create', createdAt: Date.now() }, 900);
    await sendMessageReply(customerPhone, 'Send your receipt details in one message like:\nreceipt: Sale of 10 shirts | total: 5000', messageData, merchant._id);
    return true;
  }

  if (lower.includes('create invoice') || (session.intent === 'invoice_create' && lower.startsWith('invoice'))) {
    if (lower.startsWith('invoice') || lower.startsWith('invoice:')) {
      return createInvoiceFromText(merchant, customerPhone, messageData);
    }
    await cacheService.setSession(merchant._id, customerPhone, { intent: 'invoice_create', createdAt: Date.now() }, 900);
    await sendMessageReply(customerPhone, 'Send your invoice details in one message like:\ninvoice: Customer name | items | total: 5000', messageData, merchant._id);
    return true;
  }

  if (session.intent === 'business_info') {
    return handleBusinessInfoText(merchant, customerPhone, messageData);
  }

  return false;
}

async function startReceiptInvoiceSession(merchant, customerPhone, messageData, intent) {
  if (!merchant || !merchant._id) {
    await sendMessageReply(customerPhone, '❌ No merchant linked. Use /link to connect your account first.', messageData);
    return true;
  }

  await cacheService.setSession(merchant._id, customerPhone, { intent, createdAt: Date.now() }, 900);
  if (intent === 'receipt_create') {
    await sendMessageReply(customerPhone, '🆕 Receipt creation started. Send your receipt details in one message like:\nreceipt: Sale of 10 shirts | total: 5000', messageData, merchant._id);
    try {
      // Offer interactive buttons on Meta, or a numbered list fallback for Twilio
      const options = [
        { title: 'Set business info' },
        { title: 'Create receipt now' },
        { title: 'Cancel' },
      ];
      await WhatsAppService.sendInteractiveMessage(customerPhone, 'How would you like to proceed with receipts?', options, merchant._id);
    } catch (err) {
      console.warn('⚠ Failed to send interactive receipt options:', err.message || err);
    }
    return true;
  }

  if (intent === 'invoice_create') {
    await sendMessageReply(customerPhone, '🧾 Invoice creation started. Send your invoice details in one message like:\ninvoice: Customer name | service details | total: 5000', messageData, merchant._id);
    try {
      const options = [
        { title: 'Set business info' },
        { title: 'Create invoice now' },
        { title: 'Cancel' },
      ];
      await WhatsAppService.sendInteractiveMessage(customerPhone, 'How would you like to proceed with invoices?', options, merchant._id);
    } catch (err) {
      console.warn('⚠ Failed to send interactive invoice options:', err.message || err);
    }
    return true;
  }

  return false;
}

async function processMerchantMessage(merchant, customerPhone, messageData) {
  try {
    if (!ai) {
      console.error('✗ Gemini AI not initialized, skipping message processing');
      return;
    }

    if (!merchant || !merchant._id) {
      merchant = await WhatsAppService.resolveMerchantFromIncomingMessage(messageData);
    }

    console.log(`\n🤖 Processing message for merchant ${merchant._id} from customer ${customerPhone}...`);

    // Conversation/session handling
    const sessionPhone = customerPhone || messageData.from || 'unknown';
    // Normalize interactive button replies into text for downstream handlers
    try {
      if (messageData.interactive && typeof messageData.interactive === 'object') {
        // Meta button reply shape: { type: 'button_reply', reply: { id, title } }
        const reply = messageData.interactive.reply || messageData.interactive.button || null;
        if (reply) {
          messageData.text = messageData.text || reply.title || reply.id || String(reply);
          console.log(`ℹ Normalized interactive reply to text: ${messageData.text}`);
        }
      }
    } catch (e) {
      // ignore normalization errors
    }
    const session = await cacheService.getSession(merchant._id, sessionPhone).catch(() => null);

    // Deduplicate repeated processing if same message already handled
    if (session && session.lastMessageId && session.lastMessageId === messageData.messageId) {
      console.log(`ℹ Skipping already-processed message ${messageData.messageId} for ${sessionPhone}`);
      return;
    }

    const rawText = (messageData.text || '').trim();
    const normalizedText = rawText.toLowerCase();

    // Receipt / invoice interactive workflow handling
    if (messageData.type === 'text') {
      if (normalizedText.startsWith('business info:') || normalizedText.startsWith('invoice info:')) {
        await handleBusinessInfoText(merchant, customerPhone, messageData);
        return;
      }

      if (normalizedText.startsWith('/delivery')) {
        const handled = await handleDeliveryCommand(merchant, customerPhone, messageData);
        if (handled) {
          return;
        }
      }

      if (session && await handleReceiptInvoiceSession(merchant, customerPhone, messageData, session)) {
        return;
      }

      if (normalizedText === 'receipt' || normalizedText === 'receipts') {
        await startReceiptInvoiceSession(merchant, customerPhone, messageData, 'receipt_create');
        return;
      }

      if (normalizedText === 'invoice' || normalizedText === 'invoices') {
        await startReceiptInvoiceSession(merchant, customerPhone, messageData, 'invoice_create');
        return;
      }

      if (normalizedText.startsWith('receipt:') || normalizedText.startsWith('receipt ')) {
        await createReceiptFromText(merchant, customerPhone, messageData);
        return;
      }

      if (normalizedText.startsWith('invoice:') || normalizedText.startsWith('invoice ')) {
        await createInvoiceFromText(merchant, customerPhone, messageData);
        return;
      }
    }

    if (messageData.type === 'text' && (messageData.source === 'meta' || messageData.source === 'twilio')) {
      const commandHandled = await WhatsAppService.handleTextCommand(customerPhone, messageData.text || '', merchant?._id);
      if (commandHandled) {
        return;
      }
    }

    // Determine if this is a main menu request before running AI
    if (messageData.type === 'text' && detectMainMenuMessage(messageData.text || '')) {
      const menuText = getMainMenuText();
      await sendMessageReply(customerPhone, menuText, messageData, merchant._id);
      batchWriteService.bufferChatMessage(
        merchant._id,
        customerPhone,
        menuText,
        'text',
        'outbound',
        null,
        messageData.source || 'whatsapp',
        messageData.chatId || null,
        messageData.chatUsername || null
      );
      return;
    }

    if (messageData.type === 'text') {
      const taskHandled = await TaskService.processTaskResponseFromText(messageData, merchant._id);
      if (taskHandled) {
        return;
      }
    }

    // Determine if this is a starter/help message before running AI
    if (messageData.type === 'text' && detectWelcomeMessage(messageData.text || '')) {
      const welcomeText = `👋 Welcome to FisiAI for small businesses!\n\nUse this chat to record daily sales with simple text, voice notes, or images. You can log sales, Generate receipts and invoices, and track payment records without opening the dashboard.\n\nExamples:\n• sold 5 shirts today\n• received 2,500\n• voice note for cash sale\n• photo of invoice or receipt\n\nThe app saves your business history so you can manage records in seconds.`;
      await sendMessageReply(customerPhone, welcomeText, messageData, merchant._id);
      batchWriteService.bufferChatMessage(
        merchant._id,
        customerPhone,
        welcomeText,
        'text',
        'outbound',
        null,
        messageData.source || 'whatsapp',
        messageData.chatId || null,
        messageData.chatUsername || null
      );
      return;
    }

    // Determine intent (simple rule-based detect). Reuse existing session intent for short confirmations
    let intent = detectIntent(messageData.text || '');
    if (!intent && session && session.intent && (messageData.text || '').trim().length <= 10) {
      intent = session.intent; // reuse previous intent for short follow-ups
      console.log(`ℹ Reusing session intent: ${intent}`);
    }

    let inputContent = '';
    let mediaBuffer = null;
    let mimeType = '';
    let mediaSource = messageData.source || 'meta';

    // 2. Parse input payload type (Text, Image, Audio, Video, Document)
    if (messageData.type === 'text') {
      inputContent = messageData.text || messageData.body || '';
    } else if (['image', 'audio', 'voice', 'video', 'document'].includes(messageData.type)) {
      console.log(`📸 Processing ${messageData.type} media...`);
      const result = await downloadAndParseMedia(messageData, mediaSource);
      if (result) {
        mediaBuffer = result.buffer;
        mimeType = result.mimeType;
        inputContent = result.text || `[${messageData.type} uploaded]`;
      }
    }

    // 2b. OPTIMIZATION: Check if media processing is needed
    let shouldProcessMedia = true;
    if (mediaBuffer && mimeType) {
      shouldProcessMedia = mediaOptimizationService.shouldProcessMedia(inputContent, mimeType);
      
      if (shouldProcessMedia) {
        // Optimize media before sending to Gemini
        const optimizedBuffer = await mediaOptimizationService.optimizeMedia(
          mediaBuffer,
          mimeType,
          inputContent
        );
        
        if (optimizedBuffer === null) {
          // Media optimization returned null - skip Gemini processing
          console.log(`⊘ Skipping Gemini for non-inventory media`);
          mediaBuffer = null;
          shouldProcessMedia = false;
        } else {
          mediaBuffer = optimizedBuffer;
          const costEst = mediaOptimizationService.estimateTokenCost(mediaBuffer.length);
          console.log(`💰 Estimated token cost: ${costEst.estimatedTokens} tokens (~$${costEst.estimatedCost})`);
        }
      }
    }

    // 4. Configure Gemini with system instructions (include intent)
    const systemInstruction = buildSystemInstruction(merchant, intent);
    const model = 'gemini-2.5-flash';

    console.log(`🧠 Calling Gemini (${model})...`);

    let aiResult = null;

    try {
      if (mediaBuffer) {
        const promptText = inputContent || 'Process this media upload and extract any inventory or contact information.';
        const modelResult = await modelGateway.generateStructuredResponse({
          mediaBuffer,
          mimeType,
          transcript: promptText,
          locale: 'en',
          context: { source: mediaSource, from: customerPhone, intent },
          systemInstruction,
        });
        aiResult = modelResult;
      } else {
        const promptText = inputContent || 'Process this text message and extract any inventory or contact information.';
        const modelResult = await modelGateway.generateStructuredResponse({
          transcript: promptText,
          locale: 'en',
          context: { source: mediaSource, from: customerPhone, intent },
          systemInstruction,
        });
        aiResult = modelResult;
      }

      console.log(`✓ Gemini response received`);
    } catch (err) {
      console.error('✗ Gemini AI error:', err.message);
      aiResult = {
        inventory_updates: [],
        extracted_contacts: [],
        reply_text: 'Sorry, I could not process that right now. Please try again later.',
        errors: [{ code: 'model_error', message: err.message }],
      };
    }

    const hasModelErrors = aiResult && Array.isArray(aiResult.errors) && aiResult.errors.length > 0;
    if (!aiResult || typeof aiResult !== 'object') {
      aiResult = {
        inventory_updates: [],
        extracted_contacts: [],
        reply_text: 'Thank you, I received your message and will respond shortly.',
        errors: [],
      };
    }

    if (hasModelErrors) {
      aiResult.reply_text = typeof aiResult.reply_text === 'string' && aiResult.reply_text.trim()
        ? aiResult.reply_text.trim()
        : 'Sorry, I could not process that right now. Please try again later.';
      console.warn(`⚠ Gemini returned model errors for message ${messageData.messageId || sessionPhone}:`, aiResult.errors.map((e) => e.message || String(e)).join(' | '));
    }

    aiResult.reply_text = typeof aiResult.reply_text === 'string' && aiResult.reply_text.trim()
      ? aiResult.reply_text.trim()
      : 'Thank you, I received your message and will respond shortly.';

    // 5. Save inbound chat log with structured extraction data (BUFFERED)
    batchWriteService.bufferChatMessage(
      merchant._id,
      customerPhone,
      inputContent || `[${messageData.type}]`,
      messageData.type,
      'inbound',
      {
        inventoryUpdates: aiResult.inventory_updates || [],
        extractedContacts: aiResult.extracted_contacts || [],
        invoice: aiResult.invoice || null,
        receipt: aiResult.receipt || null,
      },
      messageData.source || 'whatsapp',
      messageData.chatId || null,
      messageData.chatUsername || null
    );

    // 6. Execute database transactions only for inventory/contact updates
    console.log(`💾 Committing database transactions...`);
    await commitTransactions(merchant._id, aiResult, customerPhone, messageData);

    // 6b. If the intent is invoice or receipt, format the document text for forwarding
    if ((intent === 'generate_invoice' && aiResult.invoice) || (intent === 'generate_receipt' && aiResult.receipt)) {
      aiResult.reply_text = formatDocumentText(intent, aiResult);
    }

    // 7. Send automated reply via WhatsApp
    console.log(`📤 Sending reply to WhatsApp...`);
    const isDocumentIntent = (intent === 'generate_invoice' && aiResult.invoice) || (intent === 'generate_receipt' && aiResult.receipt);

    if (isDocumentIntent && process.env.USE_TWILIO !== 'true') {
      const { buffer, filename } = createDocumentAttachment(intent, aiResult);
      const caption = aiResult.reply_text;
      const docResult = await WhatsAppService.sendDocumentAttachment(customerPhone, buffer, filename, caption, merchant._id);

      if (!docResult.success) {
        console.warn('⚠ Document send failed, falling back to text:', docResult.error);
        await sendWhatsAppReply(customerPhone, aiResult.reply_text);
      }
    } else {
      if (isDocumentIntent && process.env.USE_TWILIO === 'true') {
        console.warn('⚠ Twilio document attachments require a public URL; sending text fallback.');
      }
      await sendMessageReply(customerPhone, aiResult.reply_text, messageData, merchant._id);
    }

    // 10. Save outbound chat log so replies are visible in the inbox
    batchWriteService.bufferChatMessage(
      merchant._id,
      customerPhone,
      aiResult.reply_text,
      'text',
      'outbound',
      null,
      messageData.source || 'whatsapp',
      messageData.chatId || null,
      messageData.chatUsername || null
    );

    // Persist session: last processed message and intent
    try {
      await cacheService.setSession(merchant._id, sessionPhone, {
        intent: intent || null,
        lastMessageId: messageData.messageId,
        updatedAt: new Date().toISOString(),
      });
      console.log(`✓ Session updated for ${sessionPhone} (intent=${intent})`);
    } catch (err) {
      console.warn('⚠ Failed to persist session:', err.message);
    }

    if (hasModelErrors) {
      batchWriteService.bufferActivityLog({
        merchantId: merchant._id,
        action: 'MESSAGE_PROCESSING_ERROR',
        entityType: 'Message',
        entityId: messageData.messageId || sessionPhone,
        details: {
          source: 'whatsapp_chat',
          reply_text: aiResult.reply_text,
          errors: aiResult.errors,
          intent,
        },
        status: 'Failure',
        error: aiResult.errors.map((e) => e.message || String(e)).join(' | '),
      });
      console.warn(`⚠ Message processing completed with errors for ${sessionPhone}`);
    } else {
      console.log(`✅ Message processing complete\n`);
    }

    // Automatic forwarding: if merchant configured, forward a concise record of the inbound message
    try {
      if (merchant && merchant.forwardEnabled) {
        const sourceLabel = (messageData.source || 'chat').toString();
        const forwardContent = (inputContent && inputContent.trim()) || (messageData.text || '').toString() || `[${messageData.type}]`;
        const forwardText = `📨 Forward from ${customerPhone} (${sourceLabel})\n${forwardContent}`;

        if (merchant.forwardTelegramChatId) {
          try {
            await TelegramService.sendTextMessage(merchant.forwardTelegramChatId, forwardText, merchant._id);
            console.log(`✓ Forwarded message to Telegram chat ${merchant.forwardTelegramChatId}`);
          } catch (err) {
            console.warn('⚠ Failed to forward to Telegram:', err.message || err);
          }
        }

        if (merchant.forwardWhatsAppPhone) {
          try {
            const normalized = (merchant.forwardWhatsAppPhone || '').toString().replace(/[^\d\+]/g, '');
            if (normalized) {
              await WhatsAppService.sendTextMessage(normalized, forwardText, merchant._id);
              console.log(`✓ Forwarded message to WhatsApp ${normalized}`);
            }
          } catch (err) {
            console.warn('⚠ Failed to forward to WhatsApp:', err.message || err);
          }
        }
      }
    } catch (err) {
      console.warn('⚠ Error during automatic forwarding:', err.message || err);
    }
  } catch (error) {
    console.error('Error processing merchant message:', error);
    // Log the error but don't throw - we already acknowledged to WhatsApp
    batchWriteService.bufferActivityLog({
      merchantId: null,
      action: 'MESSAGE_PROCESSING_ERROR',
      entityType: 'Message',
      entityId: messageData.messageId || customerPhone,
      details: {
        phone: customerPhone,
        error: error.message,
        messageType: messageData.type,
      },
      ipAddress: 'ai-agent',
      userAgent: 'WhatsApp Bot',
      status: 'Failure',
    });
  }
}

/**
 * Build contextualized system instruction for Gemini
 */
function buildSystemInstruction(merchant, intent) {
  return `You are an AI operations assistant for African informal retail merchants using WhatsApp or Telegram.
The merchant's business: ${merchant.businessType || 'Retail'}
Merchant ID: ${merchant._id}
Current user intent: ${intent || 'general_extraction'}

RULES:
1. If the intent is 'update_stock' only parse inventory update actions and return inventory changes without creating full contact records.
2. If the intent is 'add_contact' prioritize extracting contact details and prepare a single contact upsert.
3. If the intent is 'generate_invoice' or 'generate_receipt', extract or infer order details from the message and prepare a forwardable invoice or receipt summary. If customer details are not provided, ask for them politely.
4. If the intent is 'show_sales' or 'low_stock_query' return a short textual reply describing requested metrics; do not modify inventory.
5. If the message is about cash flow, expense tracking, payments, transfers, or taxes, extract structured financial transactions and tax details using the "financial_transactions" array.
6. If required financial details are missing, do not invent amounts or vendors. Instead provide a best-match result and ask a short follow-up question in reply_text.
7. Extract inventory movements (items sold, restocked, new items) when applicable.
8. Extract contact entities (names, phone numbers, emails, roles) when applicable.
9. Generate a friendly, brief reply in simple English, pidgin, or the merchant's local style.
10. If the request is for an invoice or receipt, return the full invoice/receipt as structured JSON and also set reply_text to a human-readable version that can be forwarded on WhatsApp or Telegram.
11. If no inventory/contacts mentioned, return empty arrays.
12. Always respond with valid JSON ONLY. No markdown, no code blocks.

JSON Format (REQUIRED):
{
  "inventory_updates": [{"name": string, "quantity_change": number}, ...],
  "extracted_contacts": [{"name": string, "phone": string, "email": string, "role": string}, ...],
  "financial_transactions": [{"transaction_type": "income" | "expense" | "transfer" | "tax", "amount": number, "currency": string?, "category": string?, "payment_method": string?, "vendor": string?, "customer": string?, "description": string?, "taxable": boolean?, "tax_rate": number?, "tax_amount": number?, "date": string?}],
  "invoice": {
    "invoice_number": string,
    "date": string,
    "due_date": string,
    "customer_name": string,
    "customer_phone": string,
    "items": [{"name": string, "quantity": number, "unit_price": number, "total_price": number}],
    "subtotal": number,
    "tax": number,
    "total": number,
    "notes": string
  } | null,
  "receipt": {
    "receipt_number": string,
    "date": string,
    "payment_method": string,
    "customer_name": string,
    "customer_phone": string,
    "items": [{"name": string, "quantity": number, "unit_price": number, "total_price": number}],
    "subtotal": number,
    "tax": number,
    "total": number,
    "total_paid": number,
    "change_due": number,
    "notes": string
  } | null,
  "reply_text": string
}`;
}

/**
 * Download and parse media from WhatsApp (Meta or Twilio)
 */
async function downloadAndParseMedia(messageData, source = 'meta') {
  try {
    if (source === 'twilio' && messageData.media && messageData.media.length > 0) {
      // Twilio provides direct URLs
      const media = messageData.media[0];
      console.log(`📥 Downloading Twilio media: ${media.url}`);

      const response = await axios.get(media.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const buffer = Buffer.from(response.data);
      const mimeType = media.contentType || 'application/octet-stream';

      console.log(`✓ Downloaded ${buffer.length} bytes (${mimeType})`);

      return {
        buffer,
        mimeType,
        text: null,
      };
    }

    // Telegram media download
    if (source === 'telegram' && (messageData.image || messageData.document || messageData.audio || messageData.video)) {
      const mediaObj = messageData.image || messageData.document || messageData.audio || messageData.video;
      const mediaId = mediaObj.id;
      const mimeType = mediaObj.mime_type || 'application/octet-stream';

      console.log(`📥 Downloading Telegram media ${mediaId} (${mimeType})`);

      const token = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN;
      if (!token) {
        console.warn('⚠ TELEGRAM_BOT_TOKEN not configured, skipping media download');
        return null;
      }

      const fileRes = await axios.get(
        `https://api.telegram.org/bot${token}/getFile`,
        { params: { file_id: mediaId }, timeout: 30000 }
      );

      const filePath = fileRes.data?.result?.file_path;
      if (!filePath) {
        console.warn('⚠ Telegram getFile returned no file_path', fileRes.data);
        return null;
      }

      const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      const binRes = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const buffer = Buffer.from(binRes.data);
      console.log(`✓ Downloaded ${buffer.length} bytes (${mimeType})`);

      return {
        buffer,
        mimeType,
        text: null,
      };
    }

    // Meta Graph API media download
    if (messageData.image || messageData.document || messageData.audio || messageData.video) {
      const mediaObj = messageData.image || messageData.document || messageData.audio || messageData.video;
      const mediaId = mediaObj.id;
      const mimeType = mediaObj.mime_type || 'application/octet-stream';

      console.log(`📥 Downloading Meta media ${mediaId} (${mimeType})`);

      // Get media URL
      const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
      if (!token) {
        console.warn('⚠ WHATSAPP_ACCESS_TOKEN not configured, skipping media download');
        return null;
      }

      const urlRes = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000,
      });

      // Download binary data
      const binRes = await axios.get(urlRes.data.url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const buffer = Buffer.from(binRes.data);
      console.log(`✓ Downloaded ${buffer.length} bytes (${mimeType})`);

      return {
        buffer,
        mimeType,
        text: null,
      };
    }

    return null;
  } catch (error) {
    console.error('Error downloading media:', error.message);
    return null;
  }
}

/**
 * Commit database transactions for inventory and contacts
 * Uses atomic operators for efficient updates
 */
async function commitTransactions(merchantId, aiResult, phone, messageData) {
  try {
    let inventoryCount = 0;
    let contactCount = 0;

    // Process inventory updates using ATOMIC OPERATORS
    if (aiResult.inventory_updates && Array.isArray(aiResult.inventory_updates)) {
      for (const inv of aiResult.inventory_updates) {
        if (!inv.name || inv.quantity_change === undefined) {
          console.warn(`⚠ Invalid inventory update:`, inv);
          continue;
        }

        try {
          // OPTIMIZATION: Use atomic $inc operator instead of fetch-modify-save
          const result = await Inventory.findOneAndUpdate(
            {
              merchantId,
              productName: new RegExp(`^${inv.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            },
            {
              $inc: { quantity: inv.quantity_change },
              $set: {
                updatedAt: new Date(),
                'aiExtraction.confidence': inv.confidence || 85,
                'aiExtraction.extractedFrom': inv.source || 'text',
                'aiExtraction.lastExtractedAt': new Date(),
              },
              // Ensure quantity never goes below 0
              $max: { quantity: 0 },
            },
            { new: true }
          );

          if (result) {
            console.log(`✓ Updated inventory: ${inv.name} (delta: ${inv.quantity_change}, new qty: ${result.quantity})`);
            inventoryCount++;
          } else {
            try {
              const created = await Inventory.create({
                merchantId,
                productName: inv.name,
                category: 'Misc',
                sku: `whatsapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                quantity: Math.max(inv.quantity_change || 0, 0),
                price: 0,
                cost: 0,
                unit: 'unit',
                status: 'Active',
                aiExtraction: {
                  confidence: inv.confidence || 75,
                  extractedFrom: inv.source || 'text',
                  lastExtractedAt: new Date(),
                },
              });

              console.log(`✓ Created placeholder inventory for extracted item: ${inv.name} (qty: ${created.quantity})`);
              inventoryCount++;
            } catch (createErr) {
              console.error(`Error creating inventory placeholder for "${inv.name}":`, createErr.message);
            }
          }
        } catch (err) {
          console.error(`Error updating inventory "${inv.name}":`, err.message);
        }
      }
    }

    // Process contact extraction with ATOMIC OPERATIONS
    if (aiResult.extracted_contacts && Array.isArray(aiResult.extracted_contacts)) {
      for (const contact of aiResult.extracted_contacts) {
        if (!contact.phone) {
          console.warn(`⚠ Contact without phone:`, contact);
          continue;
        }

        try {
          const [firstName = contact.name || 'Unknown', lastName = ''] = (contact.name || '').split(' ');

          // OPTIMIZATION: Use atomic $inc for interaction count
          const result = await Contact.findOneAndUpdate(
            {
              merchantId,
              phone: contact.phone,
            },
            {
              $set: {
                firstName,
                lastName,
                email: contact.email || '',
                company: contact.role || '',
                phone: contact.phone,
                merchantId,
                source: 'whatsapp_chat',
                lastContactDate: new Date(),
                leadScore: calculateLeadScore(contact.role),
              },
              $inc: { interactionCount: 1 },
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
            }
          );

          console.log(`✓ Upserted contact: ${contact.name || contact.phone}`);
          contactCount++;
        } catch (err) {
          console.error(`Error upserting contact:`, err.message);
        }
      }
    }

    let financialCount = 0;
    if (aiResult.financial_transactions && Array.isArray(aiResult.financial_transactions)) {
      const financialResult = await financialService.recordTransactions(merchantId, { source: messageData.source || 'whatsapp', messageId: messageData.messageId, chatId: messageData.chatId || messageData.recipientChatId, from: messageData.from || messageData.senderPhone, direction: messageData.direction || 'inbound', text: messageData.text || messageData.messageBody }, aiResult.financial_transactions);
      financialCount = financialResult.count || 0;
    }

    // Log transaction summary (BUFFERED)
    if (inventoryCount > 0 || contactCount > 0 || financialCount > 0) {
      batchWriteService.bufferActivityLog({
        merchantId,
        action: 'AI_PROCESSING',
        entityType: 'Message',
        details: {
          source: messageData.source || 'whatsapp',
          inventoryUpdates: inventoryCount,
          contactsExtracted: contactCount,
          financialTransactions: financialCount,
        },
        ipAddress: 'ai-agent',
        userAgent: 'WhatsApp Bot',
        status: 'Success',
      });

      console.log(`📊 Transactions: ${inventoryCount} inventory, ${contactCount} contacts, ${financialCount} financial`);
    }
  } catch (error) {
    console.error('Error committing transactions:', error.message);
    throw error;
  }
}

/**
 * Calculate lead score based on contact role
 * Higher scores = higher priority for follow-up
 */
function calculateLeadScore(role) {
  if (!role) return 30; // Default low score
  const roleWeights = {
    supplier: 85,
    'big buyer': 90,
    'bulk customer': 80,
    retailer: 75,
    distributor: 85,
    'business partner': 70,
    customer: 40,
  };
  return roleWeights[role.toLowerCase()] || 50;
}

function formatCurrency(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '0.00';
  return Number(value).toFixed(2);
}

function formatLineItem(item) {
  const quantity = item.quantity || 1;
  const unitPrice = Number(item.unit_price || item.unitPrice || 0);
  const total = Number(item.total_price || item.totalPrice || quantity * unitPrice);
  return `• ${item.name || 'Item'} — ${quantity} x ${formatCurrency(unitPrice)} = ${formatCurrency(total)}`;
}

function formatInvoiceText(invoice) {
  if (!invoice) return '';

  const lines = [];
  lines.push(`INVOICE #${invoice.invoice_number || invoice.invoiceNumber || 'N/A'}`);
  lines.push(`Date: ${invoice.date || new Date().toISOString().split('T')[0]}`);
  if (invoice.due_date) lines.push(`Due: ${invoice.due_date}`);
  if (invoice.customer_name) lines.push(`Customer: ${invoice.customer_name}`);
  if (invoice.customer_phone) lines.push(`Phone: ${invoice.customer_phone}`);
  lines.push('');
  lines.push('Items:');
  if (Array.isArray(invoice.items) && invoice.items.length > 0) {
    invoice.items.forEach((item) => lines.push(formatLineItem(item)));
  } else {
    lines.push('• No item details available');
  }
  lines.push('');
  lines.push(`Subtotal: ${formatCurrency(invoice.subtotal)}`);
  lines.push(`Tax: ${formatCurrency(invoice.tax)}`);
  lines.push(`Total: ${formatCurrency(invoice.total)}`);
  if (invoice.notes) {
    lines.push('');
    lines.push(`Notes: ${invoice.notes}`);
  }
  lines.push('');
  lines.push('This invoice text can be forwarded on WhatsApp.');
  return lines.join('\n');
}

function formatReceiptText(receipt) {
  if (!receipt) return '';

  const lines = [];
  lines.push(`RECEIPT #${receipt.receipt_number || receipt.receiptNumber || 'N/A'}`);
  lines.push(`Date: ${receipt.date || new Date().toISOString().split('T')[0]}`);
  if (receipt.payment_method) lines.push(`Payment: ${receipt.payment_method}`);
  if (receipt.customer_name) lines.push(`Customer: ${receipt.customer_name}`);
  if (receipt.customer_phone) lines.push(`Phone: ${receipt.customer_phone}`);
  lines.push('');
  lines.push('Items:');
  if (Array.isArray(receipt.items) && receipt.items.length > 0) {
    receipt.items.forEach((item) => lines.push(formatLineItem(item)));
  } else {
    lines.push('• No item details available');
  }
  lines.push('');
  lines.push(`Subtotal: ${formatCurrency(receipt.subtotal)}`);
  lines.push(`Tax: ${formatCurrency(receipt.tax)}`);
  lines.push(`Total: ${formatCurrency(receipt.total)}`);
  if (receipt.total_paid !== undefined) lines.push(`Paid: ${formatCurrency(receipt.total_paid)}`);
  if (receipt.change_due !== undefined) lines.push(`Change due: ${formatCurrency(receipt.change_due)}`);
  if (receipt.notes) {
    lines.push('');
    lines.push(`Notes: ${receipt.notes}`);
  }
  lines.push('');
  lines.push('This receipt text can be forwarded on WhatsApp.');
  return lines.join('\n');
}

function formatDocumentText(intent, aiResult) {
  if (intent === 'generate_invoice' && aiResult.invoice) {
    return formatInvoiceText(aiResult.invoice);
  }
  if (intent === 'generate_receipt' && aiResult.receipt) {
    return formatReceiptText(aiResult.receipt);
  }
  return aiResult.reply_text || 'Here is your document.';
}

function createDocumentAttachment(intent, aiResult) {
  const documentText = intent === 'generate_invoice'
    ? formatInvoiceText(aiResult.invoice)
    : formatReceiptText(aiResult.receipt);

  const safeName = intent === 'generate_invoice' ? 'invoice' : 'receipt';
  const number = intent === 'generate_invoice'
    ? aiResult.invoice?.invoice_number || aiResult.invoice?.invoiceNumber || Date.now()
    : aiResult.receipt?.receipt_number || aiResult.receipt?.receiptNumber || Date.now();

  const filename = `${safeName}-${number}.txt`;
  const buffer = Buffer.from(documentText, 'utf-8');
  return { buffer, filename };
}

/**
 * Send reply via WhatsApp (Twilio or Meta)
 */
async function sendMessageReply(phone, text, messageData, merchantId = null) {
  try {
    const source = messageData?.source || 'whatsapp';

    if (source === 'telegram') {
      const chatId = messageData.chatId || messageData.recipientChatId;
      if (!chatId) {
        throw new Error('Missing Telegram chatId for reply');
      }
      const result = await TelegramService.sendTextMessage(chatId, text, merchantId);
      if (!result.success) {
        throw new Error(result.error);
      }
      console.log(`✓ Reply sent to Telegram chat ${chatId}`);
      return;
    }

    const useTwilio = process.env.USE_TWILIO === 'true';
    if (useTwilio) {
      const result = await WhatsAppService.sendTextMessage(phone, text);
      if (!result.success) {
        throw new Error(result.error);
      }
    } else {
      const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!token || !phoneNumberId) {
        throw new Error('WhatsApp credentials not configured');
      }

      await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: text },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    }

    console.log(`✓ Reply sent to ${phone}`);
  } catch (error) {
    console.error('Error sending reply:', error.message || error);
    throw error;
  }
}

module.exports = {
  processMerchantMessage,
  downloadAndParseMedia,
  commitTransactions,
};
