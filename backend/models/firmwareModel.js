const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { encrypt } = require('../utils/encryption');

const FIRMWARE_DATA_PATH = path.join(__dirname, '../data/firmware.json');
const FIRMWARE_FILES_DIR = path.join(__dirname, '../data/firmware_files');
const ANALYSIS_DIR = path.join(__dirname, '../data/analysis_results');

class FirmwareModel {
    static #cache = new Map(); // In-memory cache
    static CACHE_TTL = 1000 * 60 * 5; // 5 minutes

    static async init() {
        // Create necessary directories
        await fs.mkdir(FIRMWARE_FILES_DIR, { recursive: true });
        await fs.mkdir(ANALYSIS_DIR, { recursive: true });
        
        if (!await this.fileExists(FIRMWARE_DATA_PATH)) {
            await fs.writeFile(FIRMWARE_DATA_PATH, '[]');
        }
    }

    static async getAll() {
        const data = await fs.readFile(FIRMWARE_DATA_PATH, 'utf8');
        return JSON.parse(data);
    }

    static async save(firmwareData, fileBuffer) {
        const firmwares = await this.getAll();
        const firmwareId = uuidv4();
        const timestamp = Date.now();
        
        const metadata = {
            id: firmwareId,
            name: firmwareData.name,
            version: firmwareData.version,
            hash: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
            deviceType: firmwareData.deviceType,
            size: fileBuffer.length,
            uploadDate: new Date(timestamp).toISOString(),
            status: 'pending',
            metadata: {
                description: firmwareData.description,
                uploadedBy: firmwareData.userId,
                targetDevices: firmwareData.targetDevices || [],
                originalName: firmwareData.originalName
            },
            filePath: path.join(FIRMWARE_FILES_DIR, `${firmwareId}.enc`),
            analysisPath: null,
            analysisStatus: null,
            lastModified: new Date(timestamp).toISOString()
        };

        try {
            // Encrypt the firmware buffer before saving
            const encryptedBuffer = encrypt(fileBuffer.toString('base64'));
            await fs.writeFile(metadata.filePath, encryptedBuffer);
            
            firmwares.push(metadata);
            await fs.writeFile(FIRMWARE_DATA_PATH, JSON.stringify(firmwares));
            return metadata;
        } catch (error) {
            await this.cleanup(metadata.filePath);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const firmwares = await this.getAll();
            const firmware = firmwares.find(f => f.id === id);
            
            if (!firmware) return null;

            // Return the firmware data without attempting decryption
            return {
                ...firmware,
                metadata: firmware.metadata // Let controller handle decryption
            };
        } catch (error) {
            console.error('Error finding firmware:', error);
            return null;
        }
    }

    static async update(id, updates) {
        const firmwares = await this.getAll();
        const index = firmwares.findIndex(f => f.id === id);
        
        if (index === -1) throw new Error('Firmware not found');
        
        firmwares[index] = { ...firmwares[index], ...updates };
        await fs.writeFile(FIRMWARE_DATA_PATH, JSON.stringify(firmwares));
        return firmwares[index];
    }

    static async getFirmwareFile(id) {
        const firmware = await this.findById(id);
        if (!firmware) return null;
        
        // Return encrypted data
        return await fs.readFile(firmware.filePath, 'utf8');
    }

    static async saveAnalysisResult(id, results) {
        const analysisPath = path.join(ANALYSIS_DIR, `${id}_results.json`);
        await fs.writeFile(analysisPath, JSON.stringify(results));
        
        const firmware = await this.findById(id);
        if (firmware) {
            firmware.status = 'analyzed';
            firmware.analysisPath = analysisPath;
            firmware.analysisResult = results;
            await this.update(id, firmware);
        }
        return firmware;
    }

    static async getAnalysisResult(id) {
        const firmware = await this.findById(id);
        if (!firmware) return null;

        try {
            if (firmware.analysisResult) {
                return firmware.analysisResult;
            }
            if (firmware.analysisPath) {
                const data = await fs.readFile(firmware.analysisPath, 'utf8');
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error(`Error reading analysis results for ${id}:`, error);
            return null;
        }
    }

    static async fileExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    static async cleanup(filePath) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.error('Failed to clean up file:', error);
        }
    }

    static async delete(id) {
        const firmwares = await this.getAll();
        const firmware = firmwares.find(f => f.id === id);
        
        if (!firmware) throw new Error('Firmware not found');

        // Delete associated files
        try {
            if (firmware.filePath) await fs.unlink(firmware.filePath);
            if (firmware.analysisPath) await fs.unlink(firmware.analysisPath);
        } catch (error) {
            console.error('Error deleting files:', error);
        }

        // Remove from data file
        const updatedFirmwares = firmwares.filter(f => f.id !== id);
        await fs.writeFile(FIRMWARE_DATA_PATH, JSON.stringify(updatedFirmwares));
    }

    // Helper methods for analysis
    static countIssues(results) {
        return Object.values(results.static).reduce((acc, curr) => acc + curr.length, 0);
    }

    static calculateSecurityScore(results) {
        // ... existing security score calculation ...
    }

    static getSeverityBreakdown(results) {
        const severity = { HIGH: 0, MEDIUM: 0, LOW: 0 };
        Object.values(results.static).forEach(issues => {
            issues.forEach(issue => {
                severity[issue.severity]++;
            });
        });
        return severity;
    }
}

FirmwareModel.init();
module.exports = FirmwareModel;
