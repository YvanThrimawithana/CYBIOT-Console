const express = require("express");
const { 
    getTrafficLogsForDevice,
    getAllTrafficLogs,
    getTrafficLogsSummaryHandler,
    getTrafficAlerts,
    getDeviceMetrics,
    getUserActivity,
    getNetworkTraffic,
    getAllLogsWithoutFiltering
} = require("../controllers/trafficController");

const router = express.Router();

router.get("/all-logs", getAllLogsWithoutFiltering);
router.get("/logs", getAllTrafficLogs);
router.get("/logs/:ip", getTrafficLogsForDevice);
router.get("/network", getNetworkTraffic);
router.get("/summary", getTrafficLogsSummaryHandler);
router.get("/alerts/:ip", getTrafficAlerts);
router.get("/metrics/:ip", getDeviceMetrics);
router.get("/users/:ip", getUserActivity);

module.exports = router;
