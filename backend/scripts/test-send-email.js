#!/usr/bin/env node
const path = require('path');

// Load backend .env
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sendVerificationEmail } = require('../src/services/emailService');

const email = process.argv[2] || process.env.TEST_EMAIL || 'test+dev@fisiai.online';
const token = process.argv[3] || Math.random().toString(36).slice(2);
const verificationLink = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

console.log('--- Email test script ---');
console.log('Target email:', email);
console.log('Verification link:', verificationLink);
console.log('BREVO_API_KEY present:', !!process.env.BREVO_API_KEY);
console.log('SMTP_HOST present:', !!process.env.SMTP_HOST);

(async () => {
  try {
    const ok = await sendVerificationEmail(email, verificationLink);
    console.log('sendVerificationEmail result:', ok);
  } catch (err) {
    console.error('sendVerificationEmail threw error:');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 2;
  }
})();
