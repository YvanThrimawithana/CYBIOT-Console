const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Script to drop the problematic email index from the users collection
 * This resolves the E11000 duplicate key error for null email values
 */
const fixEmailIndex = async (disconnectAfter = true) => {
  try {
    console.log('Connecting to MongoDB to fix email index issue...');
    
    // Connect to MongoDB only if not already connected
    if (mongoose.connection.readyState !== 1) {
      const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/cybiot';
      await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }
    
    console.log(`Connected to MongoDB database: ${mongoose.connection.db.databaseName}`);

    // List all indexes on the users collection
    const indexes = await mongoose.connection.db.collection('users').indexes();
    console.log('Current indexes on users collection:');
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Find and drop the email index
    const emailIndex = indexes.find(index => index.key.email !== undefined);
    
    if (emailIndex) {
      console.log(`Found problematic email index: ${emailIndex.name}`);
      await mongoose.connection.db.collection('users').dropIndex(emailIndex.name);
      console.log('✅ Successfully dropped the email index!');
    } else {
      console.log('No email index found - nothing to drop.');
    }

    console.log('Index fix completed.');
    return true;
  } catch (error) {
    console.error('Error fixing email index:', error);
    return false;
  } finally {
    // Only disconnect if called directly as a script (not from server)
    if (disconnectAfter && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
};

// Run the function if this script is executed directly
if (require.main === module) {
  fixEmailIndex(true).then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Error running fixEmailIndex:', err);
    process.exit(1);
  });
}

module.exports = { fixEmailIndex };