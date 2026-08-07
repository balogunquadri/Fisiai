/**
 * Rate Limiting Middleware
 * Implements rate limiting to prevent brute force attacks and DoS
 */

const rateLimit = require('express-rate-limit');
// Use the library's IPv6-aware IP key generator helper
const ipKeyGenerator = rateLimit.ipKeyGenerator || ((ip) => ip);

/**
 * Auth rate limiter - Strict limits on authentication endpoints
 * 5 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  statusCode: 429,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Rate limit by merchantId when available, otherwise by IP (IPv6-aware)
    if (req.session && req.session.merchantId) return req.session.merchantId.toString();
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ipKeyGenerator(ip);
  },
  skip: (req) => {
    // Skip rate limiting if user is already authenticated
    return req.session && req.session.merchantId;
  },
});

/**
 * API rate limiter - Standard limits on API endpoints
 * 100 requests per minute per IP
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Maximum 100 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ipKeyGenerator(ip);
  },
});

/**
 * Webhook rate limiter - Strict for webhook endpoints
 * 60 requests per minute per IP
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Maximum 60 webhook events per minute
  message: {
    success: false,
    error: 'Webhook rate limit exceeded.',
  },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ipKeyGenerator(ip);
  },
});

/**
 * File upload rate limiter - Moderate limits
 * 20 uploads per hour per user
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Maximum 20 uploads per hour
  message: {
    success: false,
    error: 'File upload limit exceeded. Maximum 20 uploads per hour.',
  },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP (IPv6-aware)
    if (req.session?.merchantId) return req.session.merchantId.toString();
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ipKeyGenerator(ip);
  },
});

/**
 * Create custom rate limiter with specific configuration
 */
function createCustomLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || 100,
    message: options.message || 'Too many requests. Please try again later.',
    statusCode: options.statusCode || 429,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      if (typeof options.keyGenerator === 'function') {
        const key = options.keyGenerator(req);
        // If custom generator returned a value, use it; otherwise fall back to IP
        if (key) return key;
      }
      const ip = req.ip || req.connection?.remoteAddress || '';
      return ipKeyGenerator(ip);
    },
    skip: options.skip,
  });
}

module.exports = {
  authLimiter,
  apiLimiter,
  webhookLimiter,
  uploadLimiter,
  createCustomLimiter,
};
