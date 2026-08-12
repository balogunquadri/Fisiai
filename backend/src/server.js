
const express = require('express');
const path = require('path');
const cors = require('cors');

const helmet = require('helmet');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');


require('dotenv').config();

const cacheService = require('./services/cacheService');
const batchWriteService = require('./services/batchWriteService');
const { connectDB } = require('./db');
const { apiLimiter, webhookLimiter } = require('./middleware/rateLimiter');
const healthMonitor = require('./services/healthMonitor');
const fs = require('fs');


const app = express();


if (process.env.EMBEDDED_WORKERS === 'true') {
  require('./workers/webhookWorker');
  require('./workers/mediaWorker');
}
// // Start queue processors in the same web process
// require('./workers/webhookWorker');
// require('./workers/mediaWorker');

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet());
const allowedOrigins = (
  process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy does not allow access from origin ${origin}`));
      }
    },
    credentials: true,
  })
);

// ============================================
// REQUEST SIZE & TIMEOUT MIDDLEWARE
// ============================================
// Limit JSON payload size to 1MB
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

// Limit URL-encoded payload size to 1MB
app.use(express.urlencoded({ 
  limit: '1mb', 
  extended: true 
}));

// Set request timeout (30 seconds)
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout
  res.setTimeout(30000);
  next();
});

// Serve generated documents (e.g. receipts/invoices) for Twilio to fetch
app.use('/docs', express.static(path.resolve(__dirname, '..', 'tmp-docs')));

app.set('trust proxy', 1);

app.use(
  session({
    name: process.env.SESSION_NAME || 'Fisiai.sid',
    secret: process.env.SESSION_SECRET || 'Fisiai-session-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/Fisiai',
      collectionName: 'sessions',
      ttl: 60 * 60 * 24 * 7,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================
app.get('/health', (req, res) => {
  healthMonitor.healthCheckMiddleware(req, res);
});

app.get('/health/detailed', async (req, res) => {
  await healthMonitor.detailedHealthCheckMiddleware(req, res);
});

// Apply rate limiting to all API endpoints (except health and webhooks)
app.use('/api/', (req, res, next) => {
  // Webhook endpoints have their own rate limiter
  if (req.path.startsWith('/webhooks/')) {
    return webhookLimiter(req, res, next);
  }
  // Apply general API rate limiting
  return apiLimiter(req, res, next);
});

if (process.env.ENABLE_HEAPDUMP === 'true') {
  app.get('/debug/heapdump', (req, res) => {
    if (!heapdump) {
      return res.status(503).json({ success: false, error: 'heapdump not available' });
    }

    const dumpDir = path.resolve(__dirname, '..', 'tmp-docs');
    if (!fs.existsSync(dumpDir)) {
      fs.mkdirSync(dumpDir, { recursive: true });
    }

    const filename = path.join(dumpDir, `heapdump-${Date.now()}.heapsnapshot`);
    heapdump.writeSnapshot(filename, (err, file) => {
      if (err) {
        console.error('✗ Heapdump write failed:', err.message);
        return res.status(500).json({ success: false, error: err.message });
      }

      console.log(`✓ Heapdump written: ${file}`);
      return res.json({ success: true, file });
    });
  });
}

// Mount all API routes
const { mountRoutes } = require('./routes/index');
mountRoutes(app);

// Error handling middleware
const { errorMiddleware, setupUncaughtErrorHandlers } = require('./utils/errorHandler');
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

// ============================================
// SERVER STARTUP
// ============================================
const startServer = async () => {
  try {
    // Setup uncaught error handlers
    setupUncaughtErrorHandlers();

    // Test database connection before starting the server
    const dbConnected = await connectDB();
    if (!dbConnected) {
      console.error('✗ Server startup aborted: MongoDB connection is required.');
      process.exit(1);
    }

    // ============================================
    // CREATE DATABASE INDEXES (Production Optimization)
    // ============================================
    if (process.env.NODE_ENV === 'production') {
      try {
        console.log('\n📊 Creating production database indexes...');
        const { createProductionIndexes } = require('./db/indexes');
        await createProductionIndexes();
        console.log('✓ Database indexes verified/created');
      } catch (error) {
        console.warn('⚠️  Warning: Could not create indexes:', error.message);
        // Don't fail startup, indexes may already exist
      }
    }

    // ============================================
    // INITIALIZE OPTIMIZATION SERVICES
    // ============================================
    
    // Initialize Redis cache
    console.log('\n🔧 Initializing optimization services...');
    await cacheService.initializeRedis();
    
    // Initialize batch write service
    batchWriteService.initialize();

    // Start health monitoring (periodic checks every 60 seconds)
    healthMonitor.startPeriodicMonitoring(60000);

    const cacheStats = await cacheService.getStats();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 Detailed health: http://localhost:${PORT}/health/detailed`);
      console.log(`✓ Cache service: ${cacheStats.status}`);
      console.log(`✓ Batch write service: ready`);
      console.log(`✓ Health monitoring: active`);
      console.log(`\n✓ FisiAI Backend Ready\n`);
    });
  } catch (error) {
    console.error('[SERVER_STARTUP_ERROR]', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⛔ Shutting down gracefully...');
  
  // Stop health monitoring
  healthMonitor.stopPeriodicMonitoring();
  
  // Flush pending batch writes
  await batchWriteService.shutdown();
  
  // Close cache connection
  await cacheService.closeConnection();
  
  // Close database connection
  await mongoose.connection.close();
  console.log('✓ Database connection closed');
  
  process.exit(0);
});

startServer();

module.exports = app;
