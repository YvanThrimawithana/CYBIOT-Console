const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { sendAlertNotification, sendFollowupNotification } = require("../utils/emailService");
const json2csv = require("json2csv").Parser;
const nodemailer = require("nodemailer");

// Define the paths
const dataDir = path.join(__dirname, "../data");
const alertsPath = path.join(dataDir, "alerts.json");

// Track notification milestones for alerts
const alertNotificationMilestones = new Map();
const NOTIFICATION_THRESHOLDS = [10, 25, 50, 100]; // Notification thresholds

// Ensure the data directory exists
const ensureDataDirectory = () => {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
};

// Initialize the alerts file if it doesn't exist
const initializeAlertsFile = () => {
    if (!fs.existsSync(alertsPath)) {
        fs.writeFileSync(alertsPath, JSON.stringify([], null, 2), "utf8");
    }
};

// Read alerts safely with error handling
const readAlerts = () => {
    try {
        ensureDataDirectory();
        initializeAlertsFile();
        const data = fs.readFileSync(alertsPath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading alerts:", error);
        return [];
    }
};

// Write alerts safely with error handling
const writeAlerts = (alerts) => {
    try {
        ensureDataDirectory();
        fs.writeFileSync(alertsPath, JSON.stringify(alerts, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("Error writing alerts:", error);
        return false;
    }
};

// Check if we need to send a follow-up notification for an alert
const checkFollowupNotification = (alert) => {
    // Only send follow-ups for HIGH severity alerts
    if (alert.severity !== "HIGH") return;

    // Get the current count
    const currentCount = alert.matchCount;
    
    // Initialize tracker for this alert if it doesn't exist
    if (!alertNotificationMilestones.has(alert.id)) {
        alertNotificationMilestones.set(alert.id, new Set());
    }
    
    const notifiedThresholds = alertNotificationMilestones.get(alert.id);
    
    // Check if we've reached any notification threshold
    for (const threshold of NOTIFICATION_THRESHOLDS) {
        if (currentCount >= threshold && !notifiedThresholds.has(threshold)) {
            // Mark this threshold as notified
            notifiedThresholds.add(threshold);
            
            // Send follow-up notification
            sendFollowupNotification(alert, threshold).catch(error => {
                console.error(`Failed to send follow-up notification for alert ${alert.id} at threshold ${threshold}:`, error);
            });
            
            // Only send one notification at a time
            break;
        }
    }
};

// Get all alerts with optional filtering
const getAlerts = (filters = {}) => {
    try {
        let alerts = readAlerts();

        // Apply filters
        if (filters.status) {
            alerts = alerts.filter(alert => alert.status === filters.status);
        }
        
        if (filters.severity) {
            alerts = alerts.filter(alert => alert.severity === filters.severity);
        }
        
        if (filters.deviceIp) {
            alerts = alerts.filter(alert => alert.deviceIp === filters.deviceIp);
        }
        
        if (filters.since) {
            const sinceDate = new Date(filters.since);
            alerts = alerts.filter(alert => new Date(alert.timestamp) > sinceDate);
        }
        
        return {
            success: true,
            alerts
        };
    } catch (error) {
        console.error("Error getting alerts:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Get alert by ID
const getAlertById = (id) => {
    try {
        const alerts = readAlerts();
        const alert = alerts.find(alert => alert.id === id);
        
        if (alert) {
            return {
                success: true,
                alert
            };
        } else {
            return {
                success: false,
                error: "Alert not found"
            };
        }
    } catch (error) {
        console.error(`Error getting alert ${id}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Create a new alert
const createAlert = (alertData) => {
    try {
        const alerts = readAlerts();
        
        // Check for de-duplication (prevent duplicate alerts)
        // Within a short time window for the same rule and device
        const timeWindow = 3600 * 1000; // 1 hour in milliseconds
        const now = new Date();
        
        const duplicateAlert = alerts.find(alert => 
            alert.ruleId === alertData.ruleId &&
            alert.deviceIp === alertData.deviceIp &&
            alert.status !== "RESOLVED" &&
            now - new Date(alert.timestamp) <= timeWindow
        );
        
        if (duplicateAlert) {
            // Update match count and add new matchedLogs
            duplicateAlert.matchCount = (duplicateAlert.matchCount || 1) + 1;
            duplicateAlert.lastUpdated = now.toISOString();
            
            // Add the new matched logs to the existing ones
            if (alertData.matchedLogs && alertData.matchedLogs.length > 0) {
                if (!duplicateAlert.matchedLogs) {
                    duplicateAlert.matchedLogs = [];
                }
                
                // Add new logs to the existing ones, up to a reasonable limit to prevent huge objects
                const MAX_LOGS = 50; // Maximum number of logs to store
                duplicateAlert.matchedLogs = [
                    ...alertData.matchedLogs,
                    ...duplicateAlert.matchedLogs
                ].slice(0, MAX_LOGS);
            }
            
            // Check if we need to send a follow-up notification
            checkFollowupNotification(duplicateAlert);
            
            // Save the updated alerts
            writeAlerts(alerts);
            
            return {
                success: true,
                deduplicated: true,
                alert: duplicateAlert
            };
        }
        
        // Create new alert
        const newAlert = {
            id: uuidv4(),
            ...alertData,
            status: "NEW",
            matchCount: 1,
            timestamp: now.toISOString(),
            lastUpdated: now.toISOString()
        };
        
        alerts.push(newAlert);
        writeAlerts(alerts);

        // Send email notification for HIGH severity alerts
        if (newAlert.severity === "HIGH") {
            sendAlertNotification(newAlert).catch(error => {
                console.error("Failed to send alert notification email:", error);
            });
        }
        
        return {
            success: true,
            alert: newAlert
        };
    } catch (error) {
        console.error("Error creating alert:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Update alert status
const updateAlertStatus = (id, status) => {
    try {
        if (!["NEW", "ACKNOWLEDGED", "RESOLVED"].includes(status)) {
            return {
                success: false,
                error: "Invalid status"
            };
        }
        
        const alerts = readAlerts();
        const alertIndex = alerts.findIndex(alert => alert.id === id);
        
        if (alertIndex === -1) {
            return {
                success: false,
                error: "Alert not found"
            };
        }
        
        // Update status and lastUpdated timestamp
        alerts[alertIndex].status = status;
        alerts[alertIndex].lastUpdated = new Date().toISOString();
        
        // If resolved, clean up the notification milestone tracking
        if (status === "RESOLVED" && alertNotificationMilestones.has(id)) {
            alertNotificationMilestones.delete(id);
        }
        
        writeAlerts(alerts);
        
        return {
            success: true,
            alert: alerts[alertIndex]
        };
    } catch (error) {
        console.error(`Error updating alert ${id} status:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Get alert statistics
const getAlertStats = () => {
    try {
        const alerts = readAlerts();
        
        const stats = {
            total: alerts.length,
            byStatus: {
                NEW: alerts.filter(alert => alert.status === "NEW").length,
                ACKNOWLEDGED: alerts.filter(alert => alert.status === "ACKNOWLEDGED").length,
                RESOLVED: alerts.filter(alert => alert.status === "RESOLVED").length
            },
            bySeverity: {
                HIGH: alerts.filter(alert => alert.severity === "HIGH").length,
                MEDIUM: alerts.filter(alert => alert.severity === "MEDIUM").length,
                LOW: alerts.filter(alert => alert.severity === "LOW").length
            }
        };
        
        return {
            success: true,
            stats
        };
    } catch (error) {
        console.error("Error getting alert stats:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Get alerts grouped by device
const getAlertsByDevice = () => {
    try {
        const alerts = readAlerts();
        const deviceAlerts = {};
        
        alerts.forEach(alert => {
            if (!deviceAlerts[alert.deviceIp]) {
                deviceAlerts[alert.deviceIp] = {
                    total: 0,
                    active: 0, // NEW or ACKNOWLEDGED
                    resolved: 0,
                    bySeverity: {
                        HIGH: 0,
                        MEDIUM: 0,
                        LOW: 0
                    }
                };
            }
            
            deviceAlerts[alert.deviceIp].total++;
            
            if (alert.status === "RESOLVED") {
                deviceAlerts[alert.deviceIp].resolved++;
            } else {
                deviceAlerts[alert.deviceIp].active++;
            }
            
            // Count by severity if severity is valid
            const severity = alert.severity || "MEDIUM";
            if (["HIGH", "MEDIUM", "LOW"].includes(severity)) {
                deviceAlerts[alert.deviceIp].bySeverity[severity]++;
            }
        });
        
        return {
            success: true,
            deviceAlerts
        };
    } catch (error) {
        console.error("Error getting alerts by device:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Generate and email a CSV report of all offense alerts
const generateCSVReport = async (email) => {
    try {
        if (!email) {
            return {
                success: false,
                error: "Email address is required"
            };
        }

        const alerts = readAlerts();
        
        if (!alerts || alerts.length === 0) {
            return {
                success: false,
                error: "No alerts found to generate report"
            };
        }

        // Create fields for CSV
        const fields = [
            'id',
            'ruleName', 
            'severity',
            'deviceIp',
            'status',
            'timestamp',
            'lastUpdated',
            'matchCount',
            'description'
        ];

        // Parse JSON to CSV
        const json2csvParser = new json2csv({ fields });
        const csv = json2csvParser.parse(alerts);

        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Create a temp file for the CSV
        const tempFilePath = path.join(tempDir, `offense-report-${Date.now()}.csv`);
        fs.writeFileSync(tempFilePath, csv);

        // Configure nodemailer
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Set up email data
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Offense Report - CybIOT Security Dashboard',
            html: `
                <h2>CybIOT Security Offense Report</h2>
                <p>Please find attached a comprehensive report of all security offenses.</p>
                <p>Report generated on: ${new Date().toLocaleString()}</p>
                <p>Summary:</p>
                <ul>
                    <li>Total offenses: ${alerts.length}</li>
                    <li>NEW: ${alerts.filter(a => a.status === 'NEW').length}</li>
                    <li>ACKNOWLEDGED: ${alerts.filter(a => a.status === 'ACKNOWLEDGED').length}</li>
                    <li>RESOLVED: ${alerts.filter(a => a.status === 'RESOLVED').length}</li>
                </ul>
                <p>This is an automated message from the CybIOT Security System.</p>
            `,
            attachments: [
                {
                    filename: 'offense-report.csv',
                    path: tempFilePath
                }
            ]
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        // Delete the temp file
        fs.unlinkSync(tempFilePath);

        return {
            success: true,
            message: `Report successfully sent to ${email}`
        };
    } catch (error) {
        console.error("Error generating CSV report:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    getAlerts,
    getAlertById,
    createAlert,
    updateAlertStatus,
    getAlertStats,
    getAlertsByDevice,
    generateCSVReport
};