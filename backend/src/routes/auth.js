const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const Merchant = require('../models/Merchant');
const ActivityLog = require('../models/ActivityLog');
const WhatsAppService = require('../services/WhatsAppService');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { validateSignup, validateSignin } = require('../middleware/inputValidator');
const { authLimiter } = require('../middleware/rateLimiter');
const { isAdminEmail } = require('../middleware/adminMiddleware');

/**
 * POST /api/signup
 * Body: { businessName, email, phone, password }
 * Creates a Merchant record and sends a welcome WhatsApp message (if phone provided)
 * 
 * Security: Rate limited to 5 attempts per 15 minutes
 * Validation: Input validation on all fields
 */
router.post('/signup', authLimiter, validateSignup, async (req, res) => {
  try {
    const { businessName, email, phone, password } = req.body;

    // Prevent duplicate accounts by email
    const existing = await Merchant.findOne({ email: email.toLowerCase().trim() }).select('+emailVerified');
    if (existing) {
      // If the account exists but email is not verified, resend verification instead of a plain 409
      if (!existing.emailVerified) {
        try {
          const emailVerificationToken = crypto.randomBytes(24).toString('hex');
          const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${emailVerificationToken}`;

          existing.emailVerificationToken = emailVerificationToken;
          existing.emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);
          await existing.save();

          const emailSent = await sendVerificationEmail(existing.email, verificationUrl);

          return res.status(200).json({
            success: false,
            error: 'An account with this email already exists but is not verified. A verification email has been resent.',
            emailVerificationSent: emailSent,
          });
        } catch (err) {
          console.warn('[RESEND_VERIFICATION_ERROR]', err && err.message ? err.message : err);
          return res.status(200).json({
            success: false,
            error: 'An account with this email already exists but is not verified. We could not resend the verification email at this time. Please try again later.',
          });
        }
      }

      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const normalizedPhone = phone ? phone.toString().replace(/[^\d+]/g, '') : undefined;

    const passwordHash = await bcrypt.hash(password, 10);
    const emailVerificationToken = crypto.randomBytes(24).toString('hex');
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${emailVerificationToken}`;

    const adminEmail = isAdminEmail(email);
    const merchant = new Merchant({
      name: businessName,
      email: email.toLowerCase().trim(),
      phone: normalizedPhone,
      passwordHash,
      emailVerified: false,
      emailVerificationToken,
      emailVerificationTokenExpires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      isAdmin: adminEmail,
    });

    await merchant.save();

    await ActivityLog.create({
      merchantId: merchant._id,
      action: 'CREATE',
      entityType: 'Merchant',
      details: { email: merchant.email, phone: merchant.phone, name: merchant.name },
      status: 'Success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
    });

    // Send verification email or log the link when SMTP is not configured
    const emailSent = await sendVerificationEmail(merchant.email, verificationUrl);

    // Try to send a welcome WhatsApp message (best-effort)
    if (phone) {
      try {
        const normalized = phone.toString().replace(/[^\d+]/g, '').replace(/^\+/, '');
        const result = await WhatsAppService.sendTextMessage(normalized, `Welcome to Fisi Ai, ${businessName}! Reply with HELP for tips.` , merchant._id);
        if (!result || !result.success) {
          console.warn('Welcome message failed:', result && result.error);
        }
      } catch (err) {
        console.warn('Error sending welcome message:', err && err.message ? err.message : err);
      }
    }

    return res.json({
      success: true,
      merchantId: merchant._id,
      message: 'Account created. Check your email to verify your address.',
      emailVerificationSent: emailSent,
    });
  } catch (error) {
    console.error('[SIGNUP_ERROR]', {
      message: error.message,
      stack: error.stack,
    });
    const errMsg = (error && error.message) ? error.message : 'Failed to create account';
    return res.status(500).json({ success: false, error: errMsg });
  }
});

/**
 * POST /api/signin
 * Body: { email, password }
 * Authenticates merchant and creates session
 * 
 * Security: Rate limited to 5 attempts per 15 minutes
 * Validation: Input validation on all fields
 */
router.post('/signin', authLimiter, validateSignin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const merchant = await Merchant.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash emailVerified emailVerificationToken emailVerificationTokenExpires');
    if (!merchant) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (!merchant.emailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Email address has not been verified. Check your inbox.',
      });
    }

    const passwordMatches = await bcrypt.compare(password, merchant.passwordHash || '');
    if (!passwordMatches) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Regenerate session ID for security
    req.session.regenerate(async (err) => {
      if (err) {
        console.error('[SESSION_REGENERATE_ERROR]', err);
        return res.status(500).json({ success: false, error: 'Failed to create session' });
      }

      const adminEmail = isAdminEmail(merchant.email);
      req.session.merchantId = merchant._id.toString();
      req.session.merchantEmail = merchant.email;
      req.session.isAdmin = merchant.isAdmin || adminEmail;

      await ActivityLog.create({
        merchantId: merchant._id,
        action: 'LOGIN',
        entityType: 'Merchant',
        details: { email: merchant.email },
        status: 'Success',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || '',
      });

      return res.json({ success: true, merchantId: merchant._id, message: 'Signed in successfully' });
    });
  } catch (error) {
    console.error('[SIGNIN_ERROR]', {
      message: error.message,
      stack: error.stack,
    });
    const errMsg = (error && error.message) ? error.message : 'Failed to sign in';
    return res.status(500).json({ success: false, error: errMsg });
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Verification token is required' });
    }

    const merchant = await Merchant.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpires: { $gt: new Date() },
    });

    if (!merchant) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification token' });
    }

    merchant.emailVerified = true;
    merchant.emailVerificationToken = undefined;
    merchant.emailVerificationTokenExpires = undefined;
    await merchant.save();

    return res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ success: false, error: 'Failed to verify email' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required to resend verification' });
    }

    const merchant = await Merchant.findOne({ email: email.toLowerCase().trim() });
    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    if (merchant.emailVerified) {
      return res.json({ success: true, message: 'Email already verified' });
    }

    const emailVerificationToken = crypto.randomBytes(24).toString('hex');
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${emailVerificationToken}`;
    merchant.emailVerificationToken = emailVerificationToken;
    merchant.emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await merchant.save();

    const emailSent = await sendVerificationEmail(merchant.email, verificationUrl);
    return res.json({
      success: true,
      message: 'Verification email resent',
      emailVerificationSent: emailSent,
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ success: false, error: 'Failed to resend verification email' });
  }
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const merchant = await Merchant.findOne({ email: normalizedEmail });
    if (!merchant) {
      return res.json({
        success: true,
        message: 'If an account exists for that email, a password reset link has been sent.',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    merchant.resetPasswordToken = resetToken;
    merchant.resetPasswordTokenExpires = new Date(Date.now() + 1000 * 60 * 60);
    await merchant.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(normalizedEmail)}`;
    await sendPasswordResetEmail(merchant.email, resetUrl);

    return res.json({
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process password reset request' });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, email, password } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!token || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, error: 'Token, email and a new password are required' });
    }

    const passwordIsValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{7,}$/.test(String(password));
    if (!passwordIsValid) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 7 characters and include uppercase, lowercase, a number, and a special character.',
      });
    }

    const merchant = await Merchant.findOne({
      email: normalizedEmail,
      resetPasswordToken: token,
      resetPasswordTokenExpires: { $gt: new Date() },
    });

    if (!merchant) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset link' });
    }

    merchant.passwordHash = await bcrypt.hash(password, 10);
    merchant.resetPasswordToken = undefined;
    merchant.resetPasswordTokenExpires = undefined;
    await merchant.save();

    return res.json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

router.post('/signout', async (req, res) => {
  if (!req.session) {
    return res.json({ success: true, message: 'Signed out' });
  }

  if (req.session.merchantId) {
    await ActivityLog.create({
      merchantId: req.session.merchantId,
      action: 'LOGOUT',
      entityType: 'Merchant',
      details: { email: req.session.merchantEmail },
      status: 'Success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
    });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Signout error:', err);
      return res.status(500).json({ success: false, error: 'Failed to sign out' });
    }

    res.clearCookie(process.env.SESSION_NAME || 'Fisiai.sid');
    return res.json({ success: true, message: 'Signed out successfully' });
  });
});

module.exports = router;
