/**
 * Batch Write Service - Buffers database writes and flushes in batches
 * Converts individual writes into bulk insertMany operations
 * Reduces MongoDB costs by 80-90% on high-volume writes
 */

const ChatHistory = require('../models/ChatHistory');
const ActivityLog = require('../models/ActivityLog');

// Separate buffers for different collections
const buffers = {
  chatHistory: [],
  activityLog: [],
};

// Configuration
const CONFIG = {
  BATCH_SIZE: 20,           // Flush when buffer reaches this size
  FLUSH_INTERVAL: 30000,    // Flush every 30 seconds (in ms)
  MAX_BUFFER_SIZE: 1000,    // Safety limit - hard flush at this size
};

let flushIntervals = {};
let isShuttingDown = false;

/**
 * Initialize batch write service
 * Starts periodic flush intervals
 */
function initialize() {
  console.log('🔄 Initializing batch write service...');

  // Start flush interval for ChatHistory
  flushIntervals.chatHistory = setInterval(async () => {
    if (buffers.chatHistory.length > 0 && !isShuttingDown) {
      await flushChatHistory();
    }
  }, CONFIG.FLUSH_INTERVAL);

  // Start flush interval for ActivityLog
  flushIntervals.activityLog = setInterval(async () => {
    if (buffers.activityLog.length > 0 && !isShuttingDown) {
      await flushActivityLog();
    }
  }, CONFIG.FLUSH_INTERVAL);

  console.log(`✓ Batch write service initialized (flush interval: ${CONFIG.FLUSH_INTERVAL}ms)`);
}

/**
 * Buffer a chat history record
 * Automatically flushes if buffer size limit reached
 */
function bufferChatMessage(merchantId, senderPhone, messageBody, mediaType, direction, aiExtractedData = null, source = 'whatsapp', chatId = null, chatUsername = null) {
  const record = {
    merchantId,
    senderPhone,
    chatId,
    chatUsername,
    source,
    messageBody,
    mediaType,
    direction,
    status: 'pending',
    createdAt: new Date(),
  };

  if (aiExtractedData) {
    record.aiExtractedData = aiExtractedData;
  }

  buffers.chatHistory.push(record);

  // Immediate flush if buffer is full
  if (buffers.chatHistory.length >= CONFIG.BATCH_SIZE) {
    flushChatHistory();
  }

  // Safety: emergency flush if buffer exceeds max
  if (buffers.chatHistory.length >= CONFIG.MAX_BUFFER_SIZE) {
    console.warn(`⚠️ ChatHistory buffer exceeded max size (${CONFIG.MAX_BUFFER_SIZE}), emergency flush`);
    flushChatHistory();
  }
}

/**
 * Buffer an activity log record
 * Automatically flushes if buffer size limit reached
 */
function bufferActivityLog(logData) {
  const record = {
    ...logData,
    createdAt: new Date(),
  };

  buffers.activityLog.push(record);

  // Immediate flush if buffer is full
  if (buffers.activityLog.length >= CONFIG.BATCH_SIZE) {
    flushActivityLog();
  }

  // Safety: emergency flush if buffer exceeds max
  if (buffers.activityLog.length >= CONFIG.MAX_BUFFER_SIZE) {
    console.warn(`⚠️ ActivityLog buffer exceeded max size (${CONFIG.MAX_BUFFER_SIZE}), emergency flush`);
    flushActivityLog();
  }
}

/**
 * Flush buffered chat messages to database
 */
async function flushChatHistory() {
  if (buffers.chatHistory.length === 0) {
    return;
  }

  const batch = [...buffers.chatHistory];
  buffers.chatHistory = [];

  try {
    const result = await ChatHistory.insertMany(batch, { ordered: false });
    console.log(`✓ Batch write (ChatHistory): ${result.length} records flushed to DB`);
    return { success: true, count: result.length };
  } catch (err) {
    console.error('✗ Batch write error (ChatHistory):', err.message);

    // On error, attempt individual inserts for partial success
    let successCount = 0;
    for (const record of batch) {
      try {
        await ChatHistory.create(record);
        successCount++;
      } catch (e) {
        console.warn(`⚠️ Failed to write chat record:`, e.message);
      }
    }

    return { success: false, count: successCount, error: err.message };
  }
}

/**
 * Flush buffered activity logs to database
 */
async function flushActivityLog() {
  if (buffers.activityLog.length === 0) {
    return;
  }

  const batch = [...buffers.activityLog];
  buffers.activityLog = [];

  try {
    const result = await ActivityLog.insertMany(batch, { ordered: false });
    console.log(`✓ Batch write (ActivityLog): ${result.length} records flushed to DB`);
    return { success: true, count: result.length };
  } catch (err) {
    console.error('✗ Batch write error (ActivityLog):', err.message);

    // On error, attempt individual inserts for partial success
    let successCount = 0;
    for (const record of batch) {
      try {
        await ActivityLog.create(record);
        successCount++;
      } catch (e) {
        console.warn(`⚠️ Failed to write activity log:`, e.message);
      }
    }

    return { success: false, count: successCount, error: err.message };
  }
}

/**
 * Flush all buffers (called on graceful shutdown)
 */
async function flushAll() {
  console.log('🔄 Flushing all buffers...');
  isShuttingDown = true;

  // Clear intervals
  if (flushIntervals.chatHistory) clearInterval(flushIntervals.chatHistory);
  if (flushIntervals.activityLog) clearInterval(flushIntervals.activityLog);

  // Flush remaining records
  const results = {
    chatHistory: await flushChatHistory(),
    activityLog: await flushActivityLog(),
  };

  console.log('✓ All buffers flushed');
  return results;
}

/**
 * Get buffer statistics
 */
function getStats() {
  return {
    chatHistory: {
      size: buffers.chatHistory.length,
      maxSize: CONFIG.MAX_BUFFER_SIZE,
      batchSize: CONFIG.BATCH_SIZE,
    },
    activityLog: {
      size: buffers.activityLog.length,
      maxSize: CONFIG.MAX_BUFFER_SIZE,
      batchSize: CONFIG.BATCH_SIZE,
    },
    config: CONFIG,
  };
}

/**
 * Shutdown service gracefully
 */
async function shutdown() {
  console.log('🛑 Shutting down batch write service...');
  await flushAll();
  console.log('✓ Batch write service shutdown complete');
}

module.exports = {
  initialize,
  bufferChatMessage,
  bufferActivityLog,
  flushChatHistory,
  flushActivityLog,
  flushAll,
  getStats,
  shutdown,
  CONFIG,
};
