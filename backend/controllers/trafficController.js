const { getTrafficLogs, addTrafficLog, getTrafficSummary: getTrafficLogsSummary } = require("../models/trafficModel");
const { getAllDevices } = require("../models/deviceModel");
const fs = require('fs');
const path = require('path');

const getTrafficLogsForDevice = async (req, res) => {
    try {
        const { ip } = req.params;
        const { since } = req.query;
        let logs = await getTrafficLogs(ip);
        
        // If 'since' parameter is provided, filter logs to only include those newer than the timestamp
        if (since) {
            const sinceDate = new Date(since);
            logs = logs.filter(log => new Date(log.timestamp) > sinceDate);
        }
        
        // Add device information
        const devices = getAllDevices();
        const deviceInfo = devices.find(d => d.ip === ip) || {};
        
        res.json({ 
            success: true, 
            ip, 
            logs,
            deviceInfo
        });
    } catch (error) {
        console.error("Error getting traffic logs:", error);
        res.status(500).json({ success: false, error: "Failed to get traffic logs" });
    }
};

const addTrafficLogForDevice = (ip, log) => {
    try {
        return addTrafficLog(ip, log);
    } catch (error) {
        console.error("Error adding traffic log:", error);
        return false;
    }
};

const getTrafficLogsSummaryHandler = (req, res) => {
    try {
        const summary = getTrafficLogsSummary();
        res.json({ success: true, summary });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to get traffic summary" });
    }
};

const getTrafficAlerts = async (req, res) => {
    try {
        const { ip } = req.params;
        const logs = await getTrafficLogs(ip);
        
        // Filter and process alerts
        const alerts = logs
            .filter(log => {
                const severity = determineSeverity(log);
                return severity === 'HIGH' || severity === 'MEDIUM';
            })
            .map(log => ({
                ...log,
                alertType: determineAlertType(log),
                severity: determineSeverity(log),
                recommendation: generateRecommendation(log)
            }));

        res.json({ success: true, alerts });
    } catch (error) {
        console.error("Error getting alerts:", error);
        res.status(500).json({ success: false, error: "Failed to get alerts" });
    }
};

const getDeviceMetrics = async (req, res) => {
    try {
        const { ip } = req.params;
        const logs = await getTrafficLogs(ip);
        
        const metrics = {
            totalTraffic: logs.length,
            protocols: countProtocols(logs),
            hourlyActivity: calculateHourlyActivity(logs),
            topDestinations: getTopDestinations(logs),
            performanceMetrics: calculatePerformanceMetrics(logs)
        };

        res.json({ success: true, metrics });
    } catch (error) {
        console.error("Error getting device metrics:", error);
        res.status(500).json({ success: false, error: "Failed to get device metrics" });
    }
};

const getUserActivity = async (req, res) => {
    try {
        const { ip } = req.params;
        const logs = await getTrafficLogs(ip);
        
        const userActivity = {
            sessions: extractUserSessions(logs),
            behaviors: analyzeUserBehavior(logs),
            anomalies: detectAnomalies(logs)
        };

        res.json({ success: true, userActivity });
    } catch (error) {
        console.error("Error getting user activity:", error);
        res.status(500).json({ success: false, error: "Failed to get user activity" });
    }
};

// Helper functions for SIEM analysis
/**
 * Determines the severity level of a log entry based on its content
 * HIGH: Contains 'error', 'fail', or 'denied' in the info field
 * MEDIUM: Contains 'warn' or 'retry' in the info field
 * LOW: All other logs (default severity)
 */
const determineSeverity = (log) => {
    const info = log.source?.info?.toLowerCase() || '';
    if (info.includes('error') || info.includes('fail') || info.includes('denied')) return 'HIGH';
    if (info.includes('warn') || info.includes('retry')) return 'MEDIUM';
    return 'LOW';
};

const determineCategory = (log) => {
    const info = log.source?.info?.toLowerCase() || '';
    if (info.includes('auth') || info.includes('login')) return 'AUTHENTICATION';
    if (info.includes('firewall') || info.includes('security')) return 'SECURITY';
    if (info.includes('ping') || info.includes('tcp')) return 'NETWORK';
    if (info.includes('device') || info.includes('iot')) return 'IOT';
    return 'SYSTEM';
};

const calculateMetrics = (log) => ({
    timestamp: log.timestamp,
    bytesTransferred: log.raw?.length || 0,
    protocol: log.source?.protocol || 'UNKNOWN',
    responseTime: Math.floor(Math.random() * 100) // Simulated response time
});

const determineAlertType = (log) => {
    const info = log.source?.info?.toLowerCase() || '';
    if (info.includes('brute')) return 'BRUTE_FORCE_ATTEMPT';
    if (info.includes('denial') || info.includes('dos')) return 'DOS_ATTEMPT';
    if (info.includes('injection')) return 'INJECTION_ATTEMPT';
    if (info.includes('unauthorized')) return 'UNAUTHORIZED_ACCESS';
    return 'SUSPICIOUS_ACTIVITY';
};

const generateRecommendation = (log) => {
    const alertType = determineAlertType(log);
    const recommendations = {
        BRUTE_FORCE_ATTEMPT: 'Implement rate limiting and account lockout policies',
        DOS_ATTEMPT: 'Configure DDoS protection and traffic filtering',
        INJECTION_ATTEMPT: 'Update input validation and sanitization',
        UNAUTHORIZED_ACCESS: 'Review access controls and authentication mechanisms',
        SUSPICIOUS_ACTIVITY: 'Monitor and investigate unusual patterns'
    };
    return recommendations[alertType] || 'Review security logs and update policies';
};

const countProtocols = (logs) => {
    return logs.reduce((acc, log) => {
        const protocol = log.source?.protocol || 'UNKNOWN';
        acc[protocol] = (acc[protocol] || 0) + 1;
        return acc;
    }, {});
};

const calculateHourlyActivity = (logs) => {
    const hourly = new Array(24).fill(0);
    logs.forEach(log => {
        const hour = new Date(log.timestamp).getHours();
        hourly[hour]++;
    });
    return hourly;
};

const getTopDestinations = (logs) => {
    const destinations = {};
    logs.forEach(log => {
        const dst = log.source?.dstIp;
        if (dst) destinations[dst] = (destinations[dst] || 0) + 1;
    });
    return Object.entries(destinations)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .reduce((acc, [ip, count]) => ({ ...acc, [ip]: count }), {});
};

const calculatePerformanceMetrics = (logs) => ({
    averageResponseTime: Math.floor(Math.random() * 100), // Simulated
    packetLoss: Math.random() * 0.01, // Simulated
    bandwidth: Math.floor(Math.random() * 1000) // Simulated
});

const extractUserSessions = (logs) => {
    // Simplified session extraction
    const sessions = new Map();
    logs.forEach(log => {
        const srcIp = log.source?.srcIp;
        if (!srcIp) return;
        
        if (!sessions.has(srcIp)) {
            sessions.set(srcIp, {
                startTime: log.timestamp,
                endTime: log.timestamp,
                eventCount: 1
            });
        } else {
            const session = sessions.get(srcIp);
            session.endTime = log.timestamp;
            session.eventCount++;
        }
    });
    return Array.from(sessions.entries()).map(([ip, session]) => ({
        ip,
        ...session
    }));
};

const analyzeUserBehavior = (logs) => {
    // Simplified behavior analysis
    return {
        normalPatterns: ['Regular heartbeat signals', 'Standard HTTP traffic'],
        unusualPatterns: []
    };
};

const detectAnomalies = (logs) => {
    // Basic anomaly detection
    return logs
        .filter(log => determineSeverity(log) === 'HIGH')
        .map(log => ({
            timestamp: log.timestamp,
            type: determineAlertType(log),
            description: log.source?.info || 'Unknown anomaly',
            severity: 'HIGH'
        }));
};

const getAllTrafficLogs = async (req, res) => {
    try {
        const allLogs = await getTrafficLogsSummary();
        const logs = [];
        const devices = {};

        Object.entries(allLogs).forEach(([deviceIp, deviceLogs]) => {
            if (Array.isArray(deviceLogs) && deviceLogs.length > 0) {
                // Process each log and add deviceIp
                const processedLogs = deviceLogs.map(log => ({
                    ...log,
                    deviceIp
                }));
                
                logs.push(...processedLogs);
                
                // Add device summary
                devices[deviceIp] = {
                    totalEvents: deviceLogs.length,
                    lastActivity: deviceLogs[deviceLogs.length - 1]?.timestamp || null,
                    status: 'active',
                    eventSummary: {
                        high: deviceLogs.filter(log => determineSeverity(log) === 'HIGH').length,
                        medium: deviceLogs.filter(log => determineSeverity(log) === 'MEDIUM').length,
                        low: deviceLogs.filter(log => determineSeverity(log) === 'LOW').length
                    }
                };
            }
        });

        // Sort logs by timestamp, most recent first
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply time range filter if specified
        const { timeRange } = req.query;
        let filteredLogs = logs;
        
        if (timeRange) {
            const now = new Date();
            const timeLimit = new Date(now);
            
            switch(timeRange) {
                case '1h':
                    timeLimit.setHours(now.getHours() - 1);
                    break;
                case '24h':
                    timeLimit.setDate(now.getDate() - 1);
                    break;
                case '7d':
                    timeLimit.setDate(now.getDate() - 7);
                    break;
                case '30d':
                    timeLimit.setDate(now.getDate() - 30);
                    break;
            }
            
            filteredLogs = logs.filter(log => new Date(log.timestamp) >= timeLimit);
        }

        res.json({
            success: true,
            logs: filteredLogs,
            devices,
            summary: {
                totalDevices: Object.keys(devices).length,
                totalEvents: filteredLogs.length,
                lastUpdate: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("Error getting all traffic logs:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to get traffic logs" 
        });
    }
};

const getNetworkTraffic = async (req, res) => {
    try {
        const networkData = {
            devices: {},
            summary: {
                totalEvents: 0,
                activeDevices: 0,
                alerts: 0,
                timestamp: new Date().toISOString()
            }
        };

        const logs = await getTrafficLogsSummary();
        
        // Process each device's logs
        Object.entries(logs).forEach(([ip, deviceLogs]) => {
            if (Array.isArray(deviceLogs) && deviceLogs.length > 0) {
                networkData.devices[ip] = {
                    lastSeen: deviceLogs[deviceLogs.length - 1].timestamp,
                    eventCount: deviceLogs.length,
                    alerts: deviceLogs.filter(log => determineSeverity(log) === 'HIGH').length,
                    protocols: countProtocols(deviceLogs),
                    status: 'active'
                };
                
                networkData.summary.totalEvents += deviceLogs.length;
                networkData.summary.alerts += networkData.devices[ip].alerts;
            }
        });
        
        networkData.summary.activeDevices = Object.keys(networkData.devices).length;

        res.json(networkData);
    } catch (error) {
        console.error("Error getting network traffic:", error);
        res.status(500).json({ error: "Failed to get network traffic" });
    }
};

const getAllLogsWithoutFiltering = async (req, res) => {
    try {
        const { since } = req.query;
        const logs = fs.readFileSync(path.join(__dirname, '../data/trafficLogs.json'), 'utf8');
        const parsedLogs = JSON.parse(logs);
        
        // Flatten all logs from all IPs into a single array
        let allLogs = Object.entries(parsedLogs).reduce((acc, [deviceIp, deviceLogs]) => {
            // Add device IP to each log
            const logsWithDeviceIp = deviceLogs.map(log => ({
                ...log,
                deviceIp
            }));
            return [...acc, ...logsWithDeviceIp];
        }, []);
        
        // If 'since' parameter is provided, filter logs to only include those newer than the timestamp
        if (since) {
            const sinceDate = new Date(since);
            allLogs = allLogs.filter(log => new Date(log.timestamp) > sinceDate);
        }
        
        // Sort by timestamp, most recent first
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            logs: allLogs,
            totalEvents: allLogs.length,
            lastUpdate: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error getting all logs:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to get logs" 
        });
    }
};

module.exports = {
    getTrafficLogsForDevice,
    getAllTrafficLogs,
    addTrafficLogForDevice,
    getTrafficLogsSummaryHandler,
    getTrafficAlerts,
    getDeviceMetrics,
    getUserActivity,
    getNetworkTraffic,
    getAllLogsWithoutFiltering
};