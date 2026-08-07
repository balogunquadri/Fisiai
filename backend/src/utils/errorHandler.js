/**
 * Error Handling Utilities
 * Provides consistent error handling, logging, and recovery mechanisms
 */

/**
 * Create a structured error log entry
 */
function createErrorLog(errorType, error, context = {}) {
  return {
    type: errorType,
    timestamp: new Date().toISOString(),
    message: error?.message || String(error),
    stack: error?.stack,
    context,
  };
}

/**
 * Log error with context information
 */
function logError(errorType, error, context = {}) {
  const logEntry = createErrorLog(errorType, error, context);
  console.error(`[${errorType}]`, JSON.stringify(logEntry, null, 2));
  return logEntry;
}

/**
 * Async wrapper to catch and handle errors in async functions
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logError('ASYNC_HANDLER_ERROR', error, {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      next(error);
    });
  };
}

/**
 * Safe async execution with retry logic
 */
async function executeWithRetry(
  fn,
  maxRetries = 3,
  delayMs = 1000,
  backoffMultiplier = 2
) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Calculate backoff delay
      const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      
      if (attempt < maxRetries) {
        console.warn(
          `[RETRY] Attempt ${attempt} failed, retrying in ${delay}ms`,
          error.message
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper for promises
 */
function withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        const error = new Error(timeoutMessage);
        error.code = 'TIMEOUT';
        error.status = 504; // Gateway Timeout
        reject(error);
      }, timeoutMs)
    ),
  ]);
}

/**
 * Safe external API call with timeout and error handling
 */
async function callExternalAPI(
  apiFunction,
  timeoutMs = 10000,
  retryOptions = { enabled: true, maxRetries: 2 }
) {
  try {
    const fn = () => withTimeout(apiFunction(), timeoutMs);
    
    if (retryOptions.enabled) {
      return await executeWithRetry(fn, retryOptions.maxRetries);
    }
    
    return await fn();
  } catch (error) {
    logError('EXTERNAL_API_ERROR', error, {
      timeout: timeoutMs,
      retries: retryOptions,
    });
    throw error;
  }
}

/**
 * Validation helper with structured error responses
 */
function validateRequired(data, fields) {
  const errors = [];
  
  fields.forEach(field => {
    if (!data[field]) {
      errors.push(`${field} is required`);
    }
  });
  
  if (errors.length > 0) {
    const error = new Error('Validation failed');
    error.status = 400;
    error.details = errors;
    throw error;
  }
}

/**
 * Safe database operation with error handling
 */
async function safeDBOperation(
  operation,
  errorMessage = 'Database operation failed',
  retryOptions = { enabled: true, maxRetries: 2 }
) {
  try {
    if (retryOptions.enabled) {
      return await executeWithRetry(() => operation(), retryOptions.maxRetries);
    }
    return await operation();
  } catch (error) {
    logError('DB_OPERATION_ERROR', error, { operation: errorMessage });
    
    // Provide user-friendly error messages for common DB errors
    if (error.name === 'MongoNetworkError') {
      const networkError = new Error('Database connection failed');
      networkError.status = 503; // Service Unavailable
      throw networkError;
    }
    
    if (error.name === 'MongooseValidationError') {
      const validationError = new Error('Invalid data provided');
      validationError.status = 400;
      validationError.details = Object.values(error.errors).map(e => e.message);
      throw validationError;
    }
    
    throw error;
  }
}

/**
 * Safe file operation with cleanup on error
 */
async function safeFileOperation(operation, cleanupFn) {
  try {
    return await operation();
  } catch (error) {
    logError('FILE_OPERATION_ERROR', error);
    
    // Attempt cleanup
    if (cleanupFn) {
      try {
        await cleanupFn();
      } catch (cleanupError) {
        logError('FILE_CLEANUP_ERROR', cleanupError);
      }
    }
    
    throw error;
  }
}

/**
 * Graceful error handler for uncaught exceptions
 */
function setupUncaughtErrorHandlers() {
  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    logError('UNCAUGHT_EXCEPTION', error);
    console.error('Server shutting down due to uncaught exception');
    process.exit(1);
  });
  
  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logError('UNHANDLED_REJECTION', new Error(String(reason)), {
      promise: String(promise),
    });
  });
  
  // Deprecation warnings
  process.on('warning', (warning) => {
    logError('NODE_WARNING', warning);
  });
}

/**
 * Express error handling middleware
 */
function errorMiddleware(err, req, res, next) {
  logError('EXPRESS_ERROR', err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.session?.merchantId,
  });
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const details = err.details || undefined;
  
  res.status(status).json({
    success: false,
    error: {
      message,
      status,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      ...(details && { details }),
    },
  });
}

module.exports = {
  createErrorLog,
  logError,
  asyncHandler,
  executeWithRetry,
  withTimeout,
  callExternalAPI,
  validateRequired,
  safeDBOperation,
  safeFileOperation,
  setupUncaughtErrorHandlers,
  errorMiddleware,
};
