const Alert = require('./mongoSchemas/alertSchema');
const { sendAlertNotification, sendFollowupNotification } = require("../utils/emailService");
const json2csv = require("json2csv").Parser;
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Track notification milestones for alerts
const alertNotificationMilestones = new Map();
const NOTIFICATION_THRESHOLDS = [10, 25, 50, 100]; // Notification thresholds

// Ensure temp directory exists
const ensureTempDirectory = () => {
  const tempDir = path.join(__dirname, "../temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
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
const getAlerts = async (filters = {}) => {
  try {
    let query = {};

    // Apply filters
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.severity) {
      query.severity = filters.severity;
    }
    
    if (filters.deviceIp) {
      query.deviceIp = filters.deviceIp;
    }
    
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      query.createdAt = { $gt: sinceDate };
    }
    
    const alerts = await Alert.find(query).sort({ createdAt: -1 });
    
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
const getAlertById = async (id) => {
  try {
    const alert = await Alert.findById(id);
    
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
const createAlert = async (alertData) => {
  try {
    // Check for de-duplication (prevent duplicate alerts)
    // Within a short time window for the same rule and device
    const timeWindow = 3600 * 1000; // 1 hour in milliseconds
    const now = new Date();
    
    const duplicateAlert = await Alert.findOne({
      ruleId: alertData.ruleId,
      deviceIp: alertData.deviceIp,
      status: { $ne: "RESOLVED" },
      createdAt: { $gt: new Date(now - timeWindow) }
    });
    
    if (duplicateAlert) {
      // Update match count and add new matchedLogs
      duplicateAlert.matchCount = (duplicateAlert.matchCount || 1) + 1;
      duplicateAlert.updatedAt = now;
      
      // Add new logs to the existing ones, up to a reasonable limit to prevent huge objects
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
      await duplicateAlert.save();
      checkFollowupNotification(duplicateAlert);
      
      return {
        success: true,
        deduplicated: true,
        alert: duplicateAlert
      };
    }
    
    // Create new alert
    const newAlert = new Alert({
      ...alertData,
      status: "NEW",
      matchCount: 1
    });
    
    await newAlert.save();

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
const updateAlertStatus = async (id, status) => {
  try {
    if (!["NEW", "ACKNOWLEDGED", "RESOLVED"].includes(status)) {
      return {
        success: false,
        error: "Invalid status"
      };
    }
    
    const alert = await Alert.findById(id);
    
    if (!alert) {
      return {
        success: false,
        error: "Alert not found"
      };
    }
    
    // Update status
    alert.status = status;
    
    // If resolved, clean up the notification milestone tracking
    if (status === "RESOLVED" && alertNotificationMilestones.has(id)) {
      alertNotificationMilestones.delete(id);
    }
    
    await alert.save();
    
    return {
      success: true,
      alert
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
const getAlertStats = async () => {
  try {
    const [
      total,
      newCount,
      acknowledgedCount,
      resolvedCount,
      highCount,
      mediumCount,
      lowCount
    ] = await Promise.all([
      Alert.countDocuments({}),
      Alert.countDocuments({ status: "NEW" }),
      Alert.countDocuments({ status: "ACKNOWLEDGED" }),
      Alert.countDocuments({ status: "RESOLVED" }),
      Alert.countDocuments({ severity: "HIGH" }),
      Alert.countDocuments({ severity: "MEDIUM" }),
      Alert.countDocuments({ severity: "LOW" })
    ]);
    
    const stats = {
      total,
      byStatus: {
        NEW: newCount,
        ACKNOWLEDGED: acknowledgedCount,
        RESOLVED: resolvedCount
      },
      bySeverity: {
        HIGH: highCount,
        MEDIUM: mediumCount,
        LOW: lowCount
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
const getAlertsByDevice = async () => {
  try {
    const deviceAlerts = {};
    
    // Get unique device IPs
    const devices = await Alert.aggregate([
      { $group: { _id: "$deviceIp" } }
    ]);
    
    // For each device, get alert counts
    for (const device of devices) {
      const deviceIp = device._id;
      
      const [
        total,
        active,
        resolved,
        highCount,
        mediumCount,
        lowCount
      ] = await Promise.all([
        Alert.countDocuments({ deviceIp }),
        Alert.countDocuments({ deviceIp, status: { $in: ["NEW", "ACKNOWLEDGED"] } }),
        Alert.countDocuments({ deviceIp, status: "RESOLVED" }),
        Alert.countDocuments({ deviceIp, severity: "HIGH" }),
        Alert.countDocuments({ deviceIp, severity: "MEDIUM" }),
        Alert.countDocuments({ deviceIp, severity: "LOW" })
      ]);
      
      deviceAlerts[deviceIp] = {
        total,
        active,
        resolved,
        bySeverity: {
          HIGH: highCount,
          MEDIUM: mediumCount,
          LOW: lowCount
        }
      };
    }
    
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

    const alerts = await Alert.find({}).lean();
    
    if (!alerts || alerts.length === 0) {
      return {
        success: false,
        error: "No alerts found to generate report"
      };
    }

    // Create fields for CSV
    const fields = [
      '_id',
      'ruleName', 
      'severity',
      'deviceIp',
      'status',
      'createdAt',
      'updatedAt',
      'matchCount',
      'description'
    ];

    // Parse JSON to CSV
    const json2csvParser = new json2csv({ fields });
    const csv = json2csvParser.parse(alerts);

    // Create temp file for the CSV
    const tempDir = ensureTempDirectory();
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