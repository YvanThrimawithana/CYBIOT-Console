const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { 
    getAvailableFirmwareForDevice,
    scheduleDeviceFirmwareUpdate,
    sendFirmwareUpdate
} = require('../controllers/deviceController');

// Get available firmware for a device
router.get('/devices/:deviceId/firmware', auth, getAvailableFirmwareForDevice);

// Schedule a firmware update for a device
router.post('/devices/:deviceId/firmware/schedule', auth, scheduleDeviceFirmwareUpdate);

// Send firmware update immediately to a device
router.post('/devices/:deviceId/firmware/update', auth, sendFirmwareUpdate);

module.exports = router;