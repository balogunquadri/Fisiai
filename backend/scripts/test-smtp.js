const nodemailer = require('nodemailer');
require('dotenv').config();

(async () => {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_AUTH_USER,
      pass: process.env.SMTP_AUTH_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
  });

  try {
    const info = await transport.verify();
    console.log('SMTP_VERIFY_OK');
    console.log(info);
  } catch (err) {
    console.error('SMTP_VERIFY_FAILED');
    console.error(err.message || err);
    process.exitCode = 1;
  }
})();
