/**
 * Structured Logging Service
 * Provides consistent, structured logging with levels and context
 */

const fs = require('fs');
const path = require('path');

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level || 'INFO'];
    this.service = options.service || 'FisiAI';
    this.logDir = options.logDir || path.join(__dirname, '../../logs');
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 10;

    // Ensure log directory exists
    if (this.enableFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Format log entry as JSON
   */
  formatLog(level, message, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      service: this.service,
      level,
      message,
      context: {
        ...context,
        hostname: require('os').hostname(),
        pid: process.pid,
      },
    };
  }

  /**
   * Write log entry to console
   */
  writeToConsole(level, formatted) {
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      RESET: '\x1b[0m',
    };

    const color = colors[level] || '';
    const reset = colors.RESET;

    if (level === 'ERROR') {
      console.error(`${color}[${level}]${reset}`, JSON.stringify(formatted, null, 2));
    } else {
      console.log(`${color}[${level}]${reset}`, JSON.stringify(formatted, null, 2));
    }
  }

  /**
   * Write log entry to file with rotation
   */
  writeToFile(level, formatted) {
    try {
      const logFile = path.join(this.logDir, `${level.toLowerCase()}.log`);
      const jsonLine = JSON.stringify(formatted) + '\n';

      // Check file size and rotate if necessary
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size + jsonLine.length > this.maxFileSize) {
          this.rotateLogFile(logFile);
        }
      }

      fs.appendFileSync(logFile, jsonLine);
    } catch (error) {
      console.error('[LOG_FILE_ERROR]', error.message);
    }
  }

  /**
   * Rotate log file when size exceeds limit
   */
  rotateLogFile(logFile) {
    const dir = path.dirname(logFile);
    const ext = path.extname(logFile);
    const name = path.basename(logFile, ext);
    const baseFile = path.join(dir, name);

    // Shift existing rotated files
    for (let i = this.maxFiles; i > 1; i--) {
      const oldFile = `${baseFile}.${i}${ext}`;
      const newFile = `${baseFile}.${i + 1}${ext}`;
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile);
      }
    }

    // Rotate current file
    const rotatedFile = `${baseFile}.1${ext}`;
    if (fs.existsSync(logFile)) {
      fs.renameSync(logFile, rotatedFile);
    }
  }

  /**
   * Internal logging method
   */
  log(level, levelValue, message, context = {}) {
    if (levelValue < this.level) {
      return;
    }

    const formatted = this.formatLog(level, message, context);

    if (this.enableConsole) {
      this.writeToConsole(level, formatted);
    }

    if (this.enableFile) {
      this.writeToFile(level, formatted);
    }
  }

  /**
   * Log level: DEBUG
   */
  debug(message, context = {}) {
    this.log('DEBUG', LOG_LEVELS.DEBUG, message, context);
  }

  /**
   * Log level: INFO
   */
  info(message, context = {}) {
    this.log('INFO', LOG_LEVELS.INFO, message, context);
  }

  /**
   * Log level: WARN
   */
  warn(message, context = {}) {
    this.log('WARN', LOG_LEVELS.WARN, message, context);
  }

  /**
   * Log level: ERROR
   */
  error(message, context = {}) {
    this.log('ERROR', LOG_LEVELS.ERROR, message, context);
  }

  /**
   * Log API request
   */
  logRequest(req, res) {
    const context = {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      responseTime: res.get('X-Response-Time'),
      status: res.statusCode,
      userId: req.session?.merchantId,
    };

    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    this.log(level, LOG_LEVELS[level], `${req.method} ${req.path}`, context);
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation, duration, success = true, context = {}) {
    this.log(
      success ? 'DEBUG' : 'ERROR',
      success ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR,
      `Database ${operation}`,
      {
        ...context,
        duration: `${duration}ms`,
        success,
      }
    );
  }

  /**
   * Log external API call
   */
  logExternalAPI(service, method, duration, status, context = {}) {
    const success = status >= 200 && status < 300;
    this.log(
      success ? 'DEBUG' : 'WARN',
      success ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN,
      `External API: ${service}`,
      {
        ...context,
        method,
        status,
        duration: `${duration}ms`,
      }
    );
  }

  /**
   * Log security event
   */
  logSecurityEvent(eventType, details, severity = 'WARN') {
    this.log(
      severity,
      LOG_LEVELS[severity],
      `Security Event: ${eventType}`,
      details
    );
  }
}

// Create singleton instance
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'INFO',
  service: 'FisiAI',
  enableConsole: true,
  enableFile: process.env.NODE_ENV === 'production',
});

module.exports = logger;
