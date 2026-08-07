/**
 * Cache Service - Redis-based caching for merchant profiles and sessions
 * Reduces database load by storing frequently accessed data in memory
 */

const redis = require('redis');
const Merchant = require('../models/Merchant');

let redisClient = null;
let isConnected = false;

// Cache TTLs (in seconds)
const CACHE_TTL = {
  MERCHANT_PROFILE: 1800,    // 30 minutes
  MERCHANT_SESSION: 3600,    // 60 minutes
  ACTIVITY_SUMMARY: 300,     // 5 minutes
};

/**
 * Initialize Redis connection
 */
async function initializeRedis() {
  try {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;
    const redisPassword = process.env.REDIS_PASSWORD;
    const useTls = process.env.REDIS_TLS === 'true';

    const redisConfig = {
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('✗ Redis: Max reconnection attempts exceeded');
            return new Error('Redis max retries exceeded');
          }
          return retries * 50;
        },
      },
    };

    if (redisUrl) {
      redisConfig.url = redisUrl;
      console.log('🔧 Redis URL detected, using REDIS_URL');
    } else if (useTls) {
      const encodedPassword = redisPassword ? `:${encodeURIComponent(redisPassword)}@` : '';
      redisConfig.url = `rediss://${encodedPassword}${redisHost}:${redisPort}`;
      console.log('🔧 REDIS_TLS=true, using rediss:// connection URL');
    } else {
      redisConfig.socket.host = redisHost;
      redisConfig.socket.port = Number(redisPort);
      if (redisPassword) {
        redisConfig.password = redisPassword;
      }
    }

    if (useTls && !redisUrl) {
      redisConfig.socket.tls = true;
    }

    redisClient = redis.createClient(redisConfig);

    redisClient.on('error', (err) => {
      console.error('✗ Redis client error:', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('✓ Redis connected');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      console.log('✓ Redis ready for commands');
    });

    await redisClient.connect();
    isConnected = true;
    console.log('✓ Redis cache service initialized');
    return true;
  } catch (err) {
    console.warn('⚠ Redis initialization failed, operating without cache:', err.message);
    isConnected = false;
    return false;
  }
}

/**
 * Get cached merchant profile
 * Falls back to database if cache miss
 */
async function getCachedMerchant(phoneNumber) {
  try {
    if (!isConnected || !redisClient) {
      // Cache disabled, fetch from DB
      return await Merchant.findOne({ phone: phoneNumber }).lean();
    }

    const cacheKey = `merchant:${phoneNumber}`;

    // Try cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`✓ Cache hit: ${cacheKey}`);
      return JSON.parse(cached);
    }

    console.log(`⊘ Cache miss: ${cacheKey}`);

    // Cache miss - load from database
    let merchant = await Merchant.findOne({ phone: phoneNumber }).lean();

    if (!merchant) {
      // Create new merchant if doesn't exist
      const newMerchant = new Merchant({
        phone: phoneNumber,
        name: `Merchant ${phoneNumber}`,
        email: `merchant-${Date.now()}@Fisiai.local`,
        businessType: 'Retail',
      });
      merchant = await newMerchant.save();
      merchant = merchant.toObject();
    }

    // Cache the result
    await redisClient.setEx(
      cacheKey,
      CACHE_TTL.MERCHANT_PROFILE,
      JSON.stringify(merchant)
    );

    return merchant;
  } catch (err) {
    console.error('✗ Cache error (falling back to DB):', err.message);
    // Fallback to database
    return await Merchant.findOne({ phone: phoneNumber }).lean();
  }
}

/**
 * Invalidate merchant cache when profile is updated
 */
async function invalidateMerchantCache(phoneNumber) {
  try {
    if (!isConnected || !redisClient) return;

    const cacheKey = `merchant:${phoneNumber}`;
    const result = await redisClient.del(cacheKey);
    console.log(`✓ Cache invalidated: ${cacheKey} (${result} key deleted)`);
  } catch (err) {
    console.error('✗ Cache invalidation error:', err.message);
  }
}

/**
 * Invalidate merchant by ID
 */
async function invalidateMerchantCacheById(merchantId, phoneNumber) {
  try {
    if (!isConnected || !redisClient) return;

    if (phoneNumber) {
      await invalidateMerchantCache(phoneNumber);
    }

    const idCacheKey = `merchant-id:${merchantId}`;
    await redisClient.del(idCacheKey);
  } catch (err) {
    console.error('✗ Cache invalidation error:', err.message);
  }
}

/**
 * Get or set cache value (generic)
 */
async function get(key) {
  try {
    if (!isConnected || !redisClient) return null;
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('✗ Cache get error:', err.message);
    return null;
  }
}

/**
 * Set cache value with TTL
 */
async function set(key, value, ttl = 300) {
  try {
    if (!isConnected || !redisClient) return false;
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('✗ Cache set error:', err.message);
    return false;
  }
}

/**
 * Delete cache key
 */
async function del(key) {
  try {
    if (!isConnected || !redisClient) return false;
    const result = await redisClient.del(key);
    return result > 0;
  } catch (err) {
    console.error('✗ Cache del error:', err.message);
    return false;
  }
}

/**
 * Clear all cache (use with caution)
 */
async function flushAll() {
  try {
    if (!isConnected || !redisClient) return false;
    await redisClient.flushAll();
    console.log('✓ Cache flushed');
    return true;
  } catch (err) {
    console.error('✗ Cache flush error:', err.message);
    return false;
  }
}

/**
 * Get cache stats
 */
async function getStats() {
  try {
    if (!isConnected || !redisClient) return { status: 'disconnected' };
    const info = await redisClient.info('stats');
    return { status: 'connected', info };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

/**
 * Close Redis connection
 */
async function closeConnection() {
  try {
    if (redisClient) {
      await redisClient.quit();
      isConnected = false;
      console.log('✓ Redis connection closed');
    }
  } catch (err) {
    console.error('✗ Error closing Redis connection:', err.message);
  }
}

module.exports = {
  initializeRedis,
  getCachedMerchant,
  invalidateMerchantCache,
  invalidateMerchantCacheById,
  get,
  set,
  del,
  flushAll,
  getStats,
  closeConnection,
  CACHE_TTL,
};

/**
 * Conversation session helpers
 */
async function getSession(merchantId, phone) {
  try {
    if (!merchantId || !phone) return null;
    const key = `session:${merchantId}:${phone}`;
    const data = await get(key);
    return data;
  } catch (err) {
    console.error('✗ getSession error:', err.message);
    return null;
  }
}

async function setSession(merchantId, phone, sessionObj, ttl = CACHE_TTL.MERCHANT_SESSION) {
  try {
    if (!merchantId || !phone) return false;
    const key = `session:${merchantId}:${phone}`;
    return await set(key, sessionObj, ttl);
  } catch (err) {
    console.error('✗ setSession error:', err.message);
    return false;
  }
}

async function delSession(merchantId, phone) {
  try {
    if (!merchantId || !phone) return false;
    const key = `session:${merchantId}:${phone}`;
    return await del(key);
  } catch (err) {
    console.error('✗ delSession error:', err.message);
    return false;
  }
}

// expose session helpers
module.exports.getSession = getSession;
module.exports.setSession = setSession;
module.exports.delSession = delSession;
