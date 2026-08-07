const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDashboardSummary } = require('../src/services/dashboardService');

test('buildDashboardSummary maps counts and recent activity into dashboard payload', () => {
  const summary = buildDashboardSummary({
    merchantCount: 3,
    inventoryCount: 120,
    contactCount: 42,
    recentActivity: [
      {
        id: '1',
        action: 'CREATE',
        entityType: 'Inventory',
        details: { content: 'Added 10 units to stock' },
        createdAt: '2026-07-27T10:00:00.000Z',
        status: 'Success',
      },
    ],
  });

  assert.equal(summary.merchantCount, 3);
  assert.equal(summary.inventoryCount, 120);
  assert.equal(summary.contactCount, 42);
  assert.equal(summary.totalStock, 120);
  assert.equal(summary.harvestedContacts, 42);
  assert.equal(summary.recentActivity[0].tag, 'CREATE');
  assert.equal(summary.recentActivity[0].description, 'Added 10 units to stock');
});
