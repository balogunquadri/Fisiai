/**
 * Health Check & Monitoring Service
 * Monitors system health, dependencies, and performance metrics
 */

const mongoose = require('mongoose');
const cacheService = require('../services/cacheService');

class HealthMonitor {
  constructor() {
    this.startTime = Date.now();
    this.checks = {
      database: false,
      redis: false,
      memory: false,
      disk: false,
    };
    this.lastMetrics = {
      uptime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      dbResponseTime: 0,
    };
  }

  /**
   * Check database connectivity and performance
   */
  async checkDatabase() {
    try {
      const start = Date.now();
      
      // Simple ping command
      await mongoose.connection.db.admin().ping();
      
      const duration = Date.now() - start;
      this.lastMetrics.dbResponseTime = duration;
      this.checks.database = true;

      return {
        status: 'healthy',
        responseTime: `${duration}ms`,
        connections: mongoose.connection.client?.topology?.s?.pool?.totalConnectionCount || 0,
      };
    } catch (error) {
      this.checks.database = false;
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Check Redis connectivity and performance
   */
  async checkRedis() {
    try {
      const start = Date.now();

      // Use cacheService.getStats() which safely reports connection status
      const stats = await cacheService.getStats();

      const duration = Date.now() - start;

      if (stats && stats.status === 'connected') {
        this.checks.redis = true;
        return {
          status: 'healthy',
          responseTime: `${duration}ms`,
          info: stats.info || null,
        };
      }

      // If cacheService reports an error or disconnected, surface it
      this.checks.redis = false;
      return {
        status: 'unhealthy',
        responseTime: `${duration}ms`,
        error: stats && stats.error ? stats.error : 'redis_unavailable',
      };
    } catch (error) {
      this.checks.redis = false;
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Check memory usage
   */
  checkMemory() {
    const usage = process.memoryUsage();
    this.lastMetrics.memoryUsage = usage.heapUsed;

    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
    const rssMb = (usage.rss / 1024 / 1024).toFixed(2);
    const heapUsedMb = (usage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMb = (usage.heapTotal / 1024 / 1024).toFixed(2);

    // Warn if heap usage is high
    this.checks.memory = heapUsedPercent < 85;

    return {
      status: this.checks.memory ? 'healthy' : 'warning',
      heapUsed: `${heapUsedMb}MB`,
      heapTotal: `${heapTotalMb}MB`,
      heapUsedPercent: `${heapUsedPercent.toFixed(2)}%`,
      rss: `${rssMb}MB`,
      warning: heapUsedPercent >= 85 ? 'High memory usage' : null,
    };
  }

  /**
   * Check CPU usage
   */
  checkCPU() {
    const cpuUsage = process.cpuUsage();
    this.lastMetrics.cpuUsage = cpuUsage.user;

    return {
      user: `${(cpuUsage.user / 1000).toFixed(2)}ms`,
      system: `${(cpuUsage.system / 1000).toFixed(2)}ms`,
    };
  }

  /**
   * Get system uptime
   */
  getUptime() {
    this.lastMetrics.uptime = Date.now() - this.startTime;
    const uptimeSeconds = Math.floor(this.lastMetrics.uptime / 1000);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    return {
      ms: this.lastMetrics.uptime,
      formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
    };
  }

  /**
   * Get overall health status
   */
  getOverallStatus() {
    const allHealthy = Object.values(this.checks).every(v => v === true);
    return allHealthy ? 'healthy' : 'degraded';
  }

  /**
   * Complete health check
   */
  async fullHealthCheck() {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const memoryStatus = this.checkMemory();
    const cpuStatus = this.checkCPU();
    const uptime = this.getUptime();

    return {
      status: this.getOverallStatus(),
      timestamp: new Date().toISOString(),
      uptime,
      dependencies: {
        database: dbStatus,
        redis: redisStatus,
      },
      system: {
        memory: memoryStatus,
        cpu: cpuStatus,
      },
      metrics: this.lastMetrics,
    };
  }

  /**
   * Express middleware for health check endpoint
   */
  healthCheckMiddleware(req, res) {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: this.getUptime().formatted,
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || 'unknown',
    });
  }

  /**
   * Express middleware for detailed health check endpoint
   */
  async detailedHealthCheckMiddleware(req, res) {
    try {
      const health = await this.fullHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      console.error('[HEALTH_CHECK_ERROR]', error.message);
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Start periodic health monitoring (logs alerts if issues detected)
   */
  startPeriodicMonitoring(intervalMs = 60000) {
    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.fullHealthCheck();

        if (health.status !== 'healthy') {
          console.warn('[HEALTH_ALERT]', JSON.stringify(health, null, 2));
        }

        // Check for specific alerts
        const memPercent = parseFloat(
          health.system.memory.heapUsedPercent.replace('%', '')
        );
        if (memPercent > 85) {
          console.warn(
            '[MEMORY_ALERT] High memory usage detected:',
            health.system.memory.heapUsedPercent
          );
        }

        if (!health.dependencies.database.status || health.dependencies.database.status !== 'healthy') {
          console.error('[DATABASE_ALERT] Database connection issue');
        }

        if (!health.dependencies.redis.status || health.dependencies.redis.status !== 'healthy') {
          console.error('[REDIS_ALERT] Redis connection issue');
        }
      } catch (error) {
        console.error('[MONITORING_ERROR]', error.message);
      }
    }, intervalMs);

    console.log(`✓ Health monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop periodic monitoring
   */
  stopPeriodicMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log('✓ Health monitoring stopped');
    }
  }
}

// Create singleton instance
const healthMonitor = new HealthMonitor();

module.exports = healthMonitor;
