/**
 * Database Indexes Configuration & Migration
 * Creates optimal indexes for production performance
 * 
 * Run this on first deployment or when updating indexes
 */

const mongoose = require('mongoose');

/**
 * Create all production indexes
 * Should be run during application startup or deployment
 */
async function createProductionIndexes() {
  console.log('🔧 Creating production database indexes...');

  try {
    // Merchants collection indexes
    await createMerchantIndexes();

    // Inventory collection indexes
    await createInventoryIndexes();

    // Contacts collection indexes
    await createContactIndexes();

    // Financial Transactions indexes
    await createFinancialTransactionIndexes();

    // Chat History indexes
    await createChatHistoryIndexes();

    // Activity Log indexes
    await createActivityLogIndexes();

    // Tasks indexes
    await createTaskIndexes();

    console.log('✓ All production indexes created successfully');
  } catch (error) {
    console.error('✗ Failed to create indexes:', error.message);
    throw error;
  }
}

/**
 * Merchant collection indexes
 */
async function createMerchantIndexes() {
  const collection = mongoose.connection.collection('merchants');

  // Unique email index for fast lookups and uniqueness enforcement
  await collection.createIndex({ email: 1 }, { unique: true, sparse: true });

  // Phone number index for lookups
  await collection.createIndex({ phone: 1 }, { sparse: true });

  // TTL index for email verification tokens (auto-delete after 24 hours)
  await collection.createIndex(
    { emailVerificationTokenExpires: 1 },
    { expireAfterSeconds: 0, sparse: true }
  );

  // Compound index for common queries
  await collection.createIndex({ emailVerified: 1, createdAt: -1 });

  console.log('✓ Merchant indexes created');
}

/**
 * Inventory collection indexes
 */
async function createInventoryIndexes() {
  const collection = mongoose.connection.collection('inventories');

  // Merchant ID lookup (most common query)
  await collection.createIndex({ merchantId: 1 });

  // Product name search (case-insensitive)
  await collection.createIndex(
    { merchantId: 1, name: 1 },
    { collation: { locale: 'en', strength: 2 } }
  );

  // Category lookup
  await collection.createIndex({ merchantId: 1, category: 1 });

  // Price range queries
  await collection.createIndex({ merchantId: 1, price: 1 });

  // Low stock alerts
  await collection.createIndex({ merchantId: 1, quantity: 1 });

  // Timestamp for sorting and filtering
  await collection.createIndex({ merchantId: 1, updatedAt: -1 });

  // TTL for soft deletes (if implementing)
  await collection.createIndex(
    { deletedAt: 1 },
    { expireAfterSeconds: 7776000, sparse: true } // 90 days
  );

  console.log('✓ Inventory indexes created');
}

/**
 * Contacts collection indexes
 */
async function createContactIndexes() {
  const collection = mongoose.connection.collection('contacts');

  // Merchant ID lookup
  await collection.createIndex({ merchantId: 1 });

  // Phone number search
  await collection.createIndex({ merchantId: 1, phone: 1 }, { unique: true, sparse: true });

  // Name search
  await collection.createIndex(
    { merchantId: 1, name: 1 },
    { collation: { locale: 'en', strength: 2 } }
  );

  // Role lookup (supplier, customer, etc.)
  await collection.createIndex({ merchantId: 1, role: 1 });

  // Email search
  await collection.createIndex({ merchantId: 1, email: 1 }, { sparse: true });

  // Timestamp for sorting
  await collection.createIndex({ merchantId: 1, createdAt: -1 });

  console.log('✓ Contact indexes created');
}

/**
 * Financial Transactions collection indexes
 */
async function createFinancialTransactionIndexes() {
  const collection = mongoose.connection.collection('financialtransactions');

  // Merchant ID lookup
  await collection.createIndex({ merchantId: 1 });

  // Type and merchant lookup
  await collection.createIndex({ merchantId: 1, type: 1 });

  // Date range queries
  await collection.createIndex({ merchantId: 1, date: 1 });

  // Compound index for common analytics queries
  await collection.createIndex({ merchantId: 1, type: 1, date: -1 });

  // Category lookup
  await collection.createIndex({ merchantId: 1, category: 1 });

  // Status tracking (pending, completed, failed)
  await collection.createIndex({ merchantId: 1, status: 1 });

  // Amount range queries
  await collection.createIndex({ merchantId: 1, amount: 1 });

  console.log('✓ Financial Transaction indexes created');
}

/**
 * Chat History collection indexes
 */
async function createChatHistoryIndexes() {
  const collection = mongoose.connection.collection('chathistories');

  // Merchant ID lookup
  await collection.createIndex({ merchantId: 1 });

  // Phone number lookup
  await collection.createIndex({ merchantId: 1, phone: 1 });

  // Direction (incoming/outgoing)
  await collection.createIndex({ merchantId: 1, direction: 1 });

  // Timestamp for sorting
  await collection.createIndex({ merchantId: 1, timestamp: -1 });

  // Message type lookup
  await collection.createIndex({ merchantId: 1, messageType: 1 });

  // TTL for message retention (e.g., keep for 2 years)
  await collection.createIndex(
    { timestamp: 1 },
    { expireAfterSeconds: 63072000, sparse: true }
  );

  console.log('✓ Chat History indexes created');
}

/**
 * Activity Log collection indexes
 */
async function createActivityLogIndexes() {
  const collection = mongoose.connection.collection('activitylogs');

  // Merchant ID lookup (most important)
  await collection.createIndex({ merchantId: 1 });

  // Action type lookup
  await collection.createIndex({ merchantId: 1, action: 1 });

  // Timestamp for sorting and time-range queries
  await collection.createIndex({ merchantId: 1, timestamp: -1 });

  // User tracking
  await collection.createIndex({ merchantId: 1, user: 1, timestamp: -1 });

  // Entity type lookup (inventory, contact, transaction, etc.)
  await collection.createIndex({ merchantId: 1, entityType: 1 });

  // IP address tracking (security)
  await collection.createIndex({ merchantId: 1, ip: 1, timestamp: -1 }, { sparse: true });

  // TTL for log retention (e.g., keep for 1 year)
  await collection.createIndex(
    { timestamp: 1 },
    { expireAfterSeconds: 31536000, sparse: true }
  );

  console.log('✓ Activity Log indexes created');
}

/**
 * Tasks collection indexes
 */
async function createTaskIndexes() {
  const collection = mongoose.connection.collection('tasks');

  // Merchant ID lookup
  await collection.createIndex({ merchantId: 1 });

  // Status lookup
  await collection.createIndex({ merchantId: 1, status: 1 });

  // Workflow stage
  await collection.createIndex({ merchantId: 1, workflowStage: 1 });

  // Due date queries
  await collection.createIndex({ merchantId: 1, dueDate: 1 }, { sparse: true });

  // Priority
  await collection.createIndex({ merchantId: 1, priority: 1 });

  // Assigned to
  await collection.createIndex({ merchantId: 1, assignedTo: 1 }, { sparse: true });

  // Created date for sorting
  await collection.createIndex({ merchantId: 1, createdAt: -1 });

  // Compound index for common task queries
  await collection.createIndex({ merchantId: 1, status: 1, dueDate: 1 });

  console.log('✓ Task indexes created');
}

/**
 * Drop all indexes (use with caution)
 */
async function dropAllIndexes() {
  console.warn('⚠️  Dropping all indexes. This may affect performance temporarily.');

  const collections = [
    'merchants',
    'inventories',
    'contacts',
    'financialtransactions',
    'chathistories',
    'activitylogs',
    'tasks',
  ];

  for (const collName of collections) {
    try {
      const collection = mongoose.connection.collection(collName);
      await collection.dropAllIndexes();
      console.log(`✓ Dropped indexes for ${collName}`);
    } catch (error) {
      console.error(`✗ Failed to drop indexes for ${collName}:`, error.message);
    }
  }
}

/**
 * Check index status
 */
async function getIndexStatus() {
  const collections = [
    'merchants',
    'inventories',
    'contacts',
    'financialtransactions',
    'chathistories',
    'activitylogs',
    'tasks',
  ];

  console.log('\n📊 Index Status Report:');
  console.log('═'.repeat(80));

  for (const collName of collections) {
    try {
      const collection = mongoose.connection.collection(collName);
      const indexes = await collection.getIndexes();
      console.log(`\n${collName}:`);
      Object.entries(indexes).forEach(([key, spec]) => {
        console.log(`  - ${JSON.stringify(spec.key)}`);
      });
    } catch (error) {
      console.error(`✗ Error retrieving indexes for ${collName}:`, error.message);
    }
  }

  console.log('\n' + '═'.repeat(80));
}

module.exports = {
  createProductionIndexes,
  dropAllIndexes,
  getIndexStatus,
  // Individual functions for custom usage
  createMerchantIndexes,
  createInventoryIndexes,
  createContactIndexes,
  createFinancialTransactionIndexes,
  createChatHistoryIndexes,
  createActivityLogIndexes,
  createTaskIndexes,
};
