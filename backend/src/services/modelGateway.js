const { GoogleGenAI } = require('@google/genai');
const prompts = require('./promptTemplates');

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

/**
 * Generate a structured response (inventory updates, contacts, reply_text) using Gemini 2.5-Flash.
 * Accepts either a mediaBuffer (base64 inline) or a text transcript or both.
 */
async function generateStructuredResponse({ mediaBuffer = null, mimeType = '', transcript = '', locale = 'en', context = {}, systemInstruction = null } = {}) {
  const finalSystemInstruction = systemInstruction || prompts.getSystemInstruction({ locale, context });
  const model = 'gemini-2.5-flash';

  const contents = [];
  if (mediaBuffer) {
    contents.push({ inlineData: { data: mediaBuffer.toString('base64'), mimeType } });
  }

  if (transcript && transcript.length) {
    contents.push(transcript);
  } else if (!mediaBuffer) {
    contents.push('Please process this input and extract inventory, contact entities and a short reply.');
  } else {
    contents.push('Process attached media and extract inventory, contacts and localized reply.');
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { systemInstruction: finalSystemInstruction, responseMimeType: 'application/json', maxOutputTokens: 1200 }
    });

    // Prefer response.text() when available (some SDKs provide this helper)
    let rawText = '';
    if (response && typeof response.text === 'function') {
      rawText = await response.text();
    } else if (response && response.output_text) {
      rawText = response.output_text;
    } else if (response && response.output && Array.isArray(response.output)) {
      const blocks = response.output.map((item) => {
        if (item && item.content && Array.isArray(item.content)) {
          return item.content
            .map((c) => (typeof c.text === 'string' ? c.text : ''))
            .filter(Boolean)
            .join('\n');
        }
        return '';
      }).filter(Boolean);
      rawText = blocks.join('\n\n');
      if (!rawText) {
        rawText = JSON.stringify(response);
      }
    } else {
      rawText = JSON.stringify(response);
    }

    const json = extractFirstJson(rawText);
    const validated = validateModelOutput(json, rawText);
    return validated;
  } catch (err) {
    return {
      inventory_updates: [],
      extracted_contacts: [],
      reply_text: 'Sorry, I could not process that right now. Please try again later.',
      errors: [{ code: 'model_error', message: String(err) }]
    };
  }
}

function extractFallbackReplyText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const cleaned = rawText.trim();
  if (!cleaned) return '';

  // If the response is plain JSON, attempt to extract the reply_text field.
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.reply_text && typeof parsed.reply_text === 'string' && parsed.reply_text.trim()) {
        return parsed.reply_text.trim();
      }
      if (parsed.replyText && typeof parsed.replyText === 'string' && parsed.replyText.trim()) {
        return parsed.replyText.trim();
      }
      if (parsed.response && typeof parsed.response === 'string' && parsed.response.trim()) {
        return parsed.response.trim();
      }
    } catch {
      // continue to fallback extraction
    }
  }

  const jsonFieldMatch = cleaned.match(/"reply_text"\s*:\s*"([^"]+)"/i);
  if (jsonFieldMatch && jsonFieldMatch[1]) {
    return jsonFieldMatch[1].trim();
  }

  const altFieldMatch = cleaned.match(/"replyText"\s*:\s*"([^"]+)"/i);
  if (altFieldMatch && altFieldMatch[1]) {
    return altFieldMatch[1].trim();
  }

  const responseMatch = cleaned.match(/"response"\s*:\s*"([^"]+)"/i);
  if (responseMatch && responseMatch[1]) {
    return responseMatch[1].trim();
  }

  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return '';

  // Ignore generic fallback lines when a more meaningful first line exists
  const nonGeneric = lines.find(line => !/thank you,? i received your message/i.test(line));
  if (nonGeneric) return nonGeneric;
  return lines[lines.length - 1];
}

function extractFirstJson(text) {
  if (!text || typeof text !== 'string') return null;

  const start = text.indexOf('{');
  if (start === -1) return null;

  let braceCount = 0;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === '{') braceCount += 1;
    if (char === '}') braceCount -= 1;
    if (braceCount === 0) {
      const candidate = text.slice(start, i + 1);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        // try cleaning common issues and continue searching for next object boundary
        try {
          const cleaned = candidate.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
          return JSON.parse(cleaned);
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

function validateModelOutput(obj, rawText = '') {
  if (!obj || typeof obj !== 'object') {
    const fallbackText = extractFallbackReplyText(rawText);
    return {
      inventory_updates: [],
      extracted_contacts: [],
      reply_text: fallbackText || 'Thank you, I received your message and will respond shortly.',
      errors: [{ code: 'invalid_output', message: 'Model did not return valid JSON.' }]
    };
  }

  const inventory_updates = Array.isArray(obj.inventory_updates) ? obj.inventory_updates.map(sanitizeInventory) : [];
  const extracted_contacts = Array.isArray(obj.extracted_contacts) ? obj.extracted_contacts.map(sanitizeContact) : [];
  const financial_transactions = Array.isArray(obj.financial_transactions)
    ? obj.financial_transactions.map(sanitizeFinancialTransaction)
    : [];
  const rawReplyText = typeof obj.reply_text === 'string' ? obj.reply_text.trim() : '';
  const reply_text = rawReplyText || extractFallbackReplyText(rawText) || 'Thank you, I received your message and will respond shortly.';
  const errors = Array.isArray(obj.errors) ? obj.errors : [];

  return { inventory_updates, extracted_contacts, financial_transactions, reply_text, errors };
}

function sanitizeInventory(i) {
  if (!i || typeof i !== 'object') return { name: '', quantity_change: 0, unit: null, confidence: 0 };
  return {
    name: typeof i.name === 'string' ? i.name.trim() : '',
    quantity_change: Number.isFinite(Number(i.quantity_change)) ? Number(i.quantity_change) : 0,
    unit: i.unit || null,
    confidence: clamp(Number(i.confidence), 0, 1)
  };
}

function sanitizeContact(c) {
  if (!c || typeof c !== 'object') return { name: '', phone: '', email: '', role: '', confidence: 0 };
  return {
    name: typeof c.name === 'string' ? c.name.trim() : '',
    phone: typeof c.phone === 'string' ? c.phone.trim() : '',
    email: typeof c.email === 'string' ? c.email.trim() : '',
    role: typeof c.role === 'string' ? c.role.trim() : '',
    confidence: clamp(Number(c.confidence), 0, 1),
  };
}

function sanitizeFinancialTransaction(tx) {
  if (!tx || typeof tx !== 'object') return null;

  return {
    transaction_type: typeof tx.transaction_type === 'string' ? tx.transaction_type.trim() : typeof tx.transactionType === 'string' ? tx.transactionType.trim() : '',
    amount: Number(tx.amount ?? tx.value ?? tx.total ?? 0),
    currency: (tx.currency || 'NGN').toString().trim().toUpperCase(),
    category: (tx.category || tx.expense_category || 'General').toString().trim(),
    payment_method: (tx.payment_method || tx.method || '').toString().trim(),
    vendor: (tx.vendor || tx.payee || tx.supplier || '').toString().trim(),
    customer: (tx.customer || tx.payer || '').toString().trim(),
    description: (tx.description || tx.notes || '').toString().trim(),
    taxable: Boolean(tx.taxable || tx.is_taxable),
    tax_rate: Number(tx.tax_rate ?? tx.taxRate ?? 0) || 0,
    tax_amount: Number(tx.tax_amount ?? tx.taxAmount ?? 0) || 0,
    date: tx.date || null,
  };
}

function clamp(n, min, max) { if (!Number.isFinite(n)) return 0; return Math.max(min, Math.min(max, n)); }

module.exports = { generateStructuredResponse, validateModelOutput };
