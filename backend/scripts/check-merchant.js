require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const Merchant = require('../src/models/Merchant');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    const m = await Merchant.findOne({ email: 'leo@ximora.live' }).select('+emailVerificationToken');
    if (!m) {
      console.log('Merchant not found');
      process.exit(0);
    }
    console.log('merchantId:', m.merchantId);
    console.log('emailVerified:', m.emailVerified);
    console.log('emailVerificationToken:', m.emailVerificationToken || '(none)');
    console.log('emailVerificationTokenExpires:', m.emailVerificationTokenExpires);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
