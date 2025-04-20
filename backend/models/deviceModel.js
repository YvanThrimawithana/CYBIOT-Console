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
    const device = await Device.findOneAndDelete({ deviceId });
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error deleting device ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
};

// Update device status
const updateDeviceStatus = async (deviceIp, status) => {
  try {
    // Look up device by IP address instead of deviceId
    const device = await Device.findOneAndUpdate(
      { ipAddress: deviceIp },
      { 
        status,
        lastSeen: new Date()
      },
      { new: true }
    );
    
    if (!device) {
      console.log(`No device found with IP: ${deviceIp}`);
      return { success: false, error: 'Device not found' };
    }
    
    console.log(`✅ Updated status for ${device.name} (${deviceIp}) to ${status}`);
    return { success: true, device };
  } catch (error) {
    console.error(`Error updating device status for IP ${deviceIp}:`, error);
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
