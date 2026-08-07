/**
 * Failure Tracking Service
 * Monitors job failures, retry attempts, and dead-letter queue management
 */

const JobFailure = require('../models/JobFailure');
const ActivityLog = require('../models/ActivityLog');

class FailureTrackingService {
  /**
   * Log a job failure
   */
  static async logJobFailure(jobId, jobType, data, error, options = {}) {
    try {
      const {
        merchantId = null,
        messageId = null,
        senderPhone = null,
        messageType = null,
        attemptNumber = 1,
        maxAttempts = 3,
        failureReason = 'unknown',
        retryable = true,
      } = options;

      const failureRecord = await JobFailure.create({
        jobId,
        jobType,
        merchantId,
        messageId,
        senderPhone,
        messageType,
        attemptNumber,
        maxAttempts,
        error: {
          message: error?.message || String(error),
          Fisi: error?.Fisi || '',
          code: error?.code || '',
        },
        failureReason,
        originalJobData: data,
        retryable,
        deadLettered: false,
      });

      // Log to ActivityLog as well
      await ActivityLog.create({
        merchantId,
        action: 'JOB_FAILURE',
        entityType: 'Job',
        entityId: jobId,
        details: {
          jobType,
          messageId,
          senderPhone,
          attemptNumber,
          maxAttempts,
          failureReason,
          retryable,
        },
        status: 'Failure',
        error: error?.message,
      });

      console.error(
        `[JobFailure] ${jobType} job ${jobId} failed (attempt ${attemptNumber}/${maxAttempts}): ${failureReason}`
      );

      return failureRecord;
    } catch (err) {
      console.error('Failed to log job failure:', err);
    }
  }

  /**
   * Move job to dead-letter queue (permanent failure)
   */
  static async moveToDeadLetter(jobId, reason) {
    try {
      const updated = await JobFailure.findOneAndUpdate(
        { jobId },
        {
          deadLettered: true,
          deadLetterReason: reason,
          resolvedAt: new Date(),
          resolvedBy: 'max_retries_exceeded',
        },
        { new: true }
      );

      console.warn(
        `[DeadLetter] Job ${jobId} moved to dead-letter queue: ${reason}`
      );

      return updated;
    } catch (err) {
      console.error('Failed to move job to dead-letter:', err);
    }
  }

  /**
   * Mark a job as resolved (manual retry or abandoned)
   */
  static async resolveJobFailure(jobId, resolutionType = 'abandoned') {
    try {
      const updated = await JobFailure.findOneAndUpdate(
        { jobId },
        {
          resolvedAt: new Date(),
          resolvedBy: resolutionType,
        },
        { new: true }
      );

      return updated;
    } catch (err) {
      console.error('Failed to resolve job failure:', err);
    }
  }

  /**
   * Get failure statistics for a merchant
   */
  static async getMerchantFailureStats(merchantId, timeRangeHours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

      const [
        totalFailures,
        deadLetteredCount,
        byReason,
        byJobType,
        unresolvedCount,
        retryableCount,
      ] = await Promise.all([
        JobFailure.countDocuments({
          merchantId,
          createdAt: { $gte: cutoffTime },
        }),
        JobFailure.countDocuments({
          merchantId,
          deadLettered: true,
          createdAt: { $gte: cutoffTime },
        }),
        JobFailure.aggregate([
          {
            $match: {
              merchantId,
              createdAt: { $gte: cutoffTime },
            },
          },
          {
            $group: {
              _id: '$failureReason',
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
        ]),
        JobFailure.aggregate([
          {
            $match: {
              merchantId,
              createdAt: { $gte: cutoffTime },
            },
          },
          {
            $group: {
              _id: '$jobType',
              count: { $sum: 1 },
            },
          },
        ]),
        JobFailure.countDocuments({
          merchantId,
          resolvedAt: { $exists: false },
          createdAt: { $gte: cutoffTime },
        }),
        JobFailure.countDocuments({
          merchantId,
          retryable: true,
          resolvedAt: { $exists: false },
          createdAt: { $gte: cutoffTime },
        }),
      ]);

      return {
        totalFailures,
        deadLetteredCount,
        unresolvedCount,
        retryableCount,
        failuresByReason: Object.fromEntries(byReason.map(r => [r._id, r.count])),
        failuresByJobType: Object.fromEntries(byJobType.map(j => [j._id, j.count])),
        timeRange: `${timeRangeHours}h`,
      };
    } catch (err) {
      console.error('Failed to get failure stats:', err);
      return null;
    }
  }

  /**
   * Get recent failures (for dashboard)
   */
  static async getRecentFailures(merchantId, limit = 10) {
    try {
      return await JobFailure.find({
        merchantId,
        deadLettered: false,
        resolvedAt: { $exists: false },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select(
          'jobId jobType messageId senderPhone failureReason attemptNumber maxAttempts error createdAt'
        )
        .lean();
    } catch (err) {
      console.error('Failed to get recent failures:', err);
      return [];
    }
  }

  /**
   * Get dead-letter queue items
   */
  static async getDeadLetterQueue(merchantId, limit = 20) {
    try {
      return await JobFailure.find({
        merchantId,
        deadLettered: true,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (err) {
      console.error('Failed to get dead-letter queue:', err);
      return [];
    }
  }

  /**
   * Get retry metrics (success rate of retries)
   */
  static async getRetryMetrics(merchantId, timeRangeHours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

      // Get all failures in time range
      const allFailures = await JobFailure.find({
        merchantId,
        createdAt: { $gte: cutoffTime },
      }).lean();

      // Group by jobId to see retry pattern
      const retryPatterns = {};
      allFailures.forEach(f => {
        if (!retryPatterns[f.jobId]) {
          retryPatterns[f.jobId] = [];
        }
        retryPatterns[f.jobId].push({
          attempt: f.attemptNumber,
          reason: f.failureReason,
          deadLettered: f.deadLettered,
        });
      });

      const totalJobs = Object.keys(retryPatterns).length;
      const jobsWithRetries = Object.values(retryPatterns).filter(p => p.length > 1).length;
      const successfulRetries = Object.values(retryPatterns).filter(
        p => p.length > 1 && !p[p.length - 1].deadLettered
      ).length;

      return {
        totalFailedJobs: totalJobs,
        jobsWithRetries,
        successfulRetries,
        retrySuccessRate: totalJobs > 0 ? ((successfulRetries / jobsWithRetries) * 100).toFixed(2) : 0,
        timeRange: `${timeRangeHours}h`,
      };
    } catch (err) {
      console.error('Failed to get retry metrics:', err);
      return null;
    }
  }
}

module.exports = FailureTrackingService;
