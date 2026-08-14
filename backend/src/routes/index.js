/**
 * API Routes Index
 * Mounts all route modules: webhooks, dashboard, analytics, leads
 */

const webhookRoutes = require('./webhooks');
const dashboardRoutes = require('./dashboard');
const assistantRoutes = require('./assistant');
const adminRoutes = require('./admin');
const analyticsRoutes = require('./analytics');
const leadsRoutes = require('./leads');
const authRoutes = require('./auth');

/**
 * Mount all routes into Express app
 * @param {Express} app - Express application
 */
function mountRoutes(app) {
  console.log('📍 Mounting API routes...');

  // Webhook routes (WhatsApp incoming messages)
  app.use('/api/webhooks', webhookRoutes);
  console.log('  ✓ POST /api/webhooks/whatsapp - WhatsApp webhook');
  console.log('  ✓ GET /api/webhooks/whatsapp - Webhook verification');
  console.log('  ✓ POST /api/webhooks/telegram - Telegram webhook');
  console.log('  ✓ GET /api/webhooks/telegram - Telegram verification');

  // Dashboard routes (merchant telemetry)
  app.use('/api/dashboard', dashboardRoutes);
  console.log('  ✓ GET /api/dashboard/:merchantId - Overview');
  console.log('  ✓ GET /api/dashboard/:merchantId/inventory - Inventory view');
  console.log('  ✓ GET /api/dashboard/:merchantId/leads - Sales pipeline');
  console.log('  ✓ GET /api/dashboard/:merchantId/payments/bank-details - Payment receive details');
  console.log('  ✓ GET /api/dashboard/:merchantId/customers - Customer records');
  console.log('  ✓ GET /api/dashboard/:merchantId/tasks - Task workflow list');
  console.log('  ✓ GET /api/dashboard/:merchantId/activity - Activity log');

  // Website assistant route (Gemini AI widget)
  app.use('/api/assistant', assistantRoutes);
  console.log('  ✓ POST /api/assistant - Website Gemini assistant');

  // Admin routes (admin-only system monitoring)
  app.use('/api/admin', adminRoutes);
  console.log('  ✓ GET /api/admin/status - Admin auth status');
  console.log('  ✓ GET /api/admin/summary - System and signup summary');

  // Analytics routes (trends & forecasts)
  app.use('/api/analytics', analyticsRoutes);
  console.log('  ✓ GET /api/analytics/trends - Historical trends');
  console.log('  ✓ GET /api/analytics/forecast - AI demand forecast');
  console.log('  ✓ GET /api/analytics/insights/:merchantId - Combined insights');
  console.log('  ✓ GET /api/analytics/comparison - Forecast accuracy');

  // Leads routes (scraping & enrichment)
  app.use('/api/leads', leadsRoutes);
  console.log('  ✓ POST /api/leads/scrape - Trigger lead scraping');
  console.log('  ✓ GET /api/leads/status/:jobId - Check scraping status');
  console.log('  ✓ GET /api/leads/scraped/:merchantId - Retrieved scraped leads');

  // Auth / Signup
  app.use('/api', authRoutes);
  console.log('  ✓ POST /api/signup - Create a new merchant account');
  console.log('  ✓ POST /api/signin - Authenticate merchant');
  console.log('  ✓ POST /api/signout - End merchant session');
  console.log('  ✓ GET /api/verify-email - Verify merchant email address');
  console.log('  ✓ POST /api/resend-verification - Resend email verification link');
  console.log('  ✓ POST /api/forgot-password - Request a password reset link');
  console.log('  ✓ POST /api/reset-password - Reset a merchant password');

  console.log('✅ All routes mounted successfully\n');
}

module.exports = { mountRoutes };
