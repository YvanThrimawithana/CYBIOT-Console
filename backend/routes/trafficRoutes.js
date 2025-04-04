const express = require("express");
const { getTrafficLogsForDevice } = require("../controllers/trafficController");

const router = express.Router();

// Route to get traffic logs for a specific device
router.get("/logs/:ip", getTrafficLogsForDevice);

module.exports = router;
