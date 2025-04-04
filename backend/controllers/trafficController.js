const { getTrafficLogs, addTrafficLog, getTrafficSummary: getTrafficLogsSummary } = require("../models/trafficModel");

// Get traffic logs for a specific device
// In trafficController.js
const getTrafficLogsForDevice = (req, res) => {
    try {
        const { ip } = req.params;
        console.log("Received request for IP:", ip); // Add this logging
        
        const logs = getTrafficLogs(ip);
        console.log("Retrieved logs:", logs); // Add this logging
        
        res.json({ success: true, ip, logs });
    } catch (error) {
        console.error("Error getting traffic logs:", error);
        res.status(500).json({ success: false, error: "Failed to get traffic logs" });
    }
};

// Add a traffic log for a device
const addTrafficLogForDevice = (ip, log) => {
    try {
        const success = addTrafficLog(ip, log);
        if (!success) {
            console.error(`Failed to add traffic log for IP ${ip}`);
        }
        return success;
    } catch (error) {
        console.error("Error adding traffic log:", error);
        return false;
    }
};

// Get a summary of all traffic logs
const getTrafficLogsSummaryHandler = (req, res) => {
    try {
        const summary = getTrafficLogsSummary();
        res.json({ success: true, summary });
    } catch (error) {
        console.error("Error getting traffic summary:", error);
        res.status(500).json({ success: false, error: "Failed to get traffic summary" });
    }
};

module.exports = {
    getTrafficLogsForDevice,
    addTrafficLogForDevice,
    getTrafficLogsSummaryHandler
};