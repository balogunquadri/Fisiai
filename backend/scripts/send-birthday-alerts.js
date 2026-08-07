const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { connectDB } = require('../src/db');
const Merchant = require('../src/models/Merchant');
const BirthdayAlertService = require('../src/services/birthdayAlertService');

(async () => {
  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }

  try {
    const merchants = await Merchant.find({ isActive: true }).lean();
    console.log(`Found ${merchants.length} active merchants. Sending birthday alerts now...`);

    for (const merchant of merchants) {
      const result = await BirthdayAlertService.sendBirthdayAlerts(merchant._id);
      console.log(`Merchant ${merchant._id}: ${result.sent}/${result.total} birthday alerts sent, ${result.failed} failed.`);
    }

    console.log('Birthday alerts run complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error running birthday alerts script:', error);
    process.exit(1);
  }
})();
