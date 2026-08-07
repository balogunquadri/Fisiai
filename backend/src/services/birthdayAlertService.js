const Contact = require('../models/Contact');
const ActivityLog = require('../models/ActivityLog');
const WhatsAppService = require('./WhatsAppService');
const TelegramService = require('./TelegramService');

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isBirthdayMatch(birthday, compareDate = new Date()) {
  const normalizedBirthday = normalizeDate(birthday);
  if (!normalizedBirthday) return false;
  return (
    normalizedBirthday.getUTCDate() === compareDate.getUTCDate() &&
    normalizedBirthday.getUTCMonth() === compareDate.getUTCMonth()
  );
}

async function getBirthdayCustomers(merchantId, date = new Date()) {
  const compareDate = normalizeDate(date) || new Date();
  const customers = await Contact.find({ merchantId, birthday: { $exists: true, $ne: null } }).lean();
  return customers.filter((customer) => isBirthdayMatch(customer.birthday, compareDate));
}

async function sendBirthdayAlerts(merchantId, date = new Date()) {
  const recipients = await getBirthdayCustomers(merchantId, date);
  let sent = 0;
  let failed = 0;
  for (const customer of recipients) {
    const name = customer.firstName || 'Friend';
    const message = `🎉 Happy Birthday ${name}! Wishing you a wonderful day from your business partner. Reply to this message to stay connected.`;
    try {
      if (customer.phone) {
        await WhatsAppService.sendTextMessage(customer.phone.replace(/[^\d+]/g, ''), message, merchantId);
      }
      if (customer.metadata?.telegramChatId) {
        await TelegramService.sendTextMessage(customer.metadata.telegramChatId, message, merchantId);
      }
      sent += 1;
      await ActivityLog.create({
        merchantId,
        action: 'BIRTHDAY_MESSAGE_SENT',
        entityType: 'Contact',
        entityId: customer._id,
        details: { customerId: customer._id, phone: customer.phone, email: customer.email },
        status: 'Success',
      });
    } catch (error) {
      failed += 1;
      await ActivityLog.create({
        merchantId,
        action: 'BIRTHDAY_MESSAGE_FAILED',
        entityType: 'Contact',
        entityId: customer._id,
        details: { customerId: customer._id, error: error.message || error },
        status: 'Failure',
      });
    }
  }
  return { total: recipients.length, sent, failed, recipients: recipients.map((c) => c._id.toString()) };
}

module.exports = {
  getBirthdayCustomers,
  sendBirthdayAlerts,
  isBirthdayMatch,
};
