require('dotenv').config();

const config = {
    port: process.env.PORT || 5000,
    encryptionKey: process.env.ENCRYPTION_KEY,
    analysis: {
        serverUrl: process.env.ANALYSIS_SERVER_URL,
        apiKey: process.env.ANALYSIS_SERVER_API_KEY,
        timeout: 300000, // 5 minutes timeout for analysis
        retryAttempts: 3
    }
};

if (!config.analysis.serverUrl) {
    console.warn('Warning: ANALYSIS_SERVER_URL not set. Firmware analysis will not work.');
}

module.exports = config;
