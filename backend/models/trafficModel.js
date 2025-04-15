const fs = require("fs");
const path = require("path");

// Define the paths
const dataDir = path.join(__dirname, "../data");
const trafficLogsPath = path.join(dataDir, "trafficLogs.json");

// Ensure the data directory exists
const ensureDataDirectory = () => {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
};

// Initialize the logs file if it doesn't exist
const initializeLogsFile = () => {
    if (!fs.existsSync(trafficLogsPath)) {
        fs.writeFileSync(trafficLogsPath, JSON.stringify({}, null, 2), "utf8");
    }
};

// Read logs safely with error handling
const readLogs = () => {
    try {
        ensureDataDirectory();
        initializeLogsFile();
        const data = fs.readFileSync(trafficLogsPath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading traffic logs:", error);
        return {};
    }
};

// Write logs safely with error handling
const writeLogs = (logs) => {
    try {
        ensureDataDirectory();
        fs.writeFileSync(trafficLogsPath, JSON.stringify(logs, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("Error writing traffic logs:", error);
        return false;
    }
};

// Get traffic logs for a given device by IP address
const getTrafficLogs = (ip) => {
    const logs = readLogs();
    // If IP is provided, return logs for that IP, otherwise return all logs
    if (ip) {
        return logs[ip] || [];
    }
    // Return all logs combined when no IP is specified
    return Object.values(logs).reduce((allLogs, ipLogs) => allLogs.concat(ipLogs), []);
};

// Add a new traffic log for a device
const addTrafficLog = (ip, log) => {
    try {
        const logs = readLogs();
        
        // Initialize array for IP if it doesn't exist
        if (!logs[ip]) {
            logs[ip] = [];
        }

        // Add timestamp if not present
        if (!log.timestamp) {
            log.timestamp = new Date().toISOString();
        }

        // Limit the number of logs per device (optional, prevent file from growing too large)
        const MAX_LOGS_PER_DEVICE = 1000;
        if (logs[ip].length >= MAX_LOGS_PER_DEVICE) {
            logs[ip] = logs[ip].slice(-MAX_LOGS_PER_DEVICE + 1);
        }

        // Add the new log
        logs[ip].push(log);

        // Save the updated logs
        if (writeLogs(logs)) {
            console.log(`✅ Traffic log saved for IP ${ip}`);
            return true;
        } else {
            console.error(`❌ Failed to save traffic log for IP ${ip}`);
            return false;
        }
    } catch (error) {
        console.error("Error adding traffic log:", error);
        return false;
    }
};

// Get a summary of traffic logs
const getTrafficSummary = () => {
    try {
        return readLogs();
    } catch (error) {
        console.error("Error getting traffic summary:", error);
        return {};
    }
};

module.exports = {
    getTrafficLogs,
    addTrafficLog,
    getTrafficSummary
};