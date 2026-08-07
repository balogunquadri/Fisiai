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

const sendVerificationEmail = async (recipientEmail, verificationLink) => {
  const fromAddress = process.env.EMAIL_FROM || `no-reply@${process.env.EMAIL_DOMAIN || 'localhost'}`;
  const transporter = createTransporter();

  if (!transporter) {
    console.warn('Email verification is not configured. Use SMTP_HOST and SMTP_PORT to enable it.');
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
    console.error('Failed to send verification email:', error);
    console.warn(`Verification link for ${recipientEmail}: ${verificationLink}`);
    return false;
  }
};

module.exports = { sendVerificationEmail };
