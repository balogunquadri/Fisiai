const express = require('express');
const router = express.Router();
const modelGateway = require('../services/modelGateway');
const prompts = require('../services/promptTemplates');

/**
 * POST /api/assistant
 * Body: { text: string }
 * Returns a Gemini-powered assistant response for the website widget.
 */
router.post('/', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required for assistant queries.' });
    }

    const trimmedText = text.trim();
    const systemInstruction = prompts.getSystemInstruction({
      locale: 'en',
      context: {
        source: 'website',
        channel: 'web',
        purpose: 'gemini_assistant',
      },
    });

    const result = await modelGateway.generateStructuredResponse({
      transcript: trimmedText,
      locale: 'en',
      context: { source: 'website', channel: 'web' },
      systemInstruction,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[ASSISTANT_ERROR]', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, error: 'Failed to generate assistant response.' });
  }
});

module.exports = router;
