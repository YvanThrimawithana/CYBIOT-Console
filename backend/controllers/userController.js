const { getUser, createUser } = require("../models/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const tokenBlacklist = new Set();

const loginUser = async (req, res) => {
    const { username, password } = req.body;
    const user = await getUser(username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
};

const registerUser = async (req, res) => {
    const { username, password } = req.body;
    const existingUser = await getUser(username);

    if (existingUser) {
        return res.status(400).json({ error: "Username already taken" });
    }

    const newUser = await createUser(username, password);
    res.status(201).json({ message: "User registered successfully", username: newUser.username });
};

const logoutUser = (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
        tokenBlacklist.add(token);
    }
    res.json({ message: "Logged out successfully" });
};

const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token || tokenBlacklist.has(token)) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Token invalid" });
        req.user = user;
        next();
    });
};

module.exports = { loginUser, registerUser, logoutUser, authenticateToken };
