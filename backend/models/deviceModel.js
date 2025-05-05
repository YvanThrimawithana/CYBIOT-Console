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

// Add a new device
const addDevice = async (deviceData) => {
  try {
    // Generate a unique deviceId if not provided
    if (!deviceData.deviceId) {
      deviceData.deviceId = new mongoose.Types.ObjectId().toString();
    }
    
    // Check for existing device
    const existingDevice = await Device.findOne({ 
      $or: [
        { deviceId: deviceData.deviceId },
        { ipAddress: deviceData.ipAddress }
      ]
    });
    
    if (existingDevice) {
      return { success: false, error: 'Device with this ID or IP address already exists' };
    }
    
    const newDevice = new Device(deviceData);
    await newDevice.save();
    
    return { success: true, device: newDevice };
  } catch (error) {
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
const updateDeviceStatus = async (deviceIp, status) => {
  try {
    // Normalize status to lowercase for consistency
    const normalizedStatus = status.toLowerCase();
    
    console.log(`📝 Attempting to update device status for ${deviceIp} to ${normalizedStatus}`);
    
    // Look up device by IP address
    const device = await Device.findOneAndUpdate(
      { ipAddress: deviceIp },
      { 
        status: normalizedStatus,
        lastSeen: new Date()
      },
      { new: true }
    );
    
    if (!device) {
      // Try with 'ip' field as fallback (for backward compatibility)
      const deviceByIp = await Device.findOneAndUpdate(
        { ip: deviceIp },
        { 
          status: normalizedStatus,
          lastSeen: new Date()
        },
        { new: true }
      );
      
      if (!deviceByIp) {
        console.log(`⚠️ No device found with IP: ${deviceIp}`);
        return { success: false, error: 'Device not found' };
      }
      
      console.log(`✅ Updated status for ${deviceByIp.name} (${deviceIp}) to ${normalizedStatus}`);
      return { success: true, device: deviceByIp };
    }
    
    console.log(`✅ Updated status for ${device.name} (${deviceIp}) to ${normalizedStatus}`);
    return { success: true, device };
  } catch (error) {
    console.error(`❌ Error updating device status for IP ${deviceIp}:`, error);
    return { success: false, error: error.message };
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
};
