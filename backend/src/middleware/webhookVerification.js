const crypto = require('crypto');

/**
 * Verify webhook signature from Meta/WhatsApp
 * Ensures the request is actually from Meta
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.get('x-hub-signature-256');
  
  if (!signature) {
    console.warn('⚠ Warning: No signature provided in webhook request');
    return res.status(403).json({ error: 'No signature provided' });
  }

  try {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      console.error('✗ WHATSAPP_APP_SECRET not configured');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    // Meta sends: sha256=<hash>
    const [algorithm, hash] = signature.split('=');
    
    if (algorithm !== 'sha256') {
      return res.status(403).json({ error: 'Invalid signature algorithm' });
    }

    // Recreate the signature
    const body = req.rawBody || req.body;
    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(typeof body === 'string' ? body : JSON.stringify(body))
      .digest('hex');

    if (hash !== expectedHash) {
      console.warn('✗ Signature verification failed');
      return res.status(403).json({ error: 'Signature verification failed' });
    }

    console.log('✓ Webhook signature verified');
    next();
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return res.status(500).json({ error: 'Signature verification error' });
  }
};

module.exports = { verifyWebhookSignature };
