const Queue = require('bull');

// Build Redis URL from env vars if REDIS_URL not provided
function buildRedisUrl() {
  if (process.env.REDIS_URL && process.env.REDIS_URL.length) return process.env.REDIS_URL;

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD || '';
  const useTls = (process.env.REDIS_TLS || 'false').toLowerCase() === 'true';

  const protocol = useTls ? 'rediss' : 'redis';
  const auth = password ? `:${encodeURIComponent(password)}@` : '';
  return `${protocol}://${auth}${host}:${port}`;
}

const redisUrl = buildRedisUrl();

// Queue configuration with enhanced failure handling
const queueConfig = {
  redis: redisUrl,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for tracking
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  settings: {
    // Attempt to complete job after 30 seconds (for stalled jobs)
    lockDuration: 30000,
    lockRenewTime: 15000,
    maxStalledCount: 2,
    guardInterval: 5000,
    stallInterval: 5000,
  },
};

const mediaQueue = new Queue('media-processing', queueConfig);
const webhookQueue = new Queue('webhook-processing', queueConfig);

// Dead-letter queues for permanent failures
const mediaDeadLetterQueue = new Queue('media-processing-dlq', queueConfig);
const webhookDeadLetterQueue = new Queue('webhook-processing-dlq', queueConfig);

// Listen for failed jobs and move to DLQ
webhookQueue.on('failed', async (job, err) => {
  console.error(`[Queue] webhook job ${job.id} failed:`, err.message);
  if (job.attemptsMade >= job.opts.attempts) {
    console.warn(`[DLQ] Moving job ${job.id} to dead-letter queue after ${job.attemptsMade} attempts`);
    // Move to DLQ
    await webhookDeadLetterQueue.add(job.data, {
      jobId: job.id,
      failedAttempts: job.attemptsMade,
      originalError: err.message,
    });
  }
});

mediaQueue.on('failed', async (job, err) => {
  console.error(`[Queue] media job ${job.id} failed:`, err.message);
  if (job.attemptsMade >= job.opts.attempts) {
    console.warn(`[DLQ] Moving job ${job.id} to dead-letter queue after ${job.attemptsMade} attempts`);
    await mediaDeadLetterQueue.add(job.data, {
      jobId: job.id,
      failedAttempts: job.attemptsMade,
      originalError: err.message,
    });
  }
});

module.exports = { 
  mediaQueue, 
  webhookQueue,
  mediaDeadLetterQueue,
  webhookDeadLetterQueue,
};
