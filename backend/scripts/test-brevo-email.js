#!/usr/bin/env node
/**
 * Test Brevo Email Service
 * Tests both Brevo HTTP API and SMTP fallback
 */

require('dotenv').config({ path: '.env' });

const axios = require('axios');
const nodemailer = require('nodemailer');

const RECIPIENT_EMAIL = process.argv[2] || 'test@example.com';
const TEST_LINK = 'https://fisiai.onrender.com/api/verify-email?token=test123456789';

console.log('\n═════════════════════════════════════════════════════');
console.log('BREVO EMAIL SERVICE TEST');
console.log('═════════════════════════════════════════════════════\n');

// ===== CONFIG VALIDATION =====
console.log('📋 Configuration Check:');
console.log('  BREVO_API_KEY:', process.env.BREVO_API_KEY ? '✓ Set' : '✗ NOT SET');
console.log('  SMTP_HOST:', process.env.SMTP_HOST || '(not configured)');
console.log('  SMTP_PORT:', process.env.SMTP_PORT || '(not configured)');
console.log('  EMAIL_FROM:', process.env.EMAIL_FROM || '(not configured)');
console.log('  Recipient:', RECIPIENT_EMAIL);
console.log('');

// ===== TEST 1: BREVO HTTP API =====
async function testBrevoAPI() {
  console.log('🔴 TEST 1: Brevo HTTP API');
  console.log('─────────────────────────────────────────────────');

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log('  ✗ SKIPPED: BREVO_API_KEY not configured\n');
    return false;
  }

  const payload = {
    sender: {
      name: 'Fisi AI Test',
      email: process.env.EMAIL_FROM || 'no-reply@fisiai.online',
    },
    to: [{ email: RECIPIENT_EMAIL }],
    subject: '[TEST] Verify your Fisi Ai email address',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;color:#111;">
        <h2>🧪 Test Email - Verify your email</h2>
        <p>This is a test from the Brevo API integration.</p>
        <p><a href="${TEST_LINK}" style="display:inline-block;padding:12px 20px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;">Verify Email</a></p>
        <p style="color:#6b7280;margin-top:20px;font-size:12px;">Test timestamp: ${new Date().toISOString()}</p>
      </div>
    `,
    textContent: `Test email. Verify: ${TEST_LINK}`,
  };

  try {
    console.log('  📤 Sending via Brevo API...');
    const res = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    console.log('  ✓ SUCCESS (Status: ' + res.status + ')');
    console.log('  Response:', JSON.stringify(res.data, null, 2));
    console.log('  ⏱️  Check your inbox for the test email.\n');
    return true;
  } catch (err) {
    console.log('  ✗ FAILED');
    console.log('  Error:', err.message);
    if (err.response?.data) {
      console.log('  Response:', JSON.stringify(err.response.data, null, 2));
    }
    console.log('');
    return false;
  }
}

// ===== TEST 2: SMTP FALLBACK =====
async function testSMTPFallback() {
  console.log('🟡 TEST 2: SMTP Fallback (Brevo Relay)');
  console.log('─────────────────────────────────────────────────');

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_AUTH_USER;
  const pass = process.env.SMTP_AUTH_PASSWORD;

  if (!host || !port) {
    console.log('  ✗ SKIPPED: SMTP not configured\n');
    return false;
  }

  try {
    console.log('  📤 Creating transporter...');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    console.log('  📤 Verifying SMTP connection...');
    await transporter.verify();
    console.log('  ✓ SMTP connection verified');

    console.log('  📤 Sending test email via SMTP...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: RECIPIENT_EMAIL,
      subject: '[TEST] Verify your Fisi Ai email address (via SMTP)',
      text: `Test email via SMTP. Verify: ${TEST_LINK}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#111;">
          <h2>🧪 Test Email (SMTP) - Verify your email</h2>
          <p>This is a test from the SMTP fallback integration.</p>
          <p><a href="${TEST_LINK}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;">Verify Email</a></p>
          <p style="color:#6b7280;margin-top:20px;font-size:12px;">Test timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log('  ✓ SUCCESS');
    console.log('  Message ID:', info.messageId);
    console.log('  ⏱️  Check your inbox for the test email.\n');
    return true;
  } catch (err) {
    console.log('  ✗ FAILED');
    console.log('  Error:', err.message);
    console.log('');
    return false;
  }
}

// ===== MAIN TEST RUNNER =====
async function runTests() {
  try {
    const brevoOK = await testBrevoAPI();
    const smtpOK = await testSMTPFallback();

    console.log('═════════════════════════════════════════════════════');
    console.log('TEST SUMMARY');
    console.log('═════════════════════════════════════════════════════');
    console.log('  Brevo API:        ' + (brevoOK ? '✓ WORKING' : '✗ FAILED'));
    console.log('  SMTP Fallback:    ' + (smtpOK ? '✓ WORKING' : '✗ FAILED'));
    console.log('');

    if (!brevoOK && !smtpOK) {
      console.log('❌ PROBLEM: Neither Brevo nor SMTP is working!');
      console.log('');
      console.log('TROUBLESHOOTING:');
      console.log('  1. Verify BREVO_API_KEY is correct in .env');
      console.log('  2. Verify SMTP credentials in .env');
      console.log('  3. Check if admin@fisiai.online is a verified sender in Brevo');
      console.log('  4. Check Brevo account sending limits/quotas');
      console.log('');
      process.exit(1);
    }

    console.log('✓ Email service is working! Emails should be received.');
    console.log('');
    console.log('📌 NEXT STEPS:');
    console.log('  1. Check spam/junk folder if email not in inbox');
    console.log('  2. Verify the email address is correct: ' + RECIPIENT_EMAIL);
    console.log('  3. Test signup flow: https://fisiai.onrender.com/signup');
    console.log('');
  } catch (err) {
    console.error('🔥 Unexpected error:', err);
    process.exit(1);
  }
}

runTests();
