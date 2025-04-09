const crypto = require('crypto');
const config = require('../config/config');

const ENCRYPTION_KEY = crypto.scryptSync(
    config.encryptionKey,
    'salt',
    32
);

const encrypt = (data) => {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
        let encrypted = cipher.update(jsonString, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
};

const decrypt = (data) => {
    try {
        if (!data || typeof data !== 'string' || !data.includes(':')) {
            return data;
        }

        const [ivHex, encryptedData] = data.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        try {
            return JSON.parse(decrypted);
        } catch {
            return decrypted;
        }
    } catch (error) {
        console.error('Decryption error:', error);
        return data;
    }
};

module.exports = { encrypt, decrypt };
