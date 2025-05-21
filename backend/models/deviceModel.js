const mongoose = require('mongoose');
const Device = require('./mongoSchemas/deviceSchema');

// Get all devices
const getAllDevices = async () => {
  try {
    const devices = await Device.find({});
    return { success: true, devices };
  } catch (error) {
    console.error('Error retrieving devices:', error);
    return { success: false, error: error.message };
  }
};

// Get device by ID
const getDeviceById = async (deviceId) => {
  try {
    const device = await Device.findOne({ deviceId });
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }
    
    return { success: true, device };
  } catch (error) {
    console.error(`Error retrieving device ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
};

// Get device by deviceId (from MQTT client ID)
const getDeviceByDeviceId = async (deviceId) => {
  try {
    const device = await Device.findOne({ deviceId });
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }
    
    return { success: true, device };
  } catch (error) {
    console.error(`Error retrieving device with deviceId ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
};

// Add a new device
const addDevice = async (deviceData) => {
  try {
    // Generate a unique deviceId if not provided
    if (!deviceData.deviceId) {
      deviceData.deviceId = new mongoose.Types.ObjectId().toString();
    }
    
    // Check for existing device
    const existingDevice = await Device.findOne({ deviceId: deviceData.deviceId });
    
    if (existingDevice) {
      // If device already exists with this deviceId, just return it
      return { success: true, device: existingDevice, existed: true };
    }
    
    // Create the device
    const newDevice = new Device(deviceData);
    await newDevice.save();
    
    return { success: true, device: newDevice, existed: false };
  } catch (error) {
    // Handle duplicate key error more gracefully
    if (error.code === 11000) {
      // A device was created in the time between our check and save
      // Try to get the existing device
      try {
        const existingDevice = await Device.findOne({ deviceId: deviceData.deviceId });
        if (existingDevice) {
          return { success: true, device: existingDevice, existed: true };
        }
      } catch (innerError) {
        console.error('Error retrieving existing device after duplicate key error:', innerError);
      }
    }
    
    console.error('Error creating device:', error);
    return { success: false, error: error.message };
  }
};

// Update device
const updateDevice = async (deviceId, deviceData) => {
  try {
    const device = await Device.findOneAndUpdate(
      { deviceId },
      deviceData,
      { new: true, runValidators: true }
    );
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }
    
    return { success: true, device };
  } catch (error) {
    console.error(`Error updating device ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
};

// Delete device
const deleteDevice = async (deviceId) => {
  try {
    console.log(`Attempting to delete device with identifier:`, deviceId);
    
    let device;
    
    // For MongoDB ObjectId, we need special handling
    const mongoose = require('mongoose');
    let mongoId = deviceId;
    
    // If it's an object with _id property, extract that
    if (typeof deviceId === 'object' && deviceId._id) {
      mongoId = deviceId._id;
    }
    
    // Try to convert to MongoDB ObjectId if it's a string
    let mongoObjectId;
    if (typeof mongoId === 'string' && mongoId.length === 24) {
      try {
        mongoObjectId = new mongoose.Types.ObjectId(mongoId);
      } catch (err) {
        console.log('Error converting to ObjectId:', err);
        // Continue with the string version if conversion fails
      }
    }
    
    // First attempt - direct MongoDB _id match with ObjectId
    if (mongoObjectId) {
      console.log(`Trying to delete with MongoDB ObjectId: ${mongoObjectId}`);
      device = await Device.findOneAndDelete({ _id: mongoObjectId });
    }
    
    // Second attempt - try with the string version of _id
    if (!device && typeof mongoId === 'string') {
      console.log(`Trying to delete with string _id: ${mongoId}`);
      device = await Device.findOneAndDelete({ _id: mongoId });
    }
    
    // Third attempt - try with deviceId
    if (!device && typeof mongoId === 'string') {
      console.log(`Trying to delete with deviceId: ${mongoId}`);
      device = await Device.findOneAndDelete({ deviceId: mongoId });
    }
    
    // Last attempt - try with ipAddress if the input looks like an IP
    if (!device && typeof mongoId === 'string' && mongoId.includes('.')) {
      console.log(`Trying to delete with ipAddress: ${mongoId}`);
      device = await Device.findOneAndDelete({ ipAddress: mongoId });
    }
    
    if (!device) {
      console.log(`No device found for deletion with identifier:`, deviceId);
      return { success: false, error: 'Device not found' };
    }
    
    console.log(`Successfully deleted device:`, device.name);
    return { success: true, device };
  } catch (error) {
    console.error(`Error deleting device ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
};

// Update device status
const updateDeviceStatus = async (identifier, statusData) => {
  try {
    // Check if we have required data
    if (!identifier) {
      return { success: false, error: 'Device identifier is required' };
    }

    // Handle both string status and object format
    let normalizedStatus = 'unknown';
    let ipAddress = identifier; // Default to using identifier as IP address
    let deviceId = null;
    let firmwareVersion = null;
    
    if (typeof statusData === 'string') {
      normalizedStatus = statusData.toLowerCase();
    } else if (statusData && typeof statusData === 'object') {
      normalizedStatus = statusData.status ? statusData.status.toLowerCase() : 'unknown';
      ipAddress = statusData.ipAddress || statusData.ip_address || identifier;
      deviceId = statusData.deviceId || statusData.device_id || null;
      firmwareVersion = statusData.firmwareVersion || statusData.firmware_version || null;
    }
    
    console.log(`📝 Attempting to update device status for ${identifier} to ${normalizedStatus}`);
    
    // First try to find by deviceId if it looks like a device ID (not an IP address)
    // Most device IDs won't contain dots, whereas IPs do
    let device = null;
    
    if (!identifier.includes('.')) {
      // This might be a device ID
      device = await Device.findOneAndUpdate(
        { deviceId: identifier },
        { 
          status: normalizedStatus,
          lastSeen: new Date()
        },
        { new: true }
      );
    }
    
    // If not found or if original identifier looks like an IP, try by IP address
    if (!device) {
      device = await Device.findOneAndUpdate(
        { ipAddress: ipAddress },
        { 
          status: normalizedStatus,
          lastSeen: new Date()
        },
        { new: true }
      );
    }
    
    // If still not found but we have an explicit deviceId, try that
    if (!device && deviceId) {
      device = await Device.findOneAndUpdate(
        { deviceId: deviceId },
        { 
          status: normalizedStatus,
          lastSeen: new Date(),
          ipAddress: ipAddress // Update IP if we find by device ID
        },
        { new: true }
      );
    }
    
    // Last attempt - try _id if it looks like a MongoDB ID
    if (!device && identifier.length === 24 && /^[0-9a-fA-F]{24}$/.test(identifier)) {
      try {
        const mongoose = require('mongoose');
        const mongoId = new mongoose.Types.ObjectId(identifier);
        
        device = await Device.findOneAndUpdate(
          { _id: mongoId },
          { 
            status: normalizedStatus,
            lastSeen: new Date()
          },
          { new: true }
        );
      } catch (err) {
        console.log('Error converting to ObjectId:', err);
      }
    }
    
    if (!device) {
      // If this has a device_id from heartbeat, auto-register it
      if (deviceId && ipAddress) {
        console.log(`🆕 Auto-registering new device with ID ${deviceId} and IP ${ipAddress}`);
        
        // Create a new device with basic information from heartbeat
        const newDevice = new Device({
          deviceId: deviceId,
          ipAddress: ipAddress,
          name: `Device_${deviceId.substring(0, 8)}`,  // Create a default name using first 8 chars of ID
          status: normalizedStatus,
          createdAt: Date.now(),
          lastSeen: new Date(),
          firmwareVersion: firmwareVersion || "Unknown"
        });
        
        await newDevice.save();
        console.log(`✅ Created and registered new device ${newDevice.name} with ID ${deviceId}`);
        return { success: true, device: newDevice, wasCreated: true };
      }
      
      console.log(`⚠️ No device found with ID: ${identifier} or IP: ${ipAddress}`);
      return { success: false, error: 'Device not found' };
    }
    
    console.log(`✅ Updated status for device ${device.name || device.deviceId} (${device.ipAddress || identifier}) to ${normalizedStatus}`);
    return { success: true, device };
  } catch (error) {
    console.error(`❌ Error updating device status for identifier ${identifier}:`, error);
    return { success: false, error: error.message };
  }
};

// Find or create a device (upsert operation)
const findOneAndUpdate = async (query, deviceData, options = {}) => {
  try {
    // Use Mongoose's findOneAndUpdate with upsert
    const device = await Device.findOneAndUpdate(
      query,
      deviceData,
      { new: true, ...options }
    );
    
    return device;
  } catch (error) {
    console.error('Error in findOneAndUpdate:', error);
    throw error; // Let the caller handle the error
  }
};

module.exports = {
  getAllDevices,
  getDeviceById,
  addDevice: addDevice,
  saveDevice: addDevice, // Add alias for saveDevice to match controller imports
  updateDevice,
  deleteDevice,
  deleteDeviceFromStorage: deleteDevice, // Add alias for deleteDeviceFromStorage to match controller imports
  updateDeviceStatus,
  getDeviceByDeviceId,
  findOneAndUpdate, // Add new function for upsert operations
};
