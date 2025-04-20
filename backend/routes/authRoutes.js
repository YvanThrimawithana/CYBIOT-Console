const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Authentication routes
router.post('/login', authController.authenticate);

// Migration route (protected, admin only)
router.post('/migrate-users', auth, async (req, res, next) => {
  // Check if user is admin (additional security layer)
  if (req.user && req.user.role === 'admin') {
    return authController.migrateUsers(req, res);
  }
  res.status(403).json({ success: false, error: 'Admin access required' });
});

// Additional auth routes can be added here

module.exports = router;