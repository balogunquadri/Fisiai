const axios = require('axios');
const nodemailer = require('nodemailer');

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_AUTH_USER;
  const pass = process.env.SMTP_AUTH_PASSWORD;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !port) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
};

const sendViaBrevo = async (recipientEmail, verificationLink, fromAddress) => {
  const apiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const payload = {
    sender: {
      name: process.env.EMAIL_SENDER_NAME || 'Fisi AI',
      email: fromAddress,
    },
    to: [
      {
        email: recipientEmail,
      },
    ],
    subject: 'Verify your Fisi Ai email address',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;color:#111;">
        <h2>Verify your email</h2>
        <p>Please verify your Fisi Ai account by clicking the button below.</p>
        <p><a href="${verificationLink}" style="display:inline-block;padding:12px 20px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;">Verify Email</a></p>
        <p style="color:#6b7280;">If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${verificationLink}" style="color:#2563eb;">${verificationLink}</a></p>
      </div>
    `,
    textContent: `Please verify your email by visiting: ${verificationLink}`,
  };

  const url = 'https://api.brevo.com/v3/smtp/email';
  try {
    const res = await axios.post(url, payload, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    // Brevo returns 201/202 on success
    if (res.status >= 200 && res.status < 300) {
      return true;
    }
    console.warn('Brevo response:', res.status, res.data);
    return false;
  } catch (err) {
    console.error('Brevo send error:', err?.response?.data || err.message || err);
    return false;
  }
};

const sendVerificationEmail = async (recipientEmail, verificationLink) => {
  const fromAddress = process.env.EMAIL_FROM || `no-reply@${process.env.EMAIL_DOMAIN || 'localhost'}`;

  // Try Brevo HTTP API first (preferred)
  if (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY) {
    try {
      const ok = await sendViaBrevo(recipientEmail, verificationLink, fromAddress);
      if (ok) return true;
      console.log('Brevo API failed, attempting SMTP fallback...');
    } catch (err) {
      console.warn('Brevo attempt failed:', err.message || err);
    }
  }

  // Fallback to SMTP via nodemailer
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('Email verification is not configured (no SMTP or BREVO_API_KEY).');
    console.warn(`Verification link for ${recipientEmail}: ${verificationLink}`);
    return false;
  }

  const mailOptions = {
    from: fromAddress,
    to: recipientEmail,
    subject: 'Verify your Fisi Ai email address',
    text: `Please verify your email by clicking the link below:\n\n${verificationLink}\n\nIf you did not sign up, ignore this message.`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;">
        <h2>Verify your email</h2>
        <p>Please verify your Fisi Ai account by clicking the button below.</p>
        <p><a href="${verificationLink}" style="display:inline-block;padding:12px 20px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;">Verify Email</a></p>
        <p style="color:#6b7280;">If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${verificationLink}" style="color:#2563eb;">${verificationLink}</a></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Failed to send verification email via SMTP:', error);
    console.warn(`Verification link for ${recipientEmail}: ${verificationLink}`);
    return false;
  }
};

module.exports = { sendVerificationEmail };
