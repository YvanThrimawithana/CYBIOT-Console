const express = require('express');
const router = express.Router();
const { verifyDeviceAccess } = require('../middleware/authMiddleware');

// ...existing code...

// Modify the device URL access route
router.get('/device/:deviceId/url', verifyDeviceAccess, async (req, res) => {
    try {
        const device = req.device; // Already verified by middleware
        
        // Check if device URL exists
        if (!device.url) {
            return res.status(404).redirect('/dashboard');
        }

        return res.status(200).json({ url: device.url });
    } catch (error) {
        console.error('Error accessing device URL:', error);
        return res.status(500).redirect('/dashboard');
    }
});

// ...existing code...

module.exports = router;
