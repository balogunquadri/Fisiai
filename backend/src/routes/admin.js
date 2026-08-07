const express = require('express');
const router = express.Router();
const Merchant = require('../models/Merchant');
const ActivityLog = require('../models/ActivityLog');
const JobFailure = require('../models/JobFailure');
const { requireAdmin } = require('../middleware/adminMiddleware');

router.use(requireAdmin);

router.get('/status', async (req, res) => {
  return res.json({
    success: true,
    isAdmin: true,
    email: req.session.merchantEmail || null,
    adminEmails: (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean),
  });
});

router.get('/summary', async (req, res) => {
  try {
    const [merchantCount, activeMerchantCount, verifiedMerchantCount, totalActivityCount, totalFailureCount] = await Promise.all([
      Merchant.countDocuments(),
      Merchant.countDocuments({ isActive: true }),
      Merchant.countDocuments({ emailVerified: true }),
      ActivityLog.countDocuments(),
      JobFailure.countDocuments(),
    ]);

    const recentSignups = await Merchant.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .select('name email phone isAdmin emailVerified createdAt')
      .lean();

    const recentActivity = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const recentFailures = await JobFailure.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    return res.json({
      success: true,
      summary: {
        merchantCount,
        activeMerchantCount,
        verifiedMerchantCount,
        totalActivityCount,
        totalFailureCount,
      },
      recentSignups,
      recentActivity,
      recentFailures,
    });
  } catch (error) {
    console.error('Admin summary error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load admin summary' });
  }
});

module.exports = router;
