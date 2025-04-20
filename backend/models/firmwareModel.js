const Firmware = require('./mongoSchemas/firmwareSchema');
const fs = require('fs');
const path = require('path');

// Store firmware files in this directory
const firmwareDir = path.join(__dirname, '../uploads/firmware');

// Ensure the firmware directory exists
const ensureFirmwareDirectory = () => {
  if (!fs.existsSync(firmwareDir)) {
    fs.mkdirSync(firmwareDir, { recursive: true });
  }
};

// Get all firmware
const getAllFirmware = async () => {
  try {
    const firmware = await Firmware.find({}).sort({ releaseDate: -1 });
    return { success: true, firmware };
  } catch (error) {
    console.error('Error retrieving firmware:', error);
    return { success: false, error: error.message };
  }
};

// Get firmware by ID
const getFirmwareById = async (id) => {
  try {
    const firmware = await Firmware.findById(id);
    
    if (!firmware) {
      return { success: false, error: 'Firmware not found' };
    }
    
    return { success: true, firmware };
  } catch (error) {
    console.error(`Error retrieving firmware ${id}:`, error);
    return { success: false, error: error.message };
  }
};

// Get firmware by version and device type
const getFirmwareByVersion = async (version, deviceType) => {
  try {
    const firmware = await Firmware.findOne({ version, deviceType });
    
    if (!firmware) {
      return { success: false, error: 'Firmware not found' };
    }
    
    return { success: true, firmware };
  } catch (error) {
    console.error(`Error retrieving firmware ${version} for ${deviceType}:`, error);
    return { success: false, error: error.message };
  }
};

// Add new firmware
const addFirmware = async (firmwareData, file) => {
  try {
    ensureFirmwareDirectory();
    
    // Check if firmware with this version already exists for this device type
    const existingFirmware = await Firmware.findOne({
      version: firmwareData.version,
      deviceType: firmwareData.deviceType
    });
    
    if (existingFirmware) {
      return { success: false, error: 'Firmware with this version already exists for this device type' };
    }
    
    let filePath = null;
    let fileName = null;
    let fileSize = null;
    
    // Save file if provided
    if (file) {
      fileName = `${firmwareData.deviceType}-${firmwareData.version}-${Date.now()}${path.extname(file.originalname)}`;
      filePath = path.join(firmwareDir, fileName);
      
      // Write file to disk
      fs.writeFileSync(filePath, file.buffer);
      fileSize = file.size;
    }
    
    // Create new firmware record
    const newFirmware = new Firmware({
      ...firmwareData,
      fileName,
      filePath,
      fileSize,
      releaseDate: firmwareData.releaseDate || new Date()
    });
    
    await newFirmware.save();
    
    return { success: true, firmware: newFirmware };
  } catch (error) {
    console.error('Error adding firmware:', error);
    return { success: false, error: error.message };
  }
};

// Update firmware
const updateFirmware = async (id, firmwareData) => {
  try {
    const firmware = await Firmware.findByIdAndUpdate(
      id,
      firmwareData,
      { new: true, runValidators: true }
    );
    
    if (!firmware) {
      return { success: false, error: 'Firmware not found' };
    }
    
    return { success: true, firmware };
  } catch (error) {
    console.error(`Error updating firmware ${id}:`, error);
    return { success: false, error: error.message };
  }
};

// Delete firmware
const deleteFirmware = async (id) => {
  try {
    const firmware = await Firmware.findById(id);
    
    if (!firmware) {
      return { success: false, error: 'Firmware not found' };
    }
    
    // Delete file if it exists
    if (firmware.filePath && fs.existsSync(firmware.filePath)) {
      fs.unlinkSync(firmware.filePath);
    }
    
    await Firmware.findByIdAndDelete(id);
    
    return { success: true };
  } catch (error) {
    console.error(`Error deleting firmware ${id}:`, error);
    return { success: false, error: error.message };
  }
};

// Get latest firmware for a device type
const getLatestFirmware = async (deviceType) => {
  try {
    const firmware = await Firmware.findOne({ 
      deviceType,
      isActive: true 
    }).sort({ releaseDate: -1 });
    
    if (!firmware) {
      return { success: false, error: 'No active firmware found for this device type' };
    }
    
    return { success: true, firmware };
  } catch (error) {
    console.error(`Error retrieving latest firmware for ${deviceType}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  getAllFirmware,
  getFirmwareById,
  getFirmwareByVersion,
  addFirmware,
  updateFirmware,
  deleteFirmware,
  getLatestFirmware
};
