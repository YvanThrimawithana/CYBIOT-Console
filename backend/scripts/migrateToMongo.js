const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import MongoDB models
const Device = require('../models/mongoSchemas/deviceSchema');
const AlertRule = require('../models/mongoSchemas/alertRuleSchema');
const Alert = require('../models/mongoSchemas/alertSchema');
const TrafficLog = require('../models/mongoSchemas/trafficLogSchema');
const Firmware = require('../models/mongoSchemas/firmwareSchema');
const PlatformSettings = require('../models/mongoSchemas/platformSettingsSchema');
const User = require('../models/mongoSchemas/userSchema');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/cybiot', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

// Read JSON file
const readJsonFile = async (filePath) => {
  try {
    const fileData = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return [];
  }
};

// Data directory - corrected path to backend/data
const dataDir = path.join(__dirname, '../data');

// Migrate devices
const migrateDevices = async () => {
  try {
    console.log('Migrating devices...');
    const devicesData = await readJsonFile(path.join(dataDir, 'devices.json'));
    
    if (devicesData && devicesData.length > 0) {
      await Device.deleteMany({}); // Clear existing data
      
      let successCount = 0;
      let errorCount = 0;
      
      // Add new data with validation and error handling
      for (const device of devicesData) {
        try {
          // Fill in required fields if missing
          const enhancedDevice = {
            deviceId: device.deviceId || `device_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: device.name || `Device ${Math.random().toString(36).substring(2, 7)}`,
            type: device.type || 'unknown',
            ...device
          };
          
          await new Device(enhancedDevice).save();
          successCount++;
        } catch (deviceError) {
          console.error(`Error saving device: ${deviceError.message}`);
          errorCount++;
        }
      }
      
      console.log(`✓ Migrated ${successCount} devices (${errorCount} errors)`);
    } else {
      console.log('No device data to migrate');
    }
  } catch (error) {
    console.error('Error migrating devices:', error.message);
  }
};

// Migrate alert rules
const migrateAlertRules = async () => {
  try {
    console.log('Migrating alert rules...');
    const rulesData = await readJsonFile(path.join(dataDir, 'alertRules.json'));
    
    if (rulesData.length > 0) {
      await AlertRule.deleteMany({}); // Clear existing data
      
      // Add new data
      for (const rule of rulesData) {
        await new AlertRule(rule).save();
      }
      
      console.log(`✓ Migrated ${rulesData.length} alert rules`);
    } else {
      console.log('No alert rules to migrate');
    }
  } catch (error) {
    console.error('Error migrating alert rules:', error.message);
  }
};

// Migrate alerts
const migrateAlerts = async () => {
  try {
    console.log('Migrating alerts...');
    const alertsData = await readJsonFile(path.join(dataDir, 'alerts.json'));
    
    if (alertsData.length > 0) {
      await Alert.deleteMany({}); // Clear existing data
      
      // Add new data with references to rules
      for (const alert of alertsData) {
        // If we have a rule reference, try to find the corresponding MongoDB rule
        if (alert.ruleId) {
          const rule = await AlertRule.findOne({ 
            name: alert.ruleName 
          });
          
          if (rule) {
            alert.ruleId = rule._id;
          }
        }
        
        await new Alert(alert).save();
      }
      
      console.log(`✓ Migrated ${alertsData.length} alerts`);
    } else {
      console.log('No alerts to migrate');
    }
  } catch (error) {
    console.error('Error migrating alerts:', error.message);
  }
};

// Migrate traffic logs
const migrateTrafficLogs = async () => {
  try {
    console.log('Migrating traffic logs...');
    const logsData = await readJsonFile(path.join(dataDir, 'trafficLogs.json'));
    
    if (logsData.length > 0) {
      await TrafficLog.deleteMany({}); // Clear existing data
      
      // Add batches for better performance with many logs
      const BATCH_SIZE = 500;
      let count = 0;
      
      for (let i = 0; i < logsData.length; i += BATCH_SIZE) {
        const batch = logsData.slice(i, i + BATCH_SIZE);
        await TrafficLog.insertMany(batch.map(log => ({
          ...log,
          timestamp: log.timestamp ? new Date(log.timestamp) : new Date()
        })));
        count += batch.length;
        console.log(`Migrated ${count}/${logsData.length} traffic logs`);
      }
      
      console.log(`✓ Migrated ${logsData.length} traffic logs`);
    } else {
      console.log('No traffic logs to migrate');
    }
  } catch (error) {
    console.error('Error migrating traffic logs:', error.message);
  }
};

// Migrate firmware
const migrateFirmware = async () => {
  try {
    console.log('Migrating firmware...');
    const firmwareData = await readJsonFile(path.join(dataDir, 'firmware.json'));
    
    if (firmwareData && firmwareData.length > 0) {
      await Firmware.deleteMany({}); // Clear existing data
      
      let successCount = 0;
      let errorCount = 0;
      
      // Add new data with validation and error handling
      for (const firmware of firmwareData) {
        try {
          // Ensure the status is valid
          const enhancedFirmware = {
            ...firmware,
            releaseDate: firmware.releaseDate ? new Date(firmware.releaseDate) : new Date(),
            // Map legacy status values to valid ones
            status: firmware.status || 'DRAFT'
          };
          
          await new Firmware(enhancedFirmware).save();
          successCount++;
        } catch (firmwareError) {
          console.error(`Error saving firmware: ${firmwareError.message}`);
          errorCount++;
        }
      }
      
      console.log(`✓ Migrated ${successCount} firmware entries (${errorCount} errors)`);
    } else {
      console.log('No firmware data to migrate');
    }
  } catch (error) {
    console.error('Error migrating firmware:', error.message);
  }
};

// Migrate platform settings
const migrateSettings = async () => {
  try {
    console.log('Migrating platform settings...');
    const settingsData = await readJsonFile(path.join(dataDir, 'platformSettings.json'));
    
    if (settingsData) {
      await PlatformSettings.deleteMany({}); // Clear existing data
      
      // Add settings with default settingsId
      await new PlatformSettings({
        ...settingsData,
        settingsId: 'global'
      }).save();
      
      console.log('✓ Migrated platform settings');
    } else {
      console.log('No platform settings to migrate');
    }
  } catch (error) {
    console.error('Error migrating platform settings:', error.message);
  }
};

// Migrate users
const migrateUsers = async () => {
  try {
    console.log('Migrating users...');
    const usersData = await readJsonFile(path.join(dataDir, 'users.json'));
    
    if (usersData && usersData.length > 0) {
      await User.deleteMany({}); // Clear existing data
      
      let successCount = 0;
      let errorCount = 0;
      
      // Add new data with validation and error handling
      for (const user of usersData) {
        try {
          // Ensure required fields are present
          const enhancedUser = {
            ...user,
            email: user.email || `${user.username || 'user'}@cybiot.local`,
            lastLogin: user.lastLogin ? new Date(user.lastLogin) : undefined
          };
          
          await new User(enhancedUser).save();
          successCount++;
        } catch (userError) {
          console.error(`Error saving user: ${userError.message}`);
          errorCount++;
        }
      }
      
      console.log(`✓ Migrated ${successCount} users (${errorCount} errors)`);
    } else {
      console.log('No users to migrate');
    }
  } catch (error) {
    console.error('Error migrating users:', error.message);
  }
};

// Run all migration functions
const migrateAll = async () => {
  try {
    console.log('Starting migration from JSON files to MongoDB...');
    await connectDB();
    
    await migrateDevices();
    await migrateAlertRules();
    await migrateAlerts();
    await migrateTrafficLogs();
    await migrateFirmware();
    await migrateSettings();
    await migrateUsers();
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Start migration
migrateAll();