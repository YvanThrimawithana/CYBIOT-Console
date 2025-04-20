const User = require('./mongoSchemas/userSchema');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Get all users
const getAllUsers = async () => {
  try {
    const users = await User.find({}).select('-password');
    return { success: true, users };
  } catch (error) {
    console.error('Error retrieving users:', error);
    return { success: false, error: error.message };
  }
};

// Get user by ID
const getUserById = async (id) => {
  try {
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    return { success: true, user };
  } catch (error) {
    console.error(`Error retrieving user ${id}:`, error);
    return { success: false, error: error.message };
  }
};

// Get user by username
const getUserByUsername = async (username) => {
  try {
    const user = await User.findOne({ username });
    return user;
  } catch (error) {
    console.error('Error getting user by username:', error);
    throw error;
  }
};

// Register new user
const registerUser = async (userData) => {
  try {
    console.log(`[DEBUG] Attempting to register user: ${userData.username}`);
    
    // Check if user with this username already exists
    const existingUser = await User.findOne({ username: userData.username });
    
    if (existingUser) {
      console.log(`[DEBUG] Registration failed: Username ${userData.username} already exists`);
      return { 
        success: false, 
        error: 'Username already exists' 
      };
    }
    
    console.log(`[DEBUG] Creating new user in MongoDB: ${userData.username}`);
    
    // Create new user
    const newUser = new User({
      username: userData.username,
      password: userData.password,
      role: userData.role || 'user'
    });
    
    // Log the raw user object before saving
    console.log('[DEBUG] New user object:', {
      username: newUser.username,
      passwordLength: newUser.password?.length || 0,
      role: newUser.role
    });
    
    const savedUser = await newUser.save();
    console.log(`[DEBUG] User saved to MongoDB with ID: ${savedUser._id}`);
    
    // Don't return password in the response
    const user = savedUser.toObject();
    delete user.password;
    
    // Double-check the user was actually saved
    const verifyUser = await User.findById(savedUser._id);
    if (verifyUser) {
      console.log(`[DEBUG] Verified user exists in DB: ${verifyUser.username}`);
    } else {
      console.log(`[DEBUG] WARNING: User verification failed - user not found after save!`);
    }
    
    return { success: true, user };
  } catch (error) {
    console.error('[DEBUG] Error registering user:', error);
    return { success: false, error: error.message };
  }
};

// Authenticate user
const loginUser = async (username, password) => {
  try {
    console.log(`[DEBUG] Login attempt: Looking up user '${username}' in MongoDB`);
    
    // Find user by username
    const user = await User.findOne({ username });
    
    if (!user) {
      console.log(`[DEBUG] Login failed: User '${username}' not found in MongoDB`);
      return { success: false, error: 'Invalid credentials' };
    }
    
    console.log(`[DEBUG] Found user: ${user.username} (ID: ${user._id})`);
    
    // Compare passwords
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log(`[DEBUG] Login failed: Password mismatch for user '${username}'`);
      return { success: false, error: 'Invalid credentials' };
    }
    
    console.log(`[DEBUG] Password match successful for user '${username}'`);
    
    // Update last login time
    user.lastLogin = new Date();
    await user.save();
    console.log(`[DEBUG] Updated last login time for user '${username}'`);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );
    
    // Don't return password in the response
    const userObject = user.toObject();
    delete userObject.password;
    
    console.log(`[DEBUG] Login successful for user '${username}'`);
    
    return {
      success: true,
      token,
      user: userObject
    };
  } catch (error) {
    console.error(`[DEBUG] Error during login for user '${username}':`, error);
    return { success: false, error: error.message };
  }
};

// Validate user credentials
const validateUser = async (username, password) => {
  try {
    const user = await getUserByUsername(username);
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    // Compare provided password with stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return { success: false, message: 'Invalid password' };
    }
    
    // Update last login time
    await User.updateOne({ _id: user._id }, { lastLogin: new Date() });
    
    return { 
      success: true, 
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      } 
    };
  } catch (error) {
    console.error('Error validating user:', error);
    return { success: false, error: error.message };
  }
};

// Update user
const updateUser = async (id, userData) => {
  try {
    // Check if updating username, ensure it's unique
    if (userData.username) {
      const existingUser = await User.findOne({
        _id: { $ne: id },
        username: userData.username
      });
      
      if (existingUser) {
        return { 
          success: false, 
          error: 'Username already in use' 
        };
      }
    }
    
    // If password is being updated, hash it
    if (userData.password) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      userData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    return { success: true, user };
  } catch (error) {
    console.error(`Error updating user ${id}:`, error);
    return { success: false, error: error.message };
  }
};

// Delete user
const deleteUser = async (id) => {
  try {
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error deleting user ${id}:`, error);
    return { success: false, error: error.message };
  }
};

// Migration function to transfer users from JSON to MongoDB
const migrateUsersFromJson = async (usersData) => {
  try {
    for (const userData of usersData) {
      // Check if user already exists in MongoDB
      const existingUser = await getUserByUsername(userData.username);
      
      if (!existingUser) {
        // Create user with existing password hash (no need to re-hash)
        const newUser = new User({
          username: userData.username,
          password: userData.password, // Use the already hashed password from JSON
          role: userData.role || 'user'
        });
        
        await newUser.save();
        console.log(`Migrated user: ${userData.username}`);
      }
    }
    return { success: true, message: 'Migration completed' };
  } catch (error) {
    console.error('Error migrating users:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  getUserByUsername,
  registerUser,
  loginUser,
  validateUser,
  updateUser,
  deleteUser,
  migrateUsersFromJson
};
