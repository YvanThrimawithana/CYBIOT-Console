require("dotenv").config(); // Ensure this is at the top to load env vars first
const express = require("express");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const trafficLogRoutes = require("./routes/trafficRoutes");
const firmwareRoute = require("./routes/firmwareRoute");
const alertRoutes = require("./routes/alertRoutes"); // Import alert routes
const { startTrafficMonitoring } = require("./utils/trafficMonitor"); // Import traffic monitoring

const app = express();
app.use(cors({
    origin: 'http://localhost:3000', // Your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'], // Add Authorization
    exposedHeaders: ['Content-Disposition']
}));

// Add preflight handling
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/users", userRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/traffic", trafficLogRoutes);
app.use("/api/firmware", firmwareRoute);
app.use("/api/alerts", alertRoutes); // Register alert routes

// Check if SMTP credentials are configured
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  Warning: SMTP credentials not set in .env file. Email notifications will be disabled.');
} else {
    console.log('✅ SMTP email configuration detected successfully');
}

const PORT = process.env.PORT || 5000;

// Start traffic monitoring when the server starts
startTrafficMonitoring();

const server = app.listen(PORT, () => {
    const serverIp = server.address().address;
    console.log(`Server running on http://${serverIp}:${PORT}`);
});
