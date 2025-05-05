const express = require('express');
const router = express.Router();
const {
    performNetworkScan,
    getScanResults,
    getLatestScanForIp
} = require('../controllers/networkScanController');

// Route to initiate a network scan
router.post('/scan', performNetworkScan);

// Route to get scan results with optional IP filter
router.get('/results', getScanResults);

// Route to get latest scan for specific IP
router.get('/latest/:ip', getLatestScanForIp);

module.exports = router;