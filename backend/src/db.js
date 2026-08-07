const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL ||
      'mongodb://localhost:27017/Fisiai';

    // Connection pooling configuration for production
    const mongooseOptions = {
      // Server selection timeout
      serverSelectionTimeoutMS: 5000,
      
      // Connection timeouts
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      
      // Connection pooling (production-ready)
      maxPoolSize: 20,        // Maximum number of connections in the pool
      minPoolSize: 5,         // Minimum number of connections in the pool
      maxIdleTimeMS: 30000,   // Close idle connections after 30 seconds
      
      // Retry logic
      retryWrites: true,
      retryReads: true,
      
      // IPv4 only (avoids IPv6 issues)
      family: 4,
    };

    await mongoose.connect(mongoURI, mongooseOptions);

    console.log('✓ MongoDB connected successfully');
    console.log(`  Database: ${mongoose.connection.name}`);
    console.log(`  Host: ${mongoose.connection.host}`);
    console.log(`  Connection Pool: ${mongooseOptions.minPoolSize}-${mongooseOptions.maxPoolSize}`);
    
    return true;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error && error.message ? error.message : error);
    return false;
  }
};

module.exports = { connectDB, mongoose };
