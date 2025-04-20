const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    // Get MongoDB URI from environment variable or use default
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/cybiot';
    
    console.log(`Attempting to connect to MongoDB at: ${mongoURI}`);
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
    };

    // Add connection retry logic
    let retries = 3;
    while (retries) {
      try {
        const conn = await mongoose.connect(mongoURI, options);
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`✅ Database Name: ${conn.connection.name}`);
        // List all collections to verify what's available
        const collections = await conn.connection.db.listCollections().toArray();
        console.log('Available collections:', collections.map(c => c.name).join(', ') || 'None');
        
        return true;
      } catch (err) {
        console.error(`❌ Connection attempt failed (${retries} retries left):`, err.message);
        retries -= 1;
        // Wait for 2 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!retries) {
      console.error('❌ MongoDB connection failed after multiple attempts');
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ MongoDB connection error:`, err.message);
    process.exit(1);
  }
};

// Handle connection errors after initial connection
mongoose.connection.on('error', err => {
  console.error(`❌ MongoDB connection error:`, err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
  connectDB();
});

module.exports = connectDB;