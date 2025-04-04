const jwt = require('jsonwebtoken');
const Device = require('../models/Device');

const verifyDeviceAccess = async (req, res, next) => {
    try {
        // Get token from session or header
        const token = req.session.token || req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).redirect('/dashboard');
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if device exists and user has access
        const device = await Device.findById(req.params.deviceId);
        if (!device) {
            return res.status(404).redirect('/dashboard');
        }

        // Verify user has permission to access this device
        if (device.userId.toString() !== decoded.userId) {
            return res.status(403).redirect('/dashboard');
        }

        req.device = device;
        next();
    } catch (error) {
        console.error('Device access verification error:', error);
        res.status(401).redirect('/dashboard');
    }
};

module.exports = { verifyDeviceAccess };
