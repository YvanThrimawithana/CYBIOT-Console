const FirmwareModel = require('../models/firmwareModel');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const AnalysisService = require('../services/analysisService');

// Update encryption key setup
const ENCRYPTION_KEY = crypto.scryptSync(
    config.encryptionKey || 'your-secure-encryption-key', 
    'salt', 
    32
); // Generate 32-byte key

const encrypt = (data) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (data) => {
    const parts = data.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
};

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

        // Pass both metadata and file buffer to save method
        const firmware = await FirmwareModel.save({
            name: req.body.name || req.file.originalname,
            version: req.body.version || '1.0.0',
            description: req.body.description,
            deviceType: req.body.deviceType,
            size: req.file.size,
            uploadDate: new Date(),
            status: 'pending'
        }, req.file.buffer); // Pass the buffer as second argument

        console.log('Firmware saved:', {
            id: firmware.id,
            name: firmware.name,
            size: firmware.size
        });

        res.status(201).json({
            success: true,
            message: 'Firmware uploaded successfully',
            firmware: {
                id: firmware.id,
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
        const firmwares = await FirmwareModel.getAll();
        res.json(firmwares.map(f => {
            const { encryptedData, ...rest } = f;
            return rest;
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getFirmwareById = async (req, res) => {
    try {
        const firmware = await FirmwareModel.findById(req.params.id);
        if (!firmware) return res.status(404).json({ message: 'Firmware not found' });
        
        const decryptedData = decrypt(firmware.encryptedData);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(decryptedData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.analyzeFirmware = async (req, res) => {
    try {
        const firmware = await FirmwareModel.findById(req.params.id);
        if (!firmware) return res.status(404).json({ message: 'Firmware not found' });

        await FirmwareModel.update(req.params.id, { status: 'analyzing' });
        
        // Get the decrypted firmware file
        const decryptedData = await FirmwareModel.getFirmwareFile(req.params.id);
        
        // Send for analysis
        const { resultPath } = await AnalysisService.sendFirmwareForAnalysis(
            decryptedData,
            `${firmware.name}.bin`
        );

        // Read and encrypt analysis results
        const analysisResults = await fs.readFile(resultPath, 'utf8');
        const encryptedAnalysis = encrypt(analysisResults);

        // Update firmware record
        await FirmwareModel.update(req.params.id, {
            analysisResult: encryptedAnalysis,
            status: 'analyzed'
        });

        res.json({ 
            message: 'Analysis completed', 
            id: firmware.id 
        });
    } catch (error) {
        console.error('Analysis failed:', error);
        await FirmwareModel.update(req.params.id, { status: 'error' });
        res.status(500).json({ error: error.message });
    }
};

exports.getAnalysisResult = async (req, res) => {
    try {
        const firmware = await FirmwareModel.findById(req.params.id);
        if (!firmware) return res.status(404).json({ message: 'Firmware not found' });
        if (!firmware.analysisResult) return res.status(404).json({ message: 'No analysis results found' });

        const decryptedAnalysis = decrypt(firmware.analysisResult);
        res.json(JSON.parse(decryptedAnalysis));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
