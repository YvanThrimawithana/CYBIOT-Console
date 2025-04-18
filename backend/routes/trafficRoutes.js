const express = require("express");
const { 
    getTrafficLogsForDevice,
    getAllTrafficLogs,
    getTrafficLogsSummaryHandler,
    getTrafficAlerts,
    getDeviceMetrics,
    getUserActivity,
    getNetworkTraffic,
    getAllLogsWithoutFiltering,
    // New handler functions for alert rules
    getAllAlertRules,
    getAlertRuleById,
    createAlertRule,
    updateAlertRule,
    deleteAlertRule,
    // New handler functions for alerts
    getActiveAlerts,
    getAllSystemAlerts,
    updateAlertStatusHandler,
    evaluateExistingLogs
} = require("../controllers/trafficController");

const router = express.Router();

// Existing routes
router.get("/all-logs", getAllLogsWithoutFiltering);
router.get("/logs", getAllTrafficLogs);
router.get("/logs/:ip", getTrafficLogsForDevice);
router.get("/network", getNetworkTraffic);
router.get("/summary", getTrafficLogsSummaryHandler);
router.get("/alerts/:ip", getTrafficAlerts);
router.get("/metrics/:ip", getDeviceMetrics);
router.get("/users/:ip", getUserActivity);

// New routes for alert rules management
router.get("/rules", getAllAlertRules);
router.get("/rules/:id", getAlertRuleById);
router.post("/rules", createAlertRule);
router.put("/rules/:id", updateAlertRule);
router.delete("/rules/:id", deleteAlertRule);

// New routes for alerts management
router.get("/system-alerts", getAllSystemAlerts);
router.get("/active-alerts/:ip?", getActiveAlerts);
router.put("/alert-status/:id", updateAlertStatusHandler);
router.post("/evaluate-logs", evaluateExistingLogs);

module.exports = router;
