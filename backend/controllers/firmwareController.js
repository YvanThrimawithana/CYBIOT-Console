const FirmwareModel = require('../models/firmwareModel');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const AnalysisService = require('../services/analysisService');
const { encrypt, decrypt } = require('../utils/encryption');

exports.uploadFirmware = async (req, res) => {
    try {
        console.log('Upload request received:', {
            headers: req.headers,
            fileInfo: req.file,
            body: req.body
        });

        if (!req.file) {
            throw new Error('No file uploaded');
        }

        if (!req.file.buffer || req.file.buffer.length === 0) {
            throw new Error('Uploaded file is empty');
        }

        if (!req.body.deviceType) {
            throw new Error('Device type is required');
        }

        // Validate file size (e.g., max 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (req.file.size > maxSize) {
            throw new Error('File size exceeds limit (50MB)');
        }

        // Generate hash for integrity check
        const hash = crypto.createHash('sha256');
        hash.update(req.file.buffer);
        const fileHash = hash.digest('hex');

        // Pass both metadata and file buffer to save method
        const result = await FirmwareModel.addFirmware({
            name: req.body.name || req.file.originalname,
            version: req.body.version || '1.0.0',
            description: req.body.description,
            deviceType: req.body.deviceType,
            size: req.file.size,
            hash: fileHash,
            uploadDate: new Date(),
            status: 'pending'
        }, req.file.buffer); // Pass the buffer directly

        if (!result.success) {
            throw new Error(result.error || 'Failed to save firmware');
        }

        const firmware = result.firmware;

        console.log('Firmware saved:', {
            id: firmware._id,
            name: firmware.name,
            size: firmware.fileSize
        });

        res.status(201).json({
            success: true,
            message: 'Firmware uploaded successfully',
            firmware: {
                id: firmware._id,
                name: firmware.name,
                version: firmware.version,
                status: firmware.status
            }
        });
    } catch (error) {
        console.error('Upload failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Upload failed'
        });
    }
};

exports.getFirmwareList = async (req, res) => {
    try {
        const result = await FirmwareModel.getAllFirmware();
        if (!result.success) {
            throw new Error(result.error);
        }
        
        const firmwares = result.firmware.map(f => ({
            id: f._id,
            name: f.name,
            version: f.version,
            deviceType: f.deviceType,
            uploadDate: f.uploadDate,
            status: f.status,
            fileSize: f.fileSize,
            securityScore: f.securityScore
        }));
        
        res.json(firmwares);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getFirmwareById = async (req, res) => {
    try {
        const result = await FirmwareModel.getFirmwareById(req.params.id);
        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        const firmware = result.firmware;
        
        // Get analysis results if available
        const analysisResults = await FirmwareModel.getAnalysisResult(req.params.id);

        const sanitizedResponse = {
            id: firmware._id,
            name: firmware.name,
            version: firmware.version,
            deviceType: firmware.deviceType,
            description: firmware.description,
            uploadDate: firmware.uploadDate,
            status: firmware.status,
            fileSize: firmware.fileSize,
            securityScore: firmware.securityScore,
            analysis: analysisResults
        };

        res.json(sanitizedResponse);
    } catch (error) {
        console.error('Error fetching firmware:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
};

exports.analyzeFirmware = async (req, res) => {
    try {
        const result = await FirmwareModel.getFirmwareById(req.params.id);
        if (!result.success) {
            return res.status(404).json({ error: 'Firmware not found' });
        }
        const firmware = result.firmware;

        // Update status to analyzing
        await FirmwareModel.updateFirmware(req.params.id, { status: 'analyzing' });
        
        try {
            // Get firmware binary from GridFS
            const fileBuffer = await FirmwareModel.getFirmwareFile(req.params.id);
            
            // Send for analysis - now saves directly to MongoDB
            const analysisResult = await AnalysisService.sendFirmwareForAnalysis(
                fileBuffer,
                `${firmware._id}_${firmware.name}`
            );
            
            // Update firmware status to analyzed
            await FirmwareModel.updateFirmware(req.params.id, { status: 'analyzed' });

            // Get the results directly from the response
            const parsedResults = analysisResult.results;
            
            res.json({ 
                message: 'Analysis completed and saved to MongoDB', 
                id: firmware._id,
                results: parsedResults 
            });
        } catch (analysisError) {
            console.error('Analysis processing failed:', analysisError);
            await FirmwareModel.updateFirmware(req.params.id, { 
                status: 'error',
                analysisError: analysisError.message
            });
            throw new Error(`Analysis failed: ${analysisError.message}`);
        }
    } catch (error) {
        console.error('Analysis failed:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getAnalysisResult = async (req, res) => {
    try {
        const result = await FirmwareModel.getFirmwareById(req.params.id);
        if (!result.success) {
            return res.status(404).json({ error: 'Firmware not found' });
        }

        // Get results directly from MongoDB
        const results = await FirmwareModel.getAnalysisResult(req.params.id);
        if (!results) {
            return res.status(404).json({ error: 'Analysis results not found' });
        }

        // Add error handling for malformed results
        if (!results.static || typeof results.static !== 'object') {
            console.error('Malformed analysis results:', results);
            return res.status(500).json({ error: 'Invalid analysis results format' });
        }

        res.json(results);
    } catch (error) {
        console.error('Failed to fetch analysis results:', error);
        res.status(500).json({ 
            error: 'Failed to fetch analysis results',
            details: error.message 
        });
    }
};

exports.downloadFirmware = async (req, res) => {
    try {
        const result = await FirmwareModel.getFirmwareById(req.params.id);
        if (!result.success) {
            return res.status(404).json({ error: 'Firmware not found' });
        }
        
        const firmware = result.firmware;
        
        // Get firmware binary from GridFS
        const fileBuffer = await FirmwareModel.getFirmwareFile(req.params.id);
        
        // Set headers for file download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=${firmware.fileName || 'firmware.bin'}`);
        res.setHeader('Content-Length', fileBuffer.length);
        
        // Send the file
        res.send(fileBuffer);
    } catch (error) {
        console.error('Download failed:', error);
        res.status(500).json({ error: 'Failed to download firmware' });
    }
};

exports.deleteFirmware = async (req, res) => {
    try {
        const result = await FirmwareModel.deleteFirmware(req.params.id);
        if (!result.success) {
            return res.status(404).json({ error: result.error || 'Firmware not found' });
        }

        res.json({ message: 'Firmware deleted successfully' });
    } catch (error) {
        console.error('Delete failed:', error);
        res.status(500).json({ error: 'Failed to delete firmware' });
    }
};

exports.sendFirmwareReport = async (req, res) => {
    try {
        const { email, reportFormat } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false,
                error: 'Email address is required' 
            });
        }
        
        const result = await FirmwareModel.getFirmwareById(req.params.id);
        if (!result.success) {
            return res.status(404).json({ 
                success: false,
                error: 'Firmware not found' 
            });
        }
        
        const firmware = result.firmware;
        
        // Check if firmware has analysis results
        if (firmware.status !== 'analyzed' || !firmware.analysis) {
            return res.status(400).json({ 
                success: false,
                error: 'No analysis results available for this firmware' 
            });
        }
        
        // Import the email service
        const { sendFirmwareAnalysisReport } = require('../utils/emailService');
        
        // Generate and send the report
        const emailResult = await sendFirmwareAnalysisReport(firmware, email, reportFormat || 'pdf');
        
        if (!emailResult.success) {
            return res.status(500).json({ 
                success: false,
                error: emailResult.error || 'Failed to send email report' 
            });
        }
        
        res.json({ 
            success: true,
            message: `Analysis report sent to ${email}` 
        });
    } catch (error) {
        console.error('Error sending firmware report:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Failed to send firmware report' 
        });
    }
};
