const axios = require('axios');
const { mediaQueue } = require('../services/queue');
const { connectDB } = require('../db');
const modelGateway = require('../services/modelGateway');
const WhatsAppService = require('../services/WhatsAppService');
const Inventory = require('../models/Inventory');
const Contact = require('../models/Contact');
const ActivityLog = require('../models/ActivityLog');

async function downloadWhatsAppMedia(mediaId) {
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const urlRes = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  const binRes = await axios.get(urlRes.data.url, { headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer' });
  return Buffer.from(binRes.data);
}

async function downloadAttachment(attachment) {
  if (!attachment) return null;
  if (attachment.url) {
    const response = await axios.get(attachment.url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(response.data);
  }
  if (attachment.id) {
    return await downloadWhatsAppMedia(attachment.id);
  }
  return null;
}

function buildContextText(messageData) {
  const parts = [];
  if (messageData.text) {
    parts.push(messageData.text);
  }
  if (messageData.location) {
    const loc = messageData.location;
    parts.push(`Location received: ${loc.latitude || ''}, ${loc.longitude || ''}${loc.name ? ` (${loc.name})` : ''}${loc.address ? `, ${loc.address}` : ''}.`);
  }
  if (messageData.contact) {
    const contact = messageData.contact;
    const formattedName = contact.name?.formatted_name || contact.name?.formattedName || '';
    const phones = (contact.phones || []).map((p) => p.phone || p.value || '').filter(Boolean).join(', ');
    parts.push(`Contact received: ${formattedName}${phones ? `, phones: ${phones}` : ''}.`);
  }
  if (messageData.referral) {
    parts.push(`Referral source: ${messageData.referral.source || 'unknown'}.`);
  }
  if (messageData.interactive) {
    parts.push(`Interactive message payload received.`);
  }
  return parts.join(' ');
}

function normalizeAttachments(messageData) {
  const attachments = [];

  if (Array.isArray(messageData.media)) {
    for (const item of messageData.media) {
      attachments.push({ ...item, type: 'media', source: 'twilio' });
    }
  }

  if (Array.isArray(messageData.mediaAttachments)) {
    for (const item of messageData.mediaAttachments) {
      attachments.push({ ...item, source: 'meta' });
    }
  }

  if (messageData.image) attachments.push({ type: 'image', ...messageData.image, source: 'meta' });
  if (messageData.document) attachments.push({ type: 'document', ...messageData.document, source: 'meta' });
  if (messageData.audio) attachments.push({ type: 'audio', ...messageData.audio, source: 'meta' });
  if (messageData.voice) attachments.push({ type: 'voice', ...messageData.voice, source: 'meta' });
  if (messageData.video) attachments.push({ type: 'video', ...messageData.video, source: 'meta' });

  return attachments;
}

function getAttachmentSummary(attachments) {
  if (!attachments || attachments.length === 0) return '';
  const counts = attachments.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`).join(', ');
}

// Processing handler
mediaQueue.process('process-message', async (job) => {
  const { merchantId, from, messageData } = job.data;
  try {
    const attachments = normalizeAttachments(messageData);
    const contextText = buildContextText(messageData);
    let transcript = contextText;
    let combinedResult = { inventory_updates: [], extracted_contacts: [], reply_text: '', errors: [] };
    const summary = getAttachmentSummary(attachments);

    if (!transcript && attachments.length > 0) {
      transcript = `I received ${summary}. What would you like me to do with it? Please reply with update stock, add contact, show sales, or describe your request.`;
    }

    if (!transcript && messageData.type === 'media') {
      transcript = `I received media. What would you like me to do with it?`;
    }

    // Attach a summary for multiple media payloads
    const extraContext = attachments.length > 1 ? `There are ${attachments.length} attachments: ${summary}.` : '';

    // Process media attachments one by one and merge results
    for (let index = 0; index < Math.max(1, attachments.length); index += 1) {
      const attachment = attachments[index] || null;
      let mediaBuffer = null;
      let mimeType = '';

      if (attachment) {
        mediaBuffer = await downloadAttachment(attachment);
        mimeType = attachment.mime_type || attachment.contentType || attachment.contentType || '';
        if (!transcript.includes(summary)) {
          transcript = `${summary}. ${transcript}`.trim();
        }
      }

      // Use a fallback transcript if no text and only media was received
      const promptText = transcript || 'I received media; what would you like me to do with it?';
      const modelResult = await modelGateway.generateStructuredResponse({ mediaBuffer, mimeType, transcript: `${extraContext} ${promptText}`.trim(), locale: 'en', context: { source: 'whatsapp', from, attachmentType: attachment?.type } });

      combinedResult.inventory_updates.push(...(modelResult.inventory_updates || []));
      combinedResult.extracted_contacts.push(...(modelResult.extracted_contacts || []));
      combinedResult.errors.push(...(modelResult.errors || []));
      if (!combinedResult.reply_text && modelResult.reply_text) {
        combinedResult.reply_text = modelResult.reply_text;
      }
    }

    // If there were no attachments and message contains location or contact, create direct handling
    if (attachments.length === 0 && messageData.contact) {
      const contact = messageData.contact;
      const formattedName = contact.name?.formatted_name || contact.name?.formattedName || '';
      const phones = (contact.phones || []).map((p) => p.phone || p.value || '').filter(Boolean);
      if (phones.length > 0) {
        const names = formattedName.split(' ').filter(Boolean);
        const firstName = names[0] || 'Unknown';
        const lastName = names.slice(1).join(' ') || ' ';
        await Contact.findOneAndUpdate(
          { merchantId, phone: phones[0] },
          { merchantId, firstName, lastName, email: contact.email || '', source: 'whatsapp_contact', notes: contact.address?.street || '' },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        combinedResult.reply_text = combinedResult.reply_text || `I saved contact ${formattedName || phones[0]} for you.`;
      }
    }

    if (attachments.length === 0 && messageData.location && !combinedResult.reply_text) {
      combinedResult.reply_text = `I received the location at ${messageData.location.latitude}, ${messageData.location.longitude}. Let me know if you want to do something with it.`;
    }

    // Ensure we have a reply text
    if (!combinedResult.reply_text) {
      combinedResult.reply_text = attachments.length > 0
        ? `I received ${summary}. Please confirm what you'd like me to do with it.`
        : 'Thanks — I processed your message.';
    }

    // Apply updates conservatively
    const errors = combinedResult.errors || [];

    for (const inv of combinedResult.inventory_updates || []) {
      if (!inv.name) {
        errors.push({ code: 'invalid_inventory', message: 'Empty inventory name' });
        continue;
      }
      const item = await Inventory.findOne({ productName: new RegExp(`^${escapeRegExp(inv.name)}$`, 'i'), merchantId });
      if (item) {
        item.quantity = (item.quantity || 0) + Number(inv.quantity_change || 0);
        await item.save();
      } else {
        errors.push({ code: 'missing_inventory', message: `No matching product for '${inv.name}'` });
      }
    }

    for (const c of combinedResult.extracted_contacts || []) {
      if (!c.phone) {
        errors.push({ code: 'missing_contact_phone', message: `Contact missing phone for ${c.name || 'unknown'}` });
        continue;
      }
      const names = (c.name || '').split(' ').filter(Boolean);
      const firstName = names[0] || 'Unknown';
      const lastName = names.slice(1).join(' ') || ' ';
      await Contact.findOneAndUpdate(
        { merchantId, phone: c.phone },
        { merchantId, firstName, lastName, email: c.email || undefined, source: 'whatsapp_chat', notes: c.role || '' },
        { upsert: true, new: true }
      );
    }

    const reply = combinedResult.reply_text || 'Thanks — I processed your message.';
    try {
      await WhatsAppService.sendTextMessage(from, reply, merchantId);
    } catch (e) {
      console.error('Failed to send WhatsApp reply', e.message || e);
      errors.push({ code: 'send_failed', message: String(e) });
    }

    await ActivityLog.create({ merchantId, action: 'PROCESS', entityType: 'MediaWorker', details: { from, messageType: messageData.type, attachmentSummary: summary, resultSummary: { inventory: (combinedResult.inventory_updates || []).length, contacts: (combinedResult.extracted_contacts || []).length, errors: errors.length } }, status: 'Success' });

    return { success: true, errors };
  } catch (err) {
    console.error('mediaWorker job error', err);
    await ActivityLog.create({ merchantId: merchantId || null, action: 'PROCESS', entityType: 'MediaWorker', details: { from, messageData, error: String(err) }, status: 'Failure' });
    throw err;
  }
});

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const startMediaWorker = async () => {
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.error('✗ mediaWorker aborted: MongoDB connection is required.');
    process.exit(1);
  }

  console.log('Starting mediaWorker...');
};

if (require.main === module) {
  startMediaWorker();
}
