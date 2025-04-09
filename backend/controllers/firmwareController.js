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
        if (!firmware) {
            return res.status(404).json({ error: 'Firmware not found' });
        }

        // Get analysis results
        const analysisResults = await FirmwareModel.getAnalysisResult(req.params.id);
        
        // Only attempt to decrypt metadata if it exists and appears to be encrypted
        const metadata = firmware.metadata ? 
            (typeof firmware.metadata === 'string' ? decrypt(firmware.metadata) : firmware.metadata) : 
            firmware.metadata;

        const sanitizedResponse = {
            ...firmware,
            analysis: analysisResults,
            filePath: undefined,
            analysisPath: undefined,
            metadata: metadata
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
        const firmware = await FirmwareModel.findById(req.params.id);
        if (!firmware) return res.status(404).json({ message: 'Firmware not found' });

        await FirmwareModel.update(req.params.id, { status: 'analyzing' });
        
        const encryptedData = await FirmwareModel.getFirmwareFile(req.params.id);
        const decryptedData = Buffer.from(decrypt(encryptedData), 'base64');
        
        try {
            // Use original firmware name for analysis
            const { resultPath } = await AnalysisService.sendFirmwareForAnalysis(
                decryptedData,
                `${firmware.id}_${firmware.name}`
            );

            // Read analysis results
            const analysisResults = await fs.readFile(resultPath, 'utf8');
            
            // Try to parse JSON, if fails create a default structure
            let parsedResults;
            try {
                parsedResults = JSON.parse(analysisResults);
            } catch (parseError) {
                console.warn('Invalid JSON from analyzer:', analysisResults);
                parsedResults = {
                    static: {
                        info: [{ 
                            message: analysisResults,
                            severity: 'INFO'
                        }],
                        errors: []
                    },
                    dynamic: {
                        open_ports: [],
                        fuzzing_results: [],
                        timeline: []
                    }
                };
            }
            
            // Save results with firmware ID
            await FirmwareModel.saveAnalysisResult(req.params.id, parsedResults);
            await FirmwareModel.update(req.params.id, { status: 'analyzed' });

            res.json({ 
                message: 'Analysis completed', 
                id: firmware.id,
                results: parsedResults 
            });
        } catch (analysisError) {
            console.error('Analysis processing failed:', analysisError);
            await FirmwareModel.update(req.params.id, { 
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
        const firmware = await FirmwareModel.findById(req.params.id);
        if (!firmware) {
            return res.status(404).json({ error: 'Firmware not found' });
        }

        // Get results directly from firmware model
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

exports.deleteFirmware = async (req, res) => {
    try {
        const firmware = await FirmwareModel.findById(req.params.id);
        if (!firmware) {
            return res.status(404).json({ error: 'Firmware not found' });
        }

        await FirmwareModel.delete(req.params.id);
        
        res.json({ message: 'Firmware deleted successfully' });
    } catch (error) {
        console.error('Delete failed:', error);
        res.status(500).json({ error: 'Failed to delete firmware' });
    }
};
