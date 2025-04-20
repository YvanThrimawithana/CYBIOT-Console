const { registerUser: register, loginUser: login } = require("../models/userModel");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const tokenBlacklist = new Set();

const loginUser = async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }
    
    try {
        console.log(`Attempting login for user: ${username}`);
        const result = await login(username, password);

        if (!result.success) {
            console.log(`Login failed for ${username}: ${result.error}`);
            return res.status(401).json({ error: result.error || "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: result.user._id, username: result.user.username, role: result.user.role },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: "24h" }
        );
        
        // Generate refresh token
        const refreshToken = jwt.sign(
            { userId: result.user._id, username: result.user.username },
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || 'your_refresh_secret',
            { expiresIn: '7d' }
        );

        console.log(`User ${username} logged in successfully`);
        
        res.json({
            token,
            refreshToken,
            userId: result.user._id,
            username: result.user.username,
            role: result.user.role
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed: " + error.message });
    }
};

const registerUser = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        console.log(`Attempting to register user: ${username}`);
        const result = await register({ 
            username, 
            password
        });

        if (!result.success) {
            console.log(`Registration failed for ${username}: ${result.error}`);
            return res.status(400).json({ error: result.error || "Registration failed" });
        }

        console.log(`User ${username} registered successfully`);
        res.status(201).json({ 
            success: true,
            message: "User registered successfully", 
            username: result.user.username
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Registration failed: " + error.message });
    }
};

const logoutUser = (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
        tokenBlacklist.add(token);
    }
    res.json({ success: true, message: "Logged out successfully" });
};

const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token || tokenBlacklist.has(token)) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
        if (err) return res.status(401).json({ error: "Token invalid" });
        req.user = user;
        next();
    });
};

const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken, 
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || 'your_refresh_secret'
        );
        
        // Generate new access token
        const newAccessToken = jwt.sign(
            { userId: decoded.userId, username: decoded.username },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '24h' }
        );

        res.json({ success: true, token: newAccessToken });
    } catch (error) {
        console.error('Token refresh failed:', error);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

module.exports = { loginUser, registerUser, logoutUser, authenticateToken, refreshToken };
