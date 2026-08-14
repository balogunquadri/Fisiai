/**
 * Dashboard Routes
 * Merchant telemetry, CRM data, and business analytics
 * GET /api/dashboard/:merchantId - Complete dashboard data
 * GET /api/dashboard/:merchantId/inventory - Inventory snapshot
 * GET /api/dashboard/:merchantId/leads - Sales pipeline view
 * GET /api/dashboard/:merchantId/activity - Processing history
 */

const express = require('express');
const router = express.Router();
const Merchant = require('../models/Merchant');
const Inventory = require('../models/Inventory');
const Contact = require('../models/Contact');
const BankDetail = require('../models/BankDetail');
const ActivityLog = require('../models/ActivityLog');
const ChatHistory = require('../models/ChatHistory');
const JobFailure = require('../models/JobFailure');
const CustomerBroadcastEvent = require('../models/CustomerBroadcastEvent');
const FailureTrackingService = require('../services/failureTrackingService');
const FinancialService = require('../services/financialService');
const TaskService = require('../services/taskService');
const BirthdayAlertService = require('../services/birthdayAlertService');
const WhatsAppService = require('../services/WhatsAppService');
const TelegramService = require('../services/TelegramService');
const DeliveryPartnerService = require('../services/deliveryPartnerService');
const { buildDashboardSummary } = require('../services/dashboardService');
const { requireAuth, requireMerchantMatch } = require('../middleware/authMiddleware');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function personalizeMessage(template, customer) {
  return template
    .replace(/\{\{name\}\}/gi, customer.firstName || 'Friend')
    .replace(/\{\{company\}\}/gi, customer.company || 'there');
}

async function sendCustomerBroadcast(customers, message, merchantId) {
  let sent = 0;
  let failed = 0;
  const details = [];

  for (const customer of customers) {
    const personalisedMessage = message
      .replace(/\{\{name\}\}/gi, customer.firstName || 'Friend')
      .replace(/\{\{company\}\}/gi, customer.company || 'there');
    let delivered = false;

    try {
      if (customer.phone) {
        await WhatsAppService.sendTextMessage(customer.phone.replace(/[^(\+\d)]/g, ''), personalisedMessage, merchantId);
        delivered = true;
      }
      if (customer.metadata?.telegramChatId) {
        await TelegramService.sendTextMessage(customer.metadata.telegramChatId, personalisedMessage, merchantId);
        delivered = true;
      }

      if (delivered) {
        sent += 1;
        details.push({ customerId: customer._id, delivered: true });
      } else {
        failed += 1;
        details.push({ customerId: customer._id, delivered: false, reason: 'No channel available' });
      }
    } catch (error) {
      failed += 1;
      details.push({ customerId: customer._id, delivered: false, reason: error.message || String(error) });
    }
  }

  return { sent, failed, total: customers.length, details };
}

function getNextRunDate(startDate, recurrence) {
  if (!startDate) return null;
  const date = new Date(startDate);
  if (recurrence === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (recurrence === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  }
  return date;
}

router.use(requireAuth);

router.get('/summary', async (req, res) => {
  try {
    const [merchantCount, inventoryCount, contactCount, recentActivity] = await Promise.all([
      Merchant.countDocuments(),
      Inventory.countDocuments(),
      Contact.countDocuments(),
      ActivityLog.find().sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const summary = buildDashboardSummary({
      merchantCount,
      inventoryCount,
      contactCount,
      recentActivity,
    });

    return res.json(summary);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({ error: 'Failed to load dashboard summary' });
  }
});

/**
 * GET /api/dashboard/:merchantId
 * Complete dashboard overview
 */
router.get('/:merchantId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;

    // TODO: Add authentication middleware to verify merchant ownership
    // For now, just validate merchantId format

    // Verify merchant exists
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    console.log(`📊 Fetching dashboard for ${merchant.name}...`);

    // Fetch all dashboard data in parallel
    const [inventory, topLeads, activityLog] = await Promise.all([
      // Inventory snapshot (top 20 items)
      Inventory.find({ merchantId, status: 'Active' })
        .select('productName quantity price unit cost lastRestocked')
        .sort({ quantity: 1 }) // Low stock first
        .limit(20),

      // Top leads (by leadScore)
      Contact.find({ merchantId })
        .select('firstName lastName phone company leadScore lastContactDate conversionValue')
        .where('leadScore').gte(50) // Only qualified leads
        .sort({ leadScore: -1 })
        .limit(15),

      // Activity log (last 50 actions)
      ActivityLog.find({ merchantId })
        .select('action entityType details status createdAt')
        .sort({ createdAt: -1 })
        .limit(50),
    ]);

    // Calculate KPIs
    const lowStockCount = inventory.filter(i => i.quantity < 10).length;
    const totalInventoryValue = inventory.reduce((sum, i) => sum + (i.quantity * i.price), 0);
    const hotLeads = topLeads.filter(l => l.leadScore >= 80).length;
    const recentActivity = activityLog.filter(a => {
      const hourAgo = Date.now() - 3600000;
      return a.createdAt.getTime() > hourAgo;
    }).length;

    console.log(`✓ Dashboard assembled: ${inventory.length} items, ${topLeads.length} leads, ${recentActivity} recent actions`);

    return res.json({
      success: true,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        location: merchant.location,
        category: merchant.category,
        state: merchant.state,
        whatsappBusinessPhone: merchant.whatsappBusinessPhone,
        whatsappBusinessName: merchant.whatsappBusinessName,
        telegramBotUsername: merchant.telegramBotUsername,
        telegramChatId: merchant.telegramChatId,
        receiptColor: merchant.receiptColor,
        receiptColorName: merchant.receiptColorName || null,
      },
      kpis: {
        lowStockCount,
        totalInventoryValue: Math.round(totalInventoryValue),
        hotLeads,
        recentActivity,
      },
      inventory: inventory.map(i => ({
        name: i.productName,
        quantity: i.quantity,
        price: i.price,
        unit: i.unit,
        value: Math.round(i.quantity * i.price),
        status: i.quantity < 5 ? 'critical' : i.quantity < 10 ? 'low' : 'ok',
      })),
      topLeads: topLeads.map(l => ({
        name: `${l.firstName} ${l.lastName}`,
        phone: l.phone,
        role: l.company,
        score: l.leadScore,
        lastContact: l.lastContactDate,
        value: l.conversionValue || 0,
      })),
      activitySummary: {
        totalEvents: activityLog.length,
        lastUpdate: activityLog[0]?.createdAt,
        processingSuccess: activityLog.filter(a => a.status === 'Success').length,
        processingFailure: activityLog.filter(a => a.status === 'Failure').length,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * PUT /api/dashboard/:merchantId/settings
 * Update merchant settings (appearance, receipt color, etc.)
 */
router.put('/:merchantId/settings', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { receiptColor, receiptColorName, businessAddress, name } = req.body || {};

    const update = {};
    if (typeof receiptColor === 'string' && receiptColor.trim()) update.receiptColor = receiptColor.trim();
    if (typeof receiptColorName === 'string' && receiptColorName.trim()) update.receiptColorName = receiptColorName.trim();
    if (typeof businessAddress === 'string') update.businessAddress = businessAddress.trim();
    if (typeof name === 'string') update.name = name.trim();

    if (Object.keys(update).length === 0) return res.status(400).json({ success: false, error: 'No valid settings provided' });

    const merchant = await Merchant.findOneAndUpdate({ _id: merchantId }, update, { new: true });
    if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });

    return res.json({ success: true, merchant: { id: merchant._id, receiptColor: merchant.receiptColor, name: merchant.name, businessAddress: merchant.businessAddress } });
  } catch (error) {
    console.error('Error updating merchant settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * POST /api/dashboard/:merchantId/logo
 * Body: { logoData: 'data:image/png;base64,...' }
 * Stores logo under tmp-docs/uploads and sets merchant.logoUrl to a public /docs path
 */
router.post('/:merchantId/logo', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { logoData } = req.body || {};
    if (!logoData || typeof logoData !== 'string') return res.status(400).json({ success: false, error: 'logoData (data URL) required' });
    // Parse data URL
    const match = logoData.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
    if (!match) return res.status(400).json({ success: false, error: 'Invalid data URL' });

    const inputMime = match[1];
    const inputExt = match[2] === 'jpeg' ? 'jpg' : match[2];
    const b64 = match[3];
    let buffer = Buffer.from(b64, 'base64');

    const MAX_BYTES = 200 * 1024; // 200 KB
    const MAX_WIDTH = 300;
    const MAX_HEIGHT = 150;

    // Attempt to resize/compress when too large or dimensions exceed limits
    try {
      let image = sharp(buffer);
      const meta = await image.metadata().catch(() => ({}));
      const needsResize = (meta.width && meta.width > MAX_WIDTH) || (meta.height && meta.height > MAX_HEIGHT);

      if (needsResize || buffer.length > MAX_BYTES) {
        // Resize to fit within max dimensions
        image = image.resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside' });

        // First try to output PNG to preserve transparency
        let outBuf = await image.png({ compressionLevel: 9 }).toBuffer();

        // If still too large, convert to JPEG with progressively lower quality
        if (outBuf.length > MAX_BYTES) {
          let quality = 80;
          while (quality >= 30) {
            outBuf = await image.jpeg({ quality }).toBuffer();
            if (outBuf.length <= MAX_BYTES) break;
            quality -= 15;
          }
        }

        // If still too large, accept the compressed buffer (best effort)
        buffer = outBuf;
      }
    } catch (err) {
      console.warn('Logo processing failed, using original buffer:', err && err.message ? err.message : err);
    }

    // Ensure target directory exists
    const docsDir = path.resolve(__dirname, '..', '..', 'tmp-docs');
    const uploadsDir = path.join(docsDir, 'uploads');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    // Choose extension based on final buffer (if JPEG header detected, use jpg)
    let finalExt = inputExt;
    try {
      const hdr = buffer.slice(0, 4).toString('hex');
      if (hdr.startsWith('ffd8')) finalExt = 'jpg';
      else if (hdr.startsWith('89504e47')) finalExt = 'png';
      else if (hdr.startsWith('52494646')) finalExt = 'webp';
    } catch (e) {
      /* ignore */
    }

    const filename = `merchant-logo-${merchantId}.${finalExt}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/docs/uploads/${filename}`;
    const merchant = await Merchant.findOneAndUpdate({ _id: merchantId }, { logoUrl: publicUrl }, { new: true });
    if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });

    return res.json({ success: true, logoUrl: publicUrl, size: buffer.length });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return res.status(500).json({ success: false, error: 'Failed to upload logo' });
  }
});

/**
 * DELETE /api/dashboard/:merchantId/logo
 * Remove merchant logo file and clear merchant.logoUrl
 */
router.delete('/:merchantId/logo', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });
    const logoUrl = merchant.logoUrl;
    if (logoUrl && typeof logoUrl === 'string') {
      const docsRoot = path.resolve(__dirname, '..', '..', 'tmp-docs');
      const rel = logoUrl.replace(/^\/docs\//, '');
      const absolute = path.join(docsRoot, rel.replace(/\//g, path.sep));
      try {
        if (fs.existsSync(absolute)) await fs.promises.unlink(absolute);
      } catch (e) {
        console.warn('Failed to delete logo file:', e && e.message ? e.message : e);
      }
    }

    merchant.logoUrl = '';
    await merchant.save();
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting logo:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete logo' });
  }
});

/**
 * GET /api/dashboard/:merchantId/inventory
 * Detailed inventory view with filtering and pagination
 */
router.get('/:merchantId/inventory', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { status = 'Active', sort = 'name', limit = 50, skip = 0 } = req.query;

    const inventory = await Inventory.find({ merchantId, status })
      .select('productName quantity price cost unit aiExtraction lastRestocked')
      .sort(sort === 'low-stock' ? { quantity: 1 } : { productName: 1 })
      .limit(Math.min(parseInt(limit), 500))
      .skip(parseInt(skip));

    const total = await Inventory.countDocuments({ merchantId, status });

    return res.json({
      success: true,
      items: inventory.map(i => ({
        id: i._id,
        name: i.productName,
        quantity: i.quantity,
        price: i.price,
        margin: i.cost ? Math.round(((i.price - i.cost) / i.price) * 100) : null,
        unit: i.unit,
        aiConfidence: i.aiExtraction?.confidence,
        lastRestocked: i.lastRestocked,
      })),
      pagination: {
        total,
        limit: Math.min(parseInt(limit), 500),
        skip: parseInt(skip),
        pages: Math.ceil(total / Math.min(parseInt(limit), 500)),
      },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

/**
 * POST /api/dashboard/:merchantId/inventory
 * Create a new inventory item
 */
router.post('/:merchantId/inventory', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const {
      productName,
      quantity = 0,
      price = 0,
      unit,
      category = 'General',
      sku,
      cost,
      status = 'Active',
      lastRestocked,
    } = req.body;

    if (!productName || typeof productName !== 'string' || !sku || typeof sku !== 'string') {
      return res.status(400).json({ error: 'Product name and SKU are required' });
    }

    const item = await Inventory.create({
      merchantId,
      productName,
      quantity,
      price,
      unit,
      category,
      sku,
      cost,
      status,
      lastRestocked: lastRestocked ? new Date(lastRestocked) : undefined,
    });

    return res.status(201).json({
      success: true,
      item: {
        id: item._id,
        name: item.productName,
        quantity: item.quantity,
        price: item.price,
        margin: item.cost ? Math.round(((item.price - item.cost) / item.price) * 100) : null,
        unit: item.unit,
        aiConfidence: item.aiExtraction?.confidence,
        lastRestocked: item.lastRestocked,
      },
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

/**
 * PUT /api/dashboard/:merchantId/inventory/:itemId
 * Update an inventory item
 */
router.put('/:merchantId/inventory/:itemId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, itemId } = req.params;
    const updateFields = {
      productName: req.body.productName,
      quantity: req.body.quantity,
      price: req.body.price,
      unit: req.body.unit,
      category: req.body.category,
      sku: req.body.sku,
      cost: req.body.cost,
      status: req.body.status,
      lastRestocked: req.body.lastRestocked ? new Date(req.body.lastRestocked) : undefined,
    };

    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] === undefined) {
        delete updateFields[key];
      }
    });

    const item = await Inventory.findOneAndUpdate(
      { _id: itemId, merchantId },
      updateFields,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    return res.json({
      success: true,
      item: {
        id: item._id,
        name: item.productName,
        quantity: item.quantity,
        price: item.price,
        margin: item.cost ? Math.round(((item.price - item.cost) / item.price) * 100) : null,
        unit: item.unit,
        aiConfidence: item.aiExtraction?.confidence,
        lastRestocked: item.lastRestocked,
      },
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

/**
 * DELETE /api/dashboard/:merchantId/inventory/:itemId
 * Delete an inventory item
 */
router.delete('/:merchantId/inventory/:itemId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, itemId } = req.params;
    const deleted = await Inventory.findOneAndDelete({ _id: itemId, merchantId });

    if (!deleted) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    return res.json({ success: true, deletedId: deleted._id });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

/**
 * GET /api/dashboard/:merchantId/leads
 * Sales pipeline view with lead scoring
 */
router.get('/:merchantId/leads', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { minScore = 0, status, limit = 50, skip = 0 } = req.query;

    const query = {
      merchantId,
      leadScore: { $gte: parseInt(minScore) },
    };

    if (status) query.status = status;

    const leads = await Contact.find(query)
      .select('firstName lastName phone email company leadScore interactionCount lastContactDate nextFollowUpDate conversionValue')
      .sort({ leadScore: -1 })
      .limit(Math.min(parseInt(limit), 500))
      .skip(parseInt(skip));

    const total = await Contact.countDocuments(query);

    // Categorize leads
    const categories = {
      hot: leads.filter(l => l.leadScore >= 80).length,
      warm: leads.filter(l => l.leadScore >= 50 && l.leadScore < 80).length,
      cold: leads.filter(l => l.leadScore < 50).length,
    };

    const dueForFollowUp = leads.filter(l => l.nextFollowUpDate && l.nextFollowUpDate <= new Date()).length;

    return res.json({
      success: true,
      leads: leads.map(l => ({
        id: l._id,
        name: `${l.firstName} ${l.lastName}`,
        phone: l.phone,
        email: l.email,
        role: l.company,
        score: l.leadScore,
        scoreColor: l.leadScore >= 80 ? 'green' : l.leadScore >= 50 ? 'yellow' : 'red',
        interactions: l.interactionCount,
        lastContact: l.lastContactDate,
        dueForFollowUp: l.nextFollowUpDate && l.nextFollowUpDate <= new Date(),
        nextFollowUp: l.nextFollowUpDate,
        revenue: l.conversionValue || 0,
      })),
      summary: {
        total,
        hot: categories.hot,
        warm: categories.warm,
        cold: categories.cold,
        dueFollowUp,
      },
      pagination: {
        limit: Math.min(parseInt(limit), 500),
        skip: parseInt(skip),
        pages: Math.ceil(total / Math.min(parseInt(limit), 500)),
      },
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * POST /api/dashboard/:merchantId/leads
 * Create a new contact / lead
 */
router.post('/:merchantId/leads', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const {
      firstName,
      lastName,
      phone,
      email,
      company,
      status = 'Active',
      source = 'Manual',
      notes,
      leadScore = 0,
      nextFollowUpDate,
      conversionValue = 0,
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    const contact = await Contact.create({
      merchantId,
      firstName,
      lastName,
      phone,
      email,
      company,
      status,
      source,
      notes,
      leadScore,
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
      conversionValue,
    });

    return res.status(201).json({
      success: true,
      lead: {
        id: contact._id,
        name: `${contact.firstName} ${contact.lastName}`,
        phone: contact.phone,
        email: contact.email,
        role: contact.company,
        score: contact.leadScore,
        scoreColor: contact.leadScore >= 80 ? 'green' : contact.leadScore >= 50 ? 'yellow' : 'red',
        interactions: contact.interactionCount,
        lastContact: contact.lastContactDate,
        dueForFollowUp: contact.nextFollowUpDate && contact.nextFollowUpDate <= new Date(),
        nextFollowUp: contact.nextFollowUpDate,
        revenue: contact.conversionValue || 0,
      },
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    return res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * PUT /api/dashboard/:merchantId/leads/:leadId
 * Update a contact / lead
 */
router.put('/:merchantId/leads/:leadId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, leadId } = req.params;
    const updateFields = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      email: req.body.email,
      company: req.body.company,
      status: req.body.status,
      source: req.body.source,
      notes: req.body.notes,
      leadScore: req.body.leadScore,
      nextFollowUpDate: req.body.nextFollowUpDate ? new Date(req.body.nextFollowUpDate) : undefined,
      conversionValue: req.body.conversionValue,
    };

    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] === undefined) {
        delete updateFields[key];
      }
    });

    const contact = await Contact.findOneAndUpdate(
      { _id: leadId, merchantId },
      updateFields,
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    return res.json({
      success: true,
      lead: {
        id: contact._id,
        name: `${contact.firstName} ${contact.lastName}`,
        phone: contact.phone,
        email: contact.email,
        role: contact.company,
        score: contact.leadScore,
        scoreColor: contact.leadScore >= 80 ? 'green' : contact.leadScore >= 50 ? 'yellow' : 'red',
        interactions: contact.interactionCount,
        lastContact: contact.lastContactDate,
        dueForFollowUp: contact.nextFollowUpDate && contact.nextFollowUpDate <= new Date(),
        nextFollowUp: contact.nextFollowUpDate,
        revenue: contact.conversionValue || 0,
      },
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    return res.status(500).json({ error: 'Failed to update lead' });
  }
});

/**
 * DELETE /api/dashboard/:merchantId/leads/:leadId
 * Delete a contact / lead
 */
router.delete('/:merchantId/leads/:leadId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, leadId } = req.params;
    const deleted = await Contact.findOneAndDelete({ _id: leadId, merchantId });

    if (!deleted) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    return res.json({ success: true, deletedId: deleted._id });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return res.status(500).json({ error: 'Failed to delete lead' });
  }
});

/**
 * GET /api/dashboard/:merchantId/activity
 * Processing history and audit trail
 */
router.get('/:merchantId/activity', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { action, status, limit = 100, skip = 0 } = req.query;

    const query = { merchantId };
    if (action) query.action = action;
    if (status) query.status = status;

    const activities = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 500))
      .skip(parseInt(skip));

    const total = await ActivityLog.countDocuments(query);

    // Summary stats
    const stats = {
      total,
      byAction: {},
      byStatus: { Success: 0, Failure: 0, Pending: 0 },
    };

    activities.forEach(a => {
      stats.byAction[a.action] = (stats.byAction[a.action] || 0) + 1;
      stats.byStatus[a.status] = (stats.byStatus[a.status] || 0) + 1;
    });

    return res.json({
      success: true,
      activities: activities.map(a => ({
        id: a._id,
        action: a.action,
        entity: a.entityType,
        status: a.status,
        details: a.details,
        timestamp: a.createdAt,
        error: a.error,
      })),
      stats,
      pagination: {
        total,
        limit: Math.min(parseInt(limit), 500),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

/**
 * Customers (Contacts) endpoints
 */
router.get('/:merchantId/customers', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { limit = 100, skip = 0, q } = req.query;

    const query = { merchantId };
    if (q) {
      const re = new RegExp(q.toString().trim(), 'i');
      query.$or = [{ firstName: re }, { lastName: re }, { phone: re }, { email: re }];
    }

    const customers = await Contact.find(query)
      .select('firstName lastName phone email company status tags birthday createdAt')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 1000))
      .skip(parseInt(skip))
      .lean();

    const total = await Contact.countDocuments(query);
    return res.json({ success: true, customers, pagination: { total, limit: Math.min(parseInt(limit), 1000), skip: parseInt(skip) } });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.post('/:merchantId/customers', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const payload = req.body || {};
    const firstName = (payload.firstName || '').toString().trim();
    const lastName = (payload.lastName || '').toString().trim() || ' ';
    const phone = (payload.phone || '').toString().trim();
    const email = (payload.email || '').toString().trim().toLowerCase() || '';
    const company = (payload.company || '').toString().trim() || '';
    const source = payload.source || 'Manual';
    const tags = Array.isArray(payload.tags) ? payload.tags : (payload.tags ? [payload.tags] : []);
    const birthday = payload.birthday ? new Date(payload.birthday) : undefined;

    if (!firstName || !phone) {
      return res.status(400).json({ error: 'firstName and phone are required' });
    }

    const existing = await Contact.findOne({ merchantId, phone }).lean();
    if (existing) {
      return res.status(409).json({ error: 'Customer with this phone already exists', existing });
    }

    const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
    const created = await Contact.create({
      merchantId,
      firstName,
      lastName,
      phone,
      email,
      company,
      source,
      tags,
      birthday,
      metadata,
      status: payload.status || 'Active',
    });

    return res.json({ success: true, customer: created });
  } catch (error) {
    console.error('Error creating customer:', error);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
});

router.patch('/:merchantId/customers/:customerId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, customerId } = req.params;
    const updates = req.body || {};
    if (updates.birthday) updates.birthday = new Date(updates.birthday);

    const customer = await Contact.findOneAndUpdate({ _id: customerId, merchantId }, { $set: updates }, { new: true }).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    return res.json({ success: true, customer });
  } catch (error) {
    console.error('Error updating customer:', error);
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

router.delete('/:merchantId/customers/:customerId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, customerId } = req.params;
    const deleted = await Contact.findOneAndDelete({ _id: customerId, merchantId }).lean();
    if (!deleted) return res.status(404).json({ error: 'Customer not found' });
    return res.json({ success: true, deletedId: deleted._id });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return res.status(500).json({ error: 'Failed to delete customer' });
  }
});

/**
 * Send a survey link to a customer via WhatsApp or Telegram
 * POST /api/dashboard/:merchantId/customers/:customerId/send-survey
 * Body: { surveyUrl }
 */
router.post('/:merchantId/customers/:customerId/send-survey', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, customerId } = req.params;
    const { surveyUrl } = req.body || {};
    if (!surveyUrl) return res.status(400).json({ error: 'surveyUrl is required' });

    const customer = await Contact.findOne({ _id: customerId, merchantId }).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const message = `Hi ${customer.firstName}, please fill this short survey: ${surveyUrl}`;

    // Prefer WhatsApp if phone present
    if (customer.phone) {
      await WhatsAppService.sendTextMessage(customer.phone.replace(/[^\d+]/g, ''), message, merchantId);
    }
    // Also attempt Telegram if chat id present in metadata
    if (customer.metadata && customer.metadata.telegramChatId) {
      await TelegramService.sendTextMessage(customer.metadata.telegramChatId, message, merchantId);
    }

    await ActivityLog.create({ merchantId, action: 'SURVEY_SENT', entityType: 'Contact', entityId: customerId, details: { surveyUrl, customer }, status: 'Success' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error sending survey:', error);
    return res.status(500).json({ error: 'Failed to send survey' });
  }
});

/**
 * GET /api/dashboard/:merchantId/payments/bank-details
 * List stored bank details for receive payments
 */
router.get('/:merchantId/payments/bank-details', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const details = await BankDetail.find({ merchantId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, bankDetails: details });
  } catch (error) {
    console.error('Error fetching bank details:', error);
    return res.status(500).json({ error: 'Failed to fetch bank details' });
  }
});

/**
 * POST /api/dashboard/:merchantId/payments/bank-details
 * Add a new bank detail record
 */
router.post('/:merchantId/payments/bank-details', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const {
      bankName,
      accountName,
      accountNumber,
      accountType = 'Current',
      branch = '',
      currency = 'NGN',
      notes = '',
      isPrimary = false,
    } = req.body;

    if (!bankName || !accountName || !accountNumber) {
      return res.status(400).json({ error: 'bankName, accountName, and accountNumber are required' });
    }

    const created = await BankDetail.create({
      merchantId,
      bankName,
      accountName,
      accountNumber,
      accountType,
      branch,
      currency,
      notes,
      isPrimary,
    });

    await ActivityLog.create({ merchantId, action: 'BANK_DETAIL_ADDED', entityType: 'BankDetail', entityId: created._id, details: { bankName, accountNumber }, status: 'Success' });
    return res.json({ success: true, bankDetail: created });
  } catch (error) {
    console.error('Error adding bank detail:', error);
    return res.status(500).json({ error: 'Failed to add bank detail' });
  }
});

/**
 * PATCH /api/dashboard/:merchantId/payments/bank-details/:detailId
 * Update existing bank detail record
 */
router.patch('/:merchantId/payments/bank-details/:detailId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, detailId } = req.params;
    const updates = req.body || {};

    const bankDetail = await BankDetail.findOneAndUpdate({ _id: detailId, merchantId }, { $set: updates }, { new: true }).lean();
    if (!bankDetail) {
      return res.status(404).json({ error: 'Bank detail not found' });
    }

    await ActivityLog.create({ merchantId, action: 'BANK_DETAIL_UPDATED', entityType: 'BankDetail', entityId: bankDetail._id, details: updates, status: 'Success' });
    return res.json({ success: true, bankDetail });
  } catch (error) {
    console.error('Error updating bank detail:', error);
    return res.status(500).json({ error: 'Failed to update bank detail' });
  }
});

/**
 * DELETE /api/dashboard/:merchantId/payments/bank-details/:detailId
 * Remove a bank detail record
 */
router.delete('/:merchantId/payments/bank-details/:detailId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, detailId } = req.params;
    const deleted = await BankDetail.findOneAndDelete({ _id: detailId, merchantId }).lean();
    if (!deleted) {
      return res.status(404).json({ error: 'Bank detail not found' });
    }

    await ActivityLog.create({ merchantId, action: 'BANK_DETAIL_DELETED', entityType: 'BankDetail', entityId: deleted._id, details: { accountNumber: deleted.accountNumber }, status: 'Success' });
    return res.json({ success: true, deletedId: deleted._id });
  } catch (error) {
    console.error('Error deleting bank detail:', error);
    return res.status(500).json({ error: 'Failed to delete bank detail' });
  }
});

/**
 * POST /api/dashboard/:merchantId/payments/bank-details/:detailId/share
 * Share bank detail via WhatsApp or Telegram
 */
router.post('/:merchantId/payments/bank-details/:detailId/share', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, detailId } = req.params;
    const { channel, recipientPhone, recipientChatId } = req.body || {};
    const bankDetail = await BankDetail.findOne({ _id: detailId, merchantId }).lean();
    if (!bankDetail) {
      return res.status(404).json({ error: 'Bank detail not found' });
    }

    const message = `📤 Bank payment details:\nBank: ${bankDetail.bankName}\nAccount name: ${bankDetail.accountName}\nAccount number: ${bankDetail.accountNumber}\nType: ${bankDetail.accountType}\nBranch: ${bankDetail.branch || 'N/A'}\nCurrency: ${bankDetail.currency}\n${bankDetail.notes ? `Notes: ${bankDetail.notes}\n` : ''}`;

    if (channel === 'whatsapp') {
      if (!recipientPhone) {
        return res.status(400).json({ error: 'recipientPhone is required for WhatsApp sharing' });
      }
      await WhatsAppService.sendTextMessage(recipientPhone.replace(/[^\d+]/g, ''), message, merchantId);
    } else if (channel === 'telegram') {
      if (!recipientChatId) {
        return res.status(400).json({ error: 'recipientChatId is required for Telegram sharing' });
      }
      await TelegramService.sendTextMessage(recipientChatId, message, merchantId);
    } else {
      return res.status(400).json({ error: 'Unsupported channel; use whatsapp or telegram' });
    }

    await ActivityLog.create({ merchantId, action: 'BANK_DETAIL_SHARED', entityType: 'BankDetail', entityId: bankDetail._id, details: { channel, recipientPhone, recipientChatId }, status: 'Success' });
    return res.json({ success: true, bankDetail });
  } catch (error) {
    console.error('Error sharing bank detail:', error);
    return res.status(500).json({ error: 'Failed to share bank detail' });
  }
});

router.post('/:merchantId/customers/survey-response', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const payload = req.body || {};
    const phone = (payload.phone || '').toString().trim();
    const firstName = (payload.firstName || '').toString().trim();
    const lastName = (payload.lastName || '').toString().trim() || ' ';
    const email = (payload.email || '').toString().trim().toLowerCase() || '';
    const company = (payload.company || '').toString().trim() || '';
    const birthday = payload.birthday ? new Date(payload.birthday) : undefined;
    const tags = Array.isArray(payload.tags) ? payload.tags : payload.tags ? [payload.tags.toString()] : [];
    const notes = (payload.notes || '').toString().trim();

    if (!phone || !firstName) {
      return res.status(400).json({ error: 'phone and firstName are required' });
    }

    const update = {
      firstName,
      lastName,
      email,
      company,
      birthday,
      tags,
      notes,
      source: 'Survey',
    };

    const customer = await Contact.findOneAndUpdate(
      { merchantId, phone },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    await ActivityLog.create({
      merchantId,
      action: 'SURVEY_RESPONSE_RECEIVED',
      entityType: 'Contact',
      entityId: customer._id,
      details: { payload },
      status: 'Success',
    });

    return res.json({ success: true, customer });
  } catch (error) {
    console.error('Error saving survey response:', error);
    return res.status(500).json({ error: 'Failed to save survey response' });
  }
});

/**
 * POST /api/dashboard/:merchantId/customers/send-birthday-alerts
 * Send birthday greetings to customers whose birthday is today (or for provided date)
 * Body optional: { date: 'YYYY-MM-DD' }
 */
router.post('/:merchantId/customers/send-birthday-alerts', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const dateParam = req.body?.date ? new Date(req.body.date) : new Date();
    const result = await BirthdayAlertService.sendBirthdayAlerts(merchantId, dateParam);
    return res.json({ success: true, count: result.sent, matches: result.total });
  } catch (error) {
    console.error('Error sending birthday alerts:', error);
    return res.status(500).json({ error: 'Failed to send birthday alerts' });
  }
});

/**
 * POST /api/dashboard/:merchantId/customers/broadcast
 * Send a personalized broadcast to customers over WhatsApp and Telegram.
 * Body: { message, customerIds?, tags?, status? }
 */
router.post('/:merchantId/customers/broadcast', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { message, customerIds, tags, status } = req.body || {};
    if (!message || !message.toString().trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const query = { merchantId };
    if (Array.isArray(customerIds) && customerIds.length > 0) {
      query._id = { $in: customerIds };
    }
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.toString().split(',').map((tag) => tag.trim()).filter(Boolean);
      if (tagList.length > 0) {
        query.tags = { $in: tagList };
      }
    }
    if (status) {
      query.status = status;
    }

    const customers = await Contact.find(query).lean();
    if (!customers.length) {
      return res.status(200).json({ success: true, sent: 0, failed: 0, message: 'No matching customers found.' });
    }

    const personalize = (template, customer) =>
      template
        .replace(/\{\{name\}\}/gi, customer.firstName || 'Friend')
        .replace(/\{\{company\}\}/gi, customer.company || 'there');

    let sent = 0;
    let failed = 0;

    for (const customer of customers) {
      const personalizedMessage = personalize(message, customer);
      let delivered = false;
      try {
        if (customer.phone) {
          await WhatsAppService.sendTextMessage(customer.phone.replace(/[^(\+\d)]/g, ''), personalizedMessage, merchantId);
          delivered = true;
        }
        if (customer.metadata?.telegramChatId) {
          await TelegramService.sendTextMessage(customer.metadata.telegramChatId, personalizedMessage, merchantId);
          delivered = true;
        }
        if (delivered) {
          sent += 1;
        } else {
          failed += 1;
        }
      } catch (error) {
        failed += 1;
        console.error('Customer broadcast failed:', error.message || error);
      }
    }

    await ActivityLog.create({
      merchantId,
      action: 'CUSTOMER_BROADCAST',
      entityType: 'Contact',
      details: { total: customers.length, sent, failed },
      status: 'Success',
    });

    return res.json({ success: true, total: customers.length, sent, failed });
  } catch (error) {
    console.error('Error broadcasting to customers:', error);
    return res.status(500).json({ error: 'Failed to broadcast message to customers' });
  }
});

/**
 * GET /api/dashboard/:merchantId/customers/broadcast-events
 * List saved customer broadcast events for the merchant
 */
router.get('/:merchantId/customers/broadcast-events', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const events = await CustomerBroadcastEvent.find({ merchantId }).sort({ nextRunAt: 1, createdAt: -1 }).lean();
    return res.json({ success: true, events });
  } catch (error) {
    console.error('Error fetching broadcast events:', error);
    return res.status(500).json({ error: 'Failed to load broadcast events' });
  }
});

/**
 * POST /api/dashboard/:merchantId/customers/broadcast-event
 * Create a customer broadcast event and optionally send immediately if scheduled date has arrived
 */
router.post('/:merchantId/customers/broadcast-event', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const {
      name,
      message,
      customerIds,
      tags,
      status,
      scheduledAt,
      recurrence = 'none',
    } = req.body || {};

    if (!message || !message.toString().trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const query = { merchantId };
    if (Array.isArray(customerIds) && customerIds.length > 0) {
      query._id = { $in: customerIds };
    }
    if (tags && tags.length > 0) {
      query.tags = { $in: Array.isArray(tags) ? tags : tags.toString().split(',').map((tag) => tag.trim()).filter(Boolean) };
    }
    if (status && status !== 'Any') {
      query.status = status;
    }

    const customers = await Contact.find(query).lean();
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const broadcastEvent = await CustomerBroadcastEvent.create({
      merchantId,
      name: name?.toString().trim() || 'Customer Broadcast',
      message: message.toString().trim(),
      customerIds: Array.isArray(customerIds) ? customerIds : [],
      tags: Array.isArray(tags) ? tags : tags ? tags.toString().split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      status: status || 'Any',
      scheduledAt: scheduledDate,
      recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : 'none',
      nextRunAt: scheduledDate,
      active: true,
    });

    let broadcastResult = null;
    if (scheduledDate <= new Date() && customers.length > 0) {
      broadcastResult = await sendCustomerBroadcast(customers, message.toString().trim(), merchantId);
      broadcastEvent.lastRunAt = new Date();
      if (broadcastEvent.recurrence === 'none') {
        broadcastEvent.active = false;
      } else {
        broadcastEvent.nextRunAt = getNextRunDate(scheduledDate, broadcastEvent.recurrence);
      }
      await broadcastEvent.save();
    }

    await ActivityLog.create({
      merchantId,
      action: 'CUSTOMER_BROADCAST_EVENT_CREATED',
      entityType: 'CustomerBroadcastEvent',
      entityId: broadcastEvent._id,
      details: { name: broadcastEvent.name, scheduledAt: broadcastEvent.scheduledAt, recurrence: broadcastEvent.recurrence },
      status: 'Success',
    });

    return res.json({ success: true, event: broadcastEvent, broadcastResult });
  } catch (error) {
    console.error('Error creating broadcast event:', error);
    return res.status(500).json({ error: 'Failed to create broadcast event' });
  }
});

/**
 * GET /api/dashboard/:merchantId/chat
 * WhatsApp inbox / chat history for the merchant
 */
router.get('/:merchantId/chat', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { direction, senderPhone, limit = 50, skip = 0 } = req.query;

    const query = { merchantId };
    if (direction) query.direction = direction;
    if (senderPhone) query.senderPhone = senderPhone;

    const messages = await ChatHistory.find(query)
      .select('senderPhone chatId chatUsername source messageBody mediaType direction status createdAt aiExtractedData')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 200))
      .skip(parseInt(skip))
      .lean();

    const total = await ChatHistory.countDocuments(query);
    const inboundCount = await ChatHistory.countDocuments({ merchantId, direction: 'inbound' });
    const unreadInbound = await ChatHistory.countDocuments({ merchantId, direction: 'inbound', status: { $ne: 'read' } });
    const inboundLast24h = await ChatHistory.countDocuments({ merchantId, direction: 'inbound', createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    const lastBotReply = await ChatHistory.findOne({ merchantId, direction: 'outbound' })
      .sort({ createdAt: -1 })
      .select('messageBody createdAt status')
      .lean();

    const providerHealthResults = await ActivityLog.aggregate([
      {
        $match: {
          merchantId,
          $or: [
            { 'details.provider': { $exists: true } },
            { 'details.source': { $exists: true } },
          ],
        },
      },
      {
        $addFields: {
          provider: {
            $toLower: {
              $ifNull: ['$details.provider', '$details.source'],
            },
          },
        },
      },
      {
        $match: {
          provider: { $in: ['meta', 'twilio', 'telegram'] },
        },
      },
      {
        $group: {
          _id: '$provider',
          total: { $sum: 1 },
          success: { $sum: { $cond: [{ $eq: ['$status', 'Success'] }, 1, 0] } },
          failure: { $sum: { $cond: [{ $eq: ['$status', 'Failure'] }, 1, 0] } },
          latest: { $max: '$createdAt' },
        },
      },
    ]);

    const channelHealth = {
      meta: { total: 0, success: 0, failure: 0, latest: null },
      twilio: { total: 0, success: 0, failure: 0, latest: null },
      telegram: { total: 0, success: 0, failure: 0, latest: null },
    };

    providerHealthResults.forEach((row) => {
      if (row._id === 'meta' || row._id === 'twilio' || row._id === 'telegram') {
        channelHealth[row._id] = {
          total: row.total,
          success: row.success,
          failure: row.failure,
          latest: row.latest,
        };
      }
    });

    const stats = {
      total,
      inbound: inboundCount,
      unreadInbound,
      inboundLast24h,
      outbound: messages.filter((message) => message.direction === 'outbound').length,
      inventoryEvents: 0,
      contactEvents: 0,
      latestMessage: messages[0]?.createdAt || null,
      lastBotReply: lastBotReply
        ? {
            messageBody: lastBotReply.messageBody,
            createdAt: lastBotReply.createdAt,
            status: lastBotReply.status,
          }
        : null,
      channelHealth,
    };

    messages.forEach((message) => {
      if (message.aiExtractedData) {
        stats.inventoryEvents += (message.aiExtractedData.inventoryUpdates?.length || 0);
        stats.contactEvents += (message.aiExtractedData.extractedContacts?.length || 0);
      }
    });

    return res.json({
      success: true,
      messages: messages.map((message) => ({
        id: message._id,
        senderPhone: message.senderPhone,
        chatId: message.chatId || null,
        chatUsername: message.chatUsername || null,
        source: message.source || 'whatsapp',
        messageBody: message.messageBody,
        mediaType: message.mediaType,
        direction: message.direction,
        status: message.status,
        createdAt: message.createdAt,
        aiExtractedData: message.aiExtractedData || {},
      })),
      stats,
      pagination: {
        total,
        limit: Math.min(parseInt(limit), 200),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return res.status(500).json({ error: 'Failed to fetch WhatsApp chat history' });
  }
});

/**
 * GET /api/dashboard/:merchantId/tasks
 * List workflow tasks and deliveries for the merchant
 */
router.get('/:merchantId/tasks', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { status, inviteStatus, deliveryStatus } = req.query;
    const tasks = await TaskService.listTasks(merchantId, {
      status: status?.toString(),
      inviteStatus: inviteStatus?.toString(),
      deliveryStatus: deliveryStatus?.toString(),
    });
    return res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/dashboard/:merchantId/tasks
 * Create a new task and optionally send an invite to join
 */
router.post('/:merchantId/tasks', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const payload = req.body || {};
    const sendInvite = payload.sendInvite === true || payload.sendInvite === 'true';
    const task = await TaskService.createTask(merchantId, payload, sendInvite);
    return res.json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PATCH /api/dashboard/:merchantId/tasks/:taskId
 * Update task metadata, status, or assigned team member
 */
router.patch('/:merchantId/tasks/:taskId', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, taskId } = req.params;
    const updates = req.body || {};
    const task = await TaskService.updateTask(merchantId, taskId, updates);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * POST /api/dashboard/:merchantId/tasks/:taskId/invite
 * Send or resend a task invite via WhatsApp or Telegram
 */
router.post('/:merchantId/tasks/:taskId/invite', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, taskId } = req.params;
    const task = await TaskService.sendTaskInvite(taskId, merchantId);
    return res.json({ success: true, task });
  } catch (error) {
    console.error('Error sending task invite:', error);
    return res.status(500).json({ error: error.message || 'Failed to send task invite' });
  }
});

/**
 * GET /api/dashboard/:merchantId/delivery-partners
 * Return the list of registered delivery partners available for booking
 */
router.get('/:merchantId/delivery-partners', requireMerchantMatch, async (req, res) => {
  try {
    const partners = DeliveryPartnerService.listDeliveryPartners();
    return res.json({ success: true, partners });
  } catch (error) {
    console.error('Error loading delivery partners:', error);
    return res.status(500).json({ error: 'Failed to load delivery partners' });
  }
});

/**
 * POST /api/dashboard/:merchantId/tasks/:taskId/delivery
 * Update delivery status and tracking details for a task
 */
router.post('/:merchantId/tasks/:taskId/delivery', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId, taskId } = req.params;
    const delivery = req.body || {};
    const task = await TaskService.updateDeliveryStatus(merchantId, taskId, delivery);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating delivery:', error);
    return res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

/**
 * GET /api/dashboard/:merchantId/financials
 * Summary of cash flow, income, expenses and tax for the merchant
 */
router.get('/:merchantId/financials', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const days = parseInt(req.query.days || '30', 10);
    const source = req.query.source || null;

    const financials = await FinancialService.getFinancialSummary(merchantId, days, source);
    return res.json({ success: true, ...financials });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    return res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
});

/**
 * GET /api/dashboard/:merchantId/expenses
 * Expense category breakdown for the merchant
 */
router.get('/:merchantId/expenses', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const days = parseInt(req.query.days || '30', 10);
    const source = req.query.source || null;

    const breakdown = await FinancialService.getExpenseBreakdown(merchantId, days, source);
    return res.json({ success: true, categories: breakdown });
  } catch (error) {
    console.error('Error fetching expense breakdown:', error);
    return res.status(500).json({ error: 'Failed to fetch expense breakdown' });
  }
});

/**
 * GET /api/dashboard/:merchantId/tax-summary
 * Tax estimate and taxable income for the merchant
 */
router.get('/:merchantId/tax-summary', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const period = req.query.period === 'year' ? 'year' : 'month';
    const source = req.query.source || null;

    const summary = await FinancialService.getTaxSummary(merchantId, period, source);
    return res.json({ success: true, ...summary });
  } catch (error) {
    console.error('Error fetching tax summary:', error);
    return res.status(500).json({ error: 'Failed to fetch tax summary' });
  }
});

/**
 * GET /api/dashboard/:merchantId/cashflow-timeline
 * Cash flow timeline for the merchant
 */
router.get('/:merchantId/cashflow-timeline', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const days = parseInt(req.query.days || '30', 10);
    const source = req.query.source || null;

    const timeline = await FinancialService.getCashflowTimeline(merchantId, days, source);
    return res.json({ success: true, timeline });
  } catch (error) {
    console.error('Error fetching cashflow timeline:', error);
    return res.status(500).json({ error: 'Failed to fetch cashflow timeline' });
  }
});

/**
 * GET /api/dashboard/:merchantId/cashflow
 * Alias for the cashflow timeline endpoint
 */
router.get('/:merchantId/cashflow', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const days = parseInt(req.query.days || '30', 10);
    const source = req.query.source || null;

    const timeline = await FinancialService.getCashflowTimeline(merchantId, days, source);
    return res.json({ success: true, timeline });
  } catch (error) {
    console.error('Error fetching cashflow data:', error);
    return res.status(500).json({ error: 'Failed to fetch cashflow data' });
  }
});

/**
 * GET /api/dashboard/:merchantId/cash-balance
 * Latest cash balance snapshot for the merchant
 */
router.get('/:merchantId/cash-balance', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const balance = await FinancialService.getLatestCashBalance(merchantId);
    return res.json({ success: true, balance });
  } catch (error) {
    console.error('Error fetching cash balance:', error);
    return res.status(500).json({ error: 'Failed to fetch cash balance' });
  }
});

/**
 * GET /api/dashboard/:merchantId/financial-transactions
 * List recent financial transactions for the merchant
 */
router.get('/:merchantId/financial-transactions', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const limit = parseInt(req.query.limit || '25', 10);
    const skip = parseInt(req.query.skip || '0', 10);
    const source = req.query.source || null;
    const type = req.query.type || null;
    const category = req.query.category || null;

    const result = await FinancialService.listTransactions(merchantId, { limit, skip, type, category, source });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching financial transactions:', error);
    return res.status(500).json({ error: 'Failed to fetch financial transactions' });
  }
});

/**
 * POST /api/dashboard/:merchantId/financial-transactions
 * Create / log a manual financial transaction
 */
router.post('/:merchantId/financial-transactions', requireMerchantMatch, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const payload = req.body || {};

    // Basic validation
    if (!payload.amount || !payload.transactionType) {
      return res.status(400).json({ error: 'Missing required fields: amount and transactionType' });
    }

    const result = await FinancialService.createTransaction(merchantId, payload);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error creating financial transaction:', error);
    return res.status(500).json({ error: 'Failed to create financial transaction' });
  }
});

/**
 * GET /api/dashboard/:merchantId/whatsapp-config
 * Merchant WhatsApp business configuration for CTA components
 */
router.get('/:merchantId/whatsapp-config', async (req, res) => {
  try {
    const { merchantId } = req.params;

    const merchant = await Merchant.findById(merchantId)
      .select('whatsappBusinessPhone whatsappBusinessName whatsappPhoneNumberId')
      .lean();

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    return res.json({
      success: true,
      businessPhoneNumber: merchant.whatsappBusinessPhone || process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE || '',
      businessName: merchant.whatsappBusinessName || 'Fisi Ai',
      phoneNumberId: merchant.whatsappPhoneNumberId || null,
    });
  } catch (error) {
    console.error('Error fetching WhatsApp config:', error);
    return res.status(500).json({ error: 'Failed to fetch WhatsApp configuration' });
  }
});

/**
 * GET /api/dashboard/:merchantId/telegram-config
 * Merchant Telegram bot settings for frontend CTA components
 */
router.get('/:merchantId/telegram-config', async (req, res) => {
  try {
    const { merchantId } = req.params;

    const merchant = await Merchant.findById(merchantId)
      .select('telegramBotUsername telegramChatId')
      .lean();

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const botUsername = merchant.telegramBotUsername || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'fisi_online_bot';
    return res.json({
      success: true,
      botUsername,
      chatId: merchant.telegramChatId || null,
      deepLink: botUsername ? `https://t.me/${botUsername}` : '',
      botConfigured: Boolean(botUsername),
    });
  } catch (error) {
    console.error('Error fetching Telegram config:', error);
    return res.status(500).json({ error: 'Failed to fetch Telegram configuration' });
  }
});

/**
 * GET /api/dashboard/:merchantId/failures
 * Job failure metrics and monitoring
 */
router.get('/:merchantId/failures', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { timeRange = 24 } = req.query;

    const [stats, recentFailures, retryMetrics] = await Promise.all([
      FailureTrackingService.getMerchantFailureStats(merchantId, parseInt(timeRange)),
      FailureTrackingService.getRecentFailures(merchantId, 10),
      FailureTrackingService.getRetryMetrics(merchantId, parseInt(timeRange)),
    ]);

    return res.json({
      success: true,
      stats,
      recentFailures,
      retryMetrics,
      timeRange: `${timeRange}h`,
    });
  } catch (error) {
    console.error('Error fetching failure metrics:', error);
    return res.status(500).json({ error: 'Failed to fetch failure metrics' });
  }
});

/**
 * GET /api/dashboard/:merchantId/dead-letter-queue
 * Dead-letter queue items (permanently failed jobs)
 */
router.get('/:merchantId/dead-letter-queue', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const dlq = await FailureTrackingService.getDeadLetterQueue(merchantId, parseInt(limit));
    const total = await JobFailure.countDocuments({
      merchantId,
      deadLettered: true,
    });

    return res.json({
      success: true,
      items: dlq,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error('Error fetching dead-letter queue:', error);
    return res.status(500).json({ error: 'Failed to fetch dead-letter queue' });
  }
});

/**
 * POST /api/dashboard/:merchantId/retry-failed-job
 * Manually retry a failed job
 */
router.post('/:merchantId/retry-failed-job', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    // Mark as resolved for manual retry tracking
    const failure = await FailureTrackingService.resolveJobFailure(jobId, 'manual_retry');

    if (!failure) {
      return res.status(404).json({ error: 'Job failure not found' });
    }

    // In a real implementation, you'd re-enqueue the job here
    // For now, we just mark it for manual intervention
    await ActivityLog.create({
      merchantId,
      action: 'MANUAL_RETRY',
      entityType: 'JobFailure',
      entityId: jobId,
      details: {
        originalFailure: failure,
      },
      status: 'Pending',
    });

    return res.json({
      success: true,
      message: 'Job marked for retry',
      jobId,
    });
  } catch (error) {
    console.error('Error retrying failed job:', error);
    return res.status(500).json({ error: 'Failed to retry job' });
  }
});

module.exports = router;
