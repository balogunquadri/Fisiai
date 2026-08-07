/**
 * CSRF Protection Middleware
 * Implements Cross-Site Request Forgery (CSRF) protection
 */

const crypto = require('crypto');

/**
 * Generate CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware: Create or retrieve CSRF token for session
 */
function csrfProtection(req, res, next) {
  // Generate token on first request or if missing
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }

  // Set token in response header for client to use
  res.set('X-CSRF-Token', req.session.csrfToken);

  // Store token in locals for template rendering
  res.locals.csrfToken = req.session.csrfToken;

  next();
}

/**
 * Middleware: Validate CSRF token on state-changing requests
 * Should only be applied to POST, PUT, PATCH, DELETE endpoints
 */
function validateCSRFToken(req, res, next) {
  // Skip validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip validation for webhook endpoints (they use signature verification instead)
  if (req.path.startsWith('/api/webhooks/')) {
    return next();
  }

  // Skip validation if user is not authenticated
  if (!req.session || !req.session.merchantId) {
    return next();
  }

  // Get token from request (check multiple sources)
  const tokenFromHeader = req.get('X-CSRF-Token');
  const tokenFromBody = req.body?.csrfToken;
  const tokenFromQuery = req.query?.csrfToken;
  const providedToken = tokenFromHeader || tokenFromBody || tokenFromQuery;

  // Get token from session
  const sessionToken = req.session.csrfToken;

  // Validate token exists and matches
  if (!providedToken || !sessionToken || providedToken !== sessionToken) {
    console.warn('[CSRF_VIOLATION]', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      sessionId: req.sessionID,
      tokenProvided: !!providedToken,
      tokenMatches: providedToken === sessionToken,
    });

    return res.status(403).json({
      success: false,
      error: 'CSRF token validation failed',
      code: 'CSRF_INVALID',
    });
  }

  next();
}

/**
 * Add CSRF token to response headers and body
 * Useful for client to include in subsequent requests
 */
function attachCSRFToken(req, res, next) {
  if (res.json) {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Only add CSRF token to authenticated user responses
      if (req.session?.merchantId && req.session?.csrfToken) {
        data.csrfToken = req.session.csrfToken;
      }

      return originalJson(data);
    };
  }

  next();
}

module.exports = {
  generateCSRFToken,
  csrfProtection,
  validateCSRFToken,
  attachCSRFToken,
};
