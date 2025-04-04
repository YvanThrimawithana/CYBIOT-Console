const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const FIRMWARE_DATA_PATH = path.join(__dirname, '../data/firmware.json');
const FIRMWARE_FILES_DIR = path.join(__dirname, '../data/firmware_files');
const ANALYSIS_DIR = path.join(__dirname, '../data/analysis_results');

class FirmwareModel {
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
        if (!fileBuffer) {
            throw new Error('File buffer is required');
        }

        const firmwares = await this.getAll();
        const id = Date.now().toString();
        
        // Generate unique filenames
        const encryptedFilePath = path.join(FIRMWARE_FILES_DIR, `${id}.enc`);
        
        try {
            // Save encrypted firmware file separately
            await this.encryptAndSaveFile(fileBuffer, encryptedFilePath);

            // Store metadata in JSON
            const metadata = {
                id,
                name: firmwareData.name,
                version: firmwareData.version,
                description: firmwareData.description,
                deviceType: firmwareData.deviceType,
                size: firmwareData.size,
                uploadDate: new Date(),
                status: 'pending',
                filePath: encryptedFilePath
            };

            firmwares.push(metadata);
            await fs.writeFile(FIRMWARE_DATA_PATH, JSON.stringify(firmwares, null, 2));
            return metadata;
        } catch (error) {
            // Clean up if file was created but metadata save failed
            try {
                await fs.unlink(encryptedFilePath);
            } catch (e) {
                console.error('Failed to clean up file:', e);
            }
            throw error;
        }
    }

    static async findById(id) {
        const firmwares = await this.getAll();
        return firmwares.find(f => f.id === id);
    }

    static async update(id, updates) {
        const firmwares = await this.getAll();
        const index = firmwares.findIndex(f => f.id === id);
        if (index === -1) return null;
        firmwares[index] = { ...firmwares[index], ...updates };
        await fs.writeFile(FIRMWARE_DATA_PATH, JSON.stringify(firmwares, null, 2));
        return firmwares[index];
    }

    static async getFirmwareFile(id) {
        const firmware = await this.findById(id);
        if (!firmware) return null;
        
        // Read and decrypt the firmware file
        const encryptedData = await fs.readFile(firmware.filePath);
        return this.decryptFile(encryptedData);
    }

    static async encryptAndSaveFile(buffer, filePath) {
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'your-secure-key', 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        const encrypted = Buffer.concat([
            iv,
            cipher.update(buffer),
            cipher.final()
        ]);
        
        await fs.writeFile(filePath, encrypted);
    }

    static async decryptFile(encryptedBuffer) {
        const iv = encryptedBuffer.slice(0, 16);
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'your-secure-key', 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        
        const encryptedData = encryptedBuffer.slice(16);
        return Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);
    }

    static async fileExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }
}

FirmwareModel.init();
module.exports = FirmwareModel;
