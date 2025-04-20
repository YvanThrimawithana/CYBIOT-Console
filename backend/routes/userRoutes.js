const express = require("express");
const { 
    loginUser, 
    registerUser, 
    logoutUser, 
    authenticateToken,
    refreshToken 
} = require("../controllers/userController");

const router = express.Router();

// Public routes
router.post("/login", loginUser);
router.post("/register", registerUser);
router.post("/logout", logoutUser);
router.post("/refresh-token", refreshToken);

// Protected routes
router.get("/me", authenticateToken, (req, res) => {
    res.json({ 
        success: true, 
        user: {
            userId: req.user.userId,
            username: req.user.username,
            role: req.user.role
        }
    });
});

module.exports = router;
