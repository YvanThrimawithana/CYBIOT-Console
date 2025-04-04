const express = require("express");
const { loginUser, registerUser, logoutUser, authenticateToken } = require("../controllers/userController");

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", registerUser);
router.post("/logout", logoutUser);

// Protected Route Example
router.get("/profile", authenticateToken, (req, res) => {
    res.json({ message: "Welcome to your profile", user: req.user });
});

module.exports = router;
