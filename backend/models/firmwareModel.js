const Firmware = require('./mongoSchemas/firmwareSchema');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

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
const addFirmware = async (firmwareData, fileBuffer) => {
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
    
    let fileName = null;
    let fileSize = null;
    
    // Generate a unique file name
    fileName = `${firmwareData.deviceType}-${firmwareData.version}-${Date.now()}.bin`;
    fileSize = fileBuffer ? fileBuffer.length : 0;

    // Create new firmware record
    const newFirmware = new Firmware({
      ...firmwareData,
      fileName,
      fileSize,
      releaseDate: firmwareData.releaseDate || new Date()
    });
    
    // First save the firmware document to get an ID
    await newFirmware.save();
    
    // Now save the binary file to GridFS if we have a buffer
    if (fileBuffer) {
      await saveFirmwareToGridFS(newFirmware._id.toString(), fileBuffer, fileName);
    }
    
    return { success: true, firmware: newFirmware };
  } catch (error) {
    console.error('Error adding firmware:', error);
    return { success: false, error: error.message };
  }
};

// Save firmware binary to GridFS
const saveFirmwareToGridFS = async (firmwareId, fileBuffer, fileName) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: 'firmwareBinaries' });
    
    // Create a readable stream from the buffer
    const readableFileStream = require('stream').Readable.from(fileBuffer);
    
    // Create an upload stream to GridFS with metadata
    const uploadStream = bucket.openUploadStream(fileName, {
      metadata: {
        firmwareId: firmwareId,
        uploadDate: new Date()
      }
    });
    
    // Pipe the file buffer to the upload stream
    return new Promise((resolve, reject) => {
      readableFileStream.pipe(uploadStream)
        .on('error', (error) => {
          console.error('Error uploading to GridFS:', error);
          reject(error);
        })
        .on('finish', () => {
          console.log(`File ${fileName} saved to GridFS with id: ${uploadStream.id}`);
          resolve(uploadStream.id);
        });
    });
  } catch (error) {
    console.error('Error saving firmware binary to GridFS:', error);
    throw error;
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

// Get firmware binary from GridFS
const getFirmwareFile = async (firmwareId) => {
  try {
    const firmware = await Firmware.findById(firmwareId);
    if (!firmware) {
      throw new Error('Firmware not found');
    }
    
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: 'firmwareBinaries' });
    
    // Find the latest file for this firmware
    const files = await db.collection('firmwareBinaries.files')
      .find({ 'metadata.firmwareId': firmwareId })
      .sort({ uploadDate: -1 })
      .limit(1)
      .toArray();
      
    if (!files || files.length === 0) {
      throw new Error('Firmware binary not found in GridFS');
    }
    
    // Return as a buffer
    return new Promise((resolve, reject) => {
      const chunks = [];
      const downloadStream = bucket.openDownloadStream(files[0]._id);
      
      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      downloadStream.on('error', (error) => {
        reject(error);
      });
      
      downloadStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  } catch (error) {
    console.error(`Error retrieving firmware file ${firmwareId}:`, error);
    throw error;
  }
};

// Save analysis results in the firmware document
const saveAnalysisResult = async (firmwareId, analysisResults) => {
  try {
    const firmware = await Firmware.findById(firmwareId);
    if (!firmware) {
      return { success: false, error: 'Firmware not found' };
    }
    
    // Add analysis results directly to the document
    firmware.analysis = analysisResults;
    firmware.analysisDate = new Date();
    
    // Calculate security score if vulnerabilities exist
    if (analysisResults.static) {
      let totalVulnerabilities = 0;
      let highSeverity = 0;
      
      // Count vulnerabilities by type and severity
      Object.values(analysisResults.static).forEach(vulnList => {
        if (Array.isArray(vulnList)) {
          totalVulnerabilities += vulnList.length;
          vulnList.forEach(vuln => {
            if (vuln.severity === 'HIGH') highSeverity++;
          });
        }
      });
      
      // Simple scoring algorithm - can be improved
      const securityScore = totalVulnerabilities > 0 
        ? Math.max(0, 10 - (totalVulnerabilities * 0.5) - (highSeverity * 1.5))
        : 10;
        
      firmware.securityScore = parseFloat(securityScore.toFixed(1));
    }
    
    await firmware.save();
    return { success: true };
  } catch (error) {
    console.error(`Error saving analysis results for firmware ${firmwareId}:`, error);
    return { success: false, error: error.message };
  }
};

// Get analysis results
const getAnalysisResult = async (firmwareId) => {
  try {
    const firmware = await Firmware.findById(firmwareId).select('analysis');
    if (!firmware || !firmware.analysis) {
      return null;
    }
    return firmware.analysis;
  } catch (error) {
    console.error(`Error retrieving analysis results for firmware ${firmwareId}:`, error);
    return null;
  }
};

// Delete firmware
const deleteFirmware = async (id) => {
  try {
    const firmware = await Firmware.findById(id);
    
    if (!firmware) {
      return { success: false, error: 'Firmware not found' };
    }
    
    // Delete GridFS files if they exist
    try {
      const db = mongoose.connection.db;
      const bucket = new GridFSBucket(db, { bucketName: 'firmwareBinaries' });
      
      // Find all files for this firmware
      const files = await db.collection('firmwareBinaries.files')
        .find({ 'metadata.firmwareId': id })
        .toArray();
      
      // Delete each file
      for (const file of files) {
        await bucket.delete(file._id);
      }
    } catch (gridfsError) {
      console.error(`Error deleting firmware files from GridFS: ${gridfsError.message}`);
      // Continue with deletion of the document even if file deletion fails
    }
    
    await Firmware.findByIdAndDelete(id);
    
    return { success: true };
  } catch (error) {
    console.error(`Error deleting firmware ${id}:`, error);
    return { success: false, error: error.message };
  }
};

// Get firmware by device type
const getFirmwareByDeviceType = async (deviceType) => {
  try {
    const firmware = await Firmware.find({ deviceType }).sort({ uploadDate: -1 });
    
    if (!firmware || firmware.length === 0) {
      return { success: false, error: `No firmware found for device type: ${deviceType}` };
    }
    
    return { success: true, firmware };
  } catch (error) {
    console.error(`Error retrieving firmware for device type ${deviceType}:`, error);
    return { success: false, error: error.message };
  }
};

// Get latest firmware for a device type
const getLatestFirmware = async (deviceType) => {
  try {
    const firmware = await Firmware.findOne({ deviceType })
      .sort({ uploadDate: -1 })
      .limit(1);
    
    if (!firmware) {
      return { success: false, error: 'No firmware found for this device type' };
    }
    
    return { success: true, firmware };
  } catch (error) {
    console.error('Error getting latest firmware:', error);
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
  getFirmwareByDeviceType,
  getLatestFirmware,
  saveAnalysisResult,
  getAnalysisResult,
  getFirmwareFile,
  saveFirmwareToGridFS
};
