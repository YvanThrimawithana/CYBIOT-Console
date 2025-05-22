require("dotenv").config(); // Ensure this is at the top to load env vars first
const express = require("express");
const cors = require("cors");
const connectDB = require('./config/database');
const { verifyDbSetup } = require('./utils/dbSetup');
const { fixEmailIndex } = require('./utils/fixEmailIndex');
const userRoutes = require("./routes/userRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const trafficLogRoutes = require("./routes/trafficRoutes");
const firmwareRoute = require("./routes/firmwareRoute");
const deviceFirmwareRoute = require("./routes/deviceFirmwareRoute");
const alertRoutes = require("./routes/alertRoutes"); // Import alert routes
const networkScanRoutes = require("./routes/networkScanRoutes"); // Add network scan routes
const { startTrafficMonitoring } = require("./utils/trafficMonitor"); // Import traffic monitoring
const fs = require('fs');
const path = require('path');
const userModel = require('./models/userModel');
const User = require('./models/mongoSchemas/userSchema');

// Initialize WebSocket Server
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Set up WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  
  ws.on('message', (message) => {
    console.log('Received WebSocket message:', message);
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Make WebSocket server available globally
global.wss = wss;
console.log('✅ WebSocket server initialized and made globally available');

// Initialize MQTT Handler and export it for other modules to use
const { getInstance } = require('./mqtt/mqttHandler');
const mqttHandler = getInstance();

// Log successful MQTT initialization
console.log('🚀 MQTT Handler initialized and connected to broker');

// Connect to MongoDB and verify setup
connectDB().then(async () => {
  console.log('MongoDB connected, verifying database setup...');
  
  // Fix email index issue before anything else - don't disconnect after
  await fixEmailIndex(false);
  
  // Verify database setup and create test user if needed
  await verifyDbSetup();
  
  // Check if MongoDB is properly connected
  try {
    // Count users in MongoDB
    const userCount = await User.countDocuments();
    console.log(`Found ${userCount} user(s) in MongoDB`);
    
    if (userCount > 0) {
      // List usernames to verify data
      const users = await User.find().select('username role -_id');
      console.log('Users in database:', users.map(u => `${u.username} (${u.role})`));
    }
  } catch (error) {
    console.error('Error checking users in MongoDB:', error);
  }
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Perform initial migration of users from JSON to MongoDB
const migrateUsersOnStartup = async () => {
  try {
    const usersJsonPath = path.join(__dirname, './data/users.json');
    
    // Check if the file exists
    if (fs.existsSync(usersJsonPath)) {
      console.log('Found users.json file, checking for migration needs...');
      const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
      
      // Only migrate if there are users in the JSON file
      if (usersData && usersData.length > 0) {
        console.log(`Starting migration of ${usersData.length} users from JSON to MongoDB...`);
        const result = await userModel.migrateUsersFromJson(usersData);
        
        if (result.success) {
          console.log('Successfully migrated users from JSON to MongoDB');
          
          // Optionally rename the original file as backup
          const backupPath = path.join(__dirname, './data/users.json.bak');
          fs.renameSync(usersJsonPath, backupPath);
          console.log('Renamed users.json to users.json.bak');
        } else {
          console.error('Failed to migrate users:', result.error);
        }
      } else {
        console.log('No users found in users.json, skipping migration');
      }
    } else {
      console.log('No users.json file found, skipping migration');
    }
  } catch (error) {
    console.error('Error during user migration:', error);
  }
};

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
app.use("/api/devices", deviceFirmwareRoute); // Register device firmware routes
app.use("/api/alerts", alertRoutes); // Register alert routes
app.use("/api/network-scan", networkScanRoutes); // Register network scan routes

// Check if SMTP credentials are configured
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  Warning: SMTP credentials not set in .env file. Email notifications will be disabled.');
} else {
    console.log('✅ SMTP email configuration detected successfully');
}

const PORT = process.env.PORT || 5000;

// Start traffic monitoring when the server starts (now async)
const startServer = async () => {
    try {
        await startTrafficMonitoring();
        
        const server = app.listen(PORT, () => {
            const serverIp = server.address().address;
            console.log(`Server running on http://${serverIp}:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
    }
};

// Run the migration when the server starts
migrateUsersOnStartup();

startServer();
