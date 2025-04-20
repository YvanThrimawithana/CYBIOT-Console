const { addLog, getDeviceLogs, getAllLogs, getTrafficSummary, searchLogs } = require("../models/trafficModel");
const { getAllRules, getRuleById, createRule, updateRule, deleteRule } = require("../models/alertRulesModel");
const { getAlerts, updateAlertStatus, getAlertStats, generateCSVReport } = require("../models/alertsModel");
const { processLog, processExistingLogs } = require("../utils/alertEngine");
const { getAllDevices } = require("../models/deviceModel");

// Get traffic logs for a specific device
const getTrafficLogsForDevice = async (req, res) => {
    try {
        const { ip } = req.params;
        const { since } = req.query;
        
        // Use the MongoDB model to get logs
        const result = await getDeviceLogs(ip, since);
        
        if (!result.success) {
            return res.status(500).json({ 
                success: false, 
                error: result.error || "Failed to get traffic logs" 
            });
        }
        
        // Get device information if available
        const devicesResult = await getAllDevices();
        let deviceInfo = {};
        
        if (devicesResult.success && devicesResult.devices.length > 0) {
            deviceInfo = devicesResult.devices.find(d => d.ipAddress === ip) || {};
        }
        
        res.json({ 
            success: true, 
            ip, 
            logs: result.logs,
            deviceInfo
        });
    } catch (error) {
        console.error("Error getting traffic logs:", error);
        res.status(500).json({ success: false, error: "Failed to get traffic logs" });
    }
};

// Add a new traffic log for a device
const addTrafficLogForDevice = async (deviceIp, logData) => {
    try {
        // Save the log first using the MongoDB model
        const result = await addLog(deviceIp, logData);
        
        if (result.success) {
            // Process the log against alert rules
            const triggeredAlerts = await processLog(result.log);
            
            if (triggeredAlerts && triggeredAlerts.length > 0) {
                console.log(`🚨 Generated ${triggeredAlerts.length} alerts for device ${deviceIp}`);
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("Error adding traffic log:", error);
        return false;
    }
};

// Get a summary of traffic logs
const getTrafficLogsSummaryHandler = async (req, res) => {
    try {
        // Use the traffic summary function from the MongoDB model
        const deviceLogs = await getTrafficSummary();
        
        res.json({ 
            success: true, 
            summary: deviceLogs 
        });
    } catch (error) {
        console.error("Error getting traffic summary:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to get traffic summary" 
        });
    }
};

// Get all logs without filtering (pagination may be needed for large datasets)
const getAllLogsWithoutFiltering = async (req, res) => {
    try {
        const { since, limit } = req.query;
        
        // Get logs from MongoDB using the updated model
        const result = await getAllLogs(since, limit ? parseInt(limit) : 1000);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || "Failed to get logs"
            });
        }
        
        // Sort by timestamp, most recent first (should already be sorted by the model)
        res.json({
            success: true,
            logs: result.logs,
            totalEvents: result.logs.length,
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

// Get active alerts
const getActiveAlerts = async (req, res) => {
    try {
        const { ip } = req.params;
        
        // Create filter with deviceIp if provided
        const filters = {};
        if (ip && ip !== 'all') {
            filters.deviceIp = ip;
        }
        
        // Only get non-resolved alerts
        filters.status = { $ne: "RESOLVED" };
        
        // Get alerts from MongoDB
        const result = await getAlerts(filters);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || "Failed to get active alerts"
            });
        }
        
        return res.status(200).json({
            success: true,
            alerts: result.alerts
        });
    } catch (error) {
        console.error('Error getting active alerts:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get active alerts'
        });
    }
};

// Get all system alerts
const getAllSystemAlerts = async (req, res) => {
    try {
        const filters = {};
        const { status, since } = req.query;
        
        if (status) {
            filters.status = status;
        }
        
        if (since) {
            filters.since = since;
        }
        
        // Get alerts from MongoDB
        const result = await getAlerts(filters);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || "Failed to get system alerts"
            });
        }
        
        // Get alert statistics
        const statsResult = await getAlertStats();
        
        return res.status(200).json({
            success: true,
            alerts: result.alerts,
            alertsByStatus: statsResult.success ? statsResult.stats.byStatus : {
                NEW: 0,
                ACKNOWLEDGED: 0,
                RESOLVED: 0
            }
        });
    } catch (error) {
        console.error('Error getting all system alerts:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get system alerts'
        });
    }
};

// Update alert status
const updateAlertStatusHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status || !['NEW', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid status. Must be one of: NEW, ACKNOWLEDGED, RESOLVED" 
            });
        }
        
        const result = await updateAlertStatus(id, status);
        
        if (result.success) {
            res.json({ success: true, alert: result.alert });
        } else {
            res.status(404).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error("Error updating alert status:", error);
        res.status(500).json({ success: false, error: "Failed to update alert status" });
    }
};

// Generate CSV report for alerts
const generateCSVReportHandler = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: "Email address is required" 
            });
        }
        
        // Generate and send CSV report using the MongoDB model
        const result = await generateCSVReport(email);
        
        if (result.success) {
            return res.status(200).json({
                success: true,
                message: result.message || `Report successfully generated and sent to ${email}`
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error || "Failed to generate report"
            });
        }
    } catch (error) {
        console.error('Error generating CSV report:', error);
        return res.status(500).json({
            success: false,
            error: `Failed to generate report: ${error.message}`
        });
    }
};

// Get all traffic logs
const getAllTrafficLogs = async (req, res) => {
    try {
        const { timeRange } = req.query;
        
        // Calculate 'since' based on timeRange
        let since = null;
        if (timeRange) {
            const now = new Date();
            if (timeRange === '1h') {
                since = new Date(now - 60 * 60 * 1000);
            } else if (timeRange === '24h') {
                since = new Date(now - 24 * 60 * 60 * 1000);
            } else if (timeRange === '7d') {
                since = new Date(now - 7 * 24 * 60 * 60 * 1000);
            } else if (timeRange === '30d') {
                since = new Date(now - 30 * 24 * 60 * 60 * 1000);
            }
        }
        
        // Get logs from MongoDB
        const result = await getAllLogs(since ? since.toISOString() : null);
        
        if (!result.success) {
            return res.status(500).json({ 
                success: false, 
                error: result.error || "Failed to get traffic logs" 
            });
        }
        
        res.json({ 
            success: true, 
            logs: result.logs
        });
    } catch (error) {
        console.error("Error getting all traffic logs:", error);
        res.status(500).json({ success: false, error: "Failed to get traffic logs" });
    }
};

// Get network traffic data
const getNetworkTraffic = async (req, res) => {
    try {
        // Get traffic logs summary
        const deviceLogs = await getTrafficSummary();
        
        // Get all devices for correlation
        const devicesResult = await getAllDevices();
        
        if (!devicesResult.success) {
            return res.status(500).json({ 
                success: false, 
                error: "Failed to get device information" 
            });
        }
        
        // Calculate network traffic metrics
        const metrics = {
            totalTraffic: 0,
            deviceBreakdown: {},
            trafficOverTime: []
        };
        
        // Process device logs to build metrics
        Object.keys(deviceLogs).forEach(deviceIp => {
            const logs = deviceLogs[deviceIp];
            metrics.totalTraffic += logs.length;
            
            const device = devicesResult.devices.find(d => d.ipAddress === deviceIp);
            const deviceName = device ? device.name : deviceIp;
            
            metrics.deviceBreakdown[deviceName] = logs.length;
        });
        
        res.json({ 
            success: true, 
            metrics
        });
    } catch (error) {
        console.error("Error getting network traffic:", error);
        res.status(500).json({ success: false, error: "Failed to get network traffic" });
    }
};

// Get traffic alerts for device
const getTrafficAlerts = async (req, res) => {
    try {
        const { ip } = req.params;
        
        // Get alerts filtered by device IP
        const filters = {};
        if (ip && ip !== 'all') {
            filters.deviceIp = ip;
        }
        
        const result = await getAlerts(filters);
        
        if (!result.success) {
            return res.status(500).json({ 
                success: false, 
                error: result.error || "Failed to get traffic alerts" 
            });
        }
        
        res.json({ success: true, alerts: result.alerts });
    } catch (error) {
        console.error("Error getting traffic alerts:", error);
        res.status(500).json({ success: false, error: "Failed to get traffic alerts" });
    }
};

// Get device metrics
const getDeviceMetrics = async (req, res) => {
    try {
        const { ip } = req.params;
        
        // Get device logs
        const result = await getDeviceLogs(ip);
        
        if (!result.success) {
            return res.status(500).json({ 
                success: false, 
                error: result.error || "Failed to get device metrics" 
            });
        }
        
        // Calculate metrics from logs
        const logs = result.logs;
        const metrics = {
            totalEvents: logs.length,
            protocolBreakdown: {},
            severityBreakdown: {},
            activityOverTime: []
        };
        
        // Process logs to build metrics
        logs.forEach(log => {
            // Protocol breakdown
            const protocol = log.source?.protocol || 'Unknown';
            metrics.protocolBreakdown[protocol] = (metrics.protocolBreakdown[protocol] || 0) + 1;
            
            // Severity breakdown
            const info = (log.source?.info || '').toLowerCase();
            let severity = 'LOW';
            if (info.includes('error') || info.includes('fail') || info.includes('denied')) {
                severity = 'HIGH';
            } else if (info.includes('warn') || info.includes('retry')) {
                severity = 'MEDIUM';
            }
            metrics.severityBreakdown[severity] = (metrics.severityBreakdown[severity] || 0) + 1;
        });
        
        res.json({ success: true, metrics });
    } catch (error) {
        console.error("Error getting device metrics:", error);
        res.status(500).json({ success: false, error: "Failed to get device metrics" });
    }
};

// Get user activity
const getUserActivity = async (req, res) => {
    try {
        const { ip } = req.params;
        
        // Get device logs
        const result = await getDeviceLogs(ip);
        
        if (!result.success) {
            return res.status(500).json({ 
                success: false, 
                error: result.error || "Failed to get user activity" 
            });
        }
        
        // Filter logs for user activity
        const userLogs = result.logs.filter(log => {
            const info = (log.source?.info || '').toLowerCase();
            return info.includes('user') || info.includes('login') || info.includes('auth');
        });
        
        res.json({ success: true, activity: userLogs });
    } catch (error) {
        console.error("Error getting user activity:", error);
        res.status(500).json({ success: false, error: "Failed to get user activity" });
    }
};

// Alert rule related functions
const getAllAlertRules = async (req, res) => {
    try {
        const result = await getAllRules();
        
        if (!result.success) {
            return res.status(500).json({
                success: false, 
                error: result.error || "Failed to get alert rules"
            });
        }
        
        res.json({ success: true, rules: result.rules });
    } catch (error) {
        console.error("Error getting alert rules:", error);
        res.status(500).json({ success: false, error: "Failed to get alert rules" });
    }
};

const getAlertRuleById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await getRuleById(id);
        
        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error || "Alert rule not found"
            });
        }
        
        res.json({ success: true, rule: result.rule });
    } catch (error) {
        console.error(`Error getting alert rule ${req.params.id}:`, error);
        res.status(500).json({ success: false, error: "Failed to get alert rule" });
    }
};

const createAlertRule = async (req, res) => {
    try {
        const result = await createRule(req.body);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error || "Failed to create alert rule"
            });
        }
        
        res.status(201).json({ success: true, rule: result.rule });
    } catch (error) {
        console.error("Error creating alert rule:", error);
        res.status(500).json({ success: false, error: "Failed to create alert rule" });
    }
};

const updateAlertRule = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await updateRule(id, req.body);
        
        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error || "Alert rule not found"
            });
        }
        
        res.json({ success: true, rule: result.rule });
    } catch (error) {
        console.error(`Error updating alert rule ${req.params.id}:`, error);
        res.status(500).json({ success: false, error: "Failed to update alert rule" });
    }
};

const deleteAlertRule = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deleteRule(id);
        
        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error || "Alert rule not found"
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting alert rule ${req.params.id}:`, error);
        res.status(500).json({ success: false, error: "Failed to delete alert rule" });
    }
};

const evaluateExistingLogs = async (req, res) => {
    try {
        // Get active rules
        const rulesResult = await getAllRules();
        
        if (!rulesResult.success) {
            return res.status(500).json({
                success: false,
                error: "Failed to get alert rules"
            });
        }
        
        const activeRules = rulesResult.rules.filter(rule => rule.enabled);
        let totalAlerts = 0;
        
        // Process each active rule against existing logs
        for (const rule of activeRules) {
            const alertsTriggered = await processExistingLogs(rule);
            totalAlerts += alertsTriggered.length;
        }
        
        res.json({
            success: true,
            message: `Evaluated existing logs against ${activeRules.length} rules`,
            alertsGenerated: totalAlerts
        });
    } catch (error) {
        console.error("Error evaluating existing logs:", error);
        res.status(500).json({ success: false, error: "Failed to evaluate logs" });
    }
};

// Only keeping necessary exports for this update
module.exports = {
    getTrafficLogsForDevice,
    addTrafficLogForDevice,
    getTrafficLogsSummaryHandler,
    getAllLogsWithoutFiltering,
    getActiveAlerts,
    getAllSystemAlerts,
    updateAlertStatusHandler,
    generateCSVReportHandler,
    getAllTrafficLogs,
    getNetworkTraffic,
    getTrafficAlerts,
    getDeviceMetrics,
    getUserActivity,
    getAllAlertRules,
    getAlertRuleById,
    createAlertRule,
    updateAlertRule,
    deleteAlertRule,
    evaluateExistingLogs
};