const mongoose = require('mongoose');
const User = require('../models/mongoSchemas/userSchema');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Utility function to verify MongoDB connection and collections
 * Also creates a test user if no users are found
 */
const verifyDbSetup = async () => {
  try {
    console.log('🔍 Verifying MongoDB setup...');
    
    // Check if connection is established
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ MongoDB is not connected!');
      return false;
    }
    
    // Get database name
    const dbName = mongoose.connection.db.databaseName;
    console.log(`✅ Connected to database: ${dbName}`);
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📚 Available collections:', collections.map(c => c.name).join(', ') || 'None');
    
    // Check if users collection exists
    const usersCollection = collections.find(c => c.name === 'users');
    if (!usersCollection) {
      console.log('⚠️ Users collection does not exist yet - it will be created when first user is added');
    } else {
      // Count users
      const userCount = await User.countDocuments();
      console.log(`👤 Found ${userCount} user(s) in database`);
      
      if (userCount > 0) {
        // Show sample users (just usernames)
        const sampleUsers = await User.find().select('username role -_id').limit(5);
        console.log('Sample users:', sampleUsers.map(u => `${u.username} (${u.role})`));
      }
    }
    
    // Create test user if no users exist
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🛠️ No users found. Creating test user...');
      
      try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('testpass123', salt);
        
        const testUser = new User({
          username: 'testuser',
          password: hashedPassword,
          role: 'admin'
        });
        
        await testUser.save();
        console.log('✅ Created test user: testuser / testpass123');
      } catch (error) {
        console.error('❌ Failed to create test user:', error.message);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error verifying database setup:', error);
    return false;
  }
};

module.exports = { verifyDbSetup };