const registeredDeliveryPartners = [
  {
    id: 'fastship',
    name: 'FastShip Logistics',
    description: 'Reliable same-day courier service for local deliveries.',
    contact: '+2347010000001',
  },
  {
    id: 'quickmoto',
    name: 'QuickMoto Couriers',
    description: 'Motorbike delivery for fast city routes and urgent orders.',
    contact: '+2347010000002',
  },
  {
    id: 'cityxpress',
    name: 'CityXpress Delivery',
    description: 'Economy delivery across the city with proof of delivery updates.',
    contact: '+2347010000003',
  },
];

function listDeliveryPartners() {
  return registeredDeliveryPartners;
}

function findDeliveryPartner(keyword) {
  if (!keyword) return null;
  const normalized = keyword.toString().trim().toLowerCase();
  return registeredDeliveryPartners.find((partner) =>
    partner.id.toLowerCase() === normalized ||
    partner.name.toLowerCase() === normalized ||
    partner.name.toLowerCase().includes(normalized) ||
    partner.id.toLowerCase().includes(normalized)
  ) || null;
}

function buildDeliveryPartnerListMessage() {
  let message = '🚚 *Delivery Partners Available*\n\n';
  registeredDeliveryPartners.forEach((partner, index) => {
    message += `${index + 1}\. *${partner.name}*\n`;
    message += `   ${partner.description}\n`;
    message += `   Contact: ${partner.contact}\n\n`;
  });
  message += 'To book any partner, reply with:\n';
  message += '`/delivery book <partner name> | <pickup location> | <delivery address>`\n';
  message += 'Example:\n`/delivery book FastShip Logistics | Warehouse 14, Lagos | Market Stall 17, Lagos`';
  return message;
}

module.exports = {
  listDeliveryPartners,
  findDeliveryPartner,
  buildDeliveryPartnerListMessage,
};
