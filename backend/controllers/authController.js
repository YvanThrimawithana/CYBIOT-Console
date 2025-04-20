const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

// Import the JSON data for one-time migration
const fs = require('fs');
const path = require('path');
const usersJsonPath = path.join(__dirname, '../data/users.json');

// Authentication route handler
exports.authenticate = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username and password'
      });
    }
    
    const validation = await userModel.validateUser(username, password);

    if (!validation.success) {
      return res.status(401).json({
        success: false,
        error: validation.message || 'Invalid credentials'
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: validation.user.id, username: validation.user.username },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    // Return the token and basic user info
    res.json({
      success: true,
      token,
      user: validation.user
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during authentication'
    });
  }
};

// One-time migration function to move users from JSON to MongoDB
exports.migrateUsers = async (req, res) => {
  try {
    // Only allow this to be run in development mode
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        error: 'Migration only allowed in development mode'
      });
    }

    // Check if the users.json file exists
    if (!fs.existsSync(usersJsonPath)) {
      return res.status(404).json({
        success: false,
        error: 'users.json file not found'
      });
    }

    // Read the JSON data
    const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
    
    // Perform the migration
    const result = await userModel.migrateUsersFromJson(usersData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Migration failed'
      });
    }

    res.json({
      success: true,
      message: 'Users successfully migrated to MongoDB',
      count: usersData.length
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during migration'
    });
  }
};