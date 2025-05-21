const mongoose = require('mongoose');
const UnregisteredDevice = require('./mongoSchemas/unregisteredDeviceSchema');

// Get all unregistered devices
const getAllUnregisteredDevices = async () => {
  try {
    const devices = await UnregisteredDevice.find({});
    return { success: true, devices };
  } catch (error) {
    console.error('Error retrieving unregistered devices:', error);
    return { success: false, error: error.message };
  }
};

// Get unregistered device by deviceId
const getUnregisteredDeviceByDeviceId = async (deviceId) => {
  try {
    const device = await UnregisteredDevice.findOne({ deviceId });
    
    if (!device) {
      return { success: false, error: 'Unregistered device not found' };
    }
    
    return { success: true, device };
  } catch (error) {
    console.error(`Error retrieving unregistered device with deviceId ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
};

// Update or create unregistered device
const updateOrCreateUnregisteredDevice = async (deviceData) => {
  try {
    const device = await UnregisteredDevice.findOneAndUpdate(
      { deviceId: deviceData.deviceId },
      {
        deviceId: deviceData.deviceId,
        ipAddress: deviceData.ipAddress,
        firmwareVersion: deviceData.firmwareVersion || 'unknown',
        lastSeen: new Date(),
        metrics: deviceData.metrics || {}
      },
      { 
        new: true, 
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
    
    return { success: true, device };
  } catch (error) {
    console.error('Error updating/creating unregistered device:', error);
    return { success: false, error: error.message };
  }
};

// Remove unregistered device (used after device is registered)
const removeUnregisteredDevice = async (deviceId) => {
  try {
    await UnregisteredDevice.deleteOne({ deviceId });
    return { success: true };
  } catch (error) {
    console.error(`Error removing unregistered device ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  getAllUnregisteredDevices,
  getUnregisteredDeviceByDeviceId,
  updateOrCreateUnregisteredDevice,
  removeUnregisteredDevice
};
