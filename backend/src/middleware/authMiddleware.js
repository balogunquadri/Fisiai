/**
 * ⚠️ SECURITY: This function was removed as it created an authentication bypass.
 * Any request with X-Internal-Request header could bypass authentication.
 * For internal service calls, use proper API keys instead.
 */

function requireAuth(req, res, next) {
  // Always check session - no bypass allowed
  if (!req.session || !req.session.merchantId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
}

function requireMerchantMatch(req, res, next) {
  // Always check session - no bypass allowed
  if (!req.session || !req.session.merchantId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const { merchantId } = req.params;
  if (merchantId && req.session.merchantId.toString() !== merchantId.toString()) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  next();
}

module.exports = { requireAuth, requireMerchantMatch };