require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const Merchant = require('../src/models/Merchant');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    const ms = await Merchant.find({}).sort({ createdAt: -1 }).limit(10).select('merchantId email emailVerified createdAt');
    if (!ms || ms.length === 0) {
      console.log('No merchants found');
      process.exit(0);
    }
    ms.forEach(m => {
      console.log(`${m.createdAt.toISOString()}  ${m.merchantId}  ${m.email}  verified:${m.emailVerified}`);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
