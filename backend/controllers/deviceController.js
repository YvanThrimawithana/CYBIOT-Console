const { getAllDevices, saveDevice, updateDeviceStatus, deleteDeviceFromStorage } = require("../models/deviceModel");
const mqtt = require("mqtt");

const mqttClient = mqtt.connect("mqtt://192.168.1.7:1883");
const mqttTopic = "cybiot/device/heartbeat";

const lastHeartbeats = {}; // Track heartbeat timestamp by IP address

// Set interval to check for offline devices every 30 seconds
const CHECK_INTERVAL = 30000; // 30 seconds
const TIMEOUT_LIMIT  = 20000; // 1 minute timeout

// Periodic check for offline devices
setInterval(async () => {
    console.log("🔍 Checking for offline devices...");

    const currentTime = Date.now();
    
    // Fixed: getAllDevices now returns {success, devices} structure
    const result = await getAllDevices();
    
    if (!result.success) {
        console.log("❌ Error getting devices:", result.error);
        return;
    }
    
    const devices = result.devices;
    
    if (!devices || !Array.isArray(devices)) {
        console.log("⚠️ No valid devices found or devices is not an array");
        return;
    }

    devices.forEach(device => {
        const lastHeartbeat = lastHeartbeats[device.ipAddress]; // Use ipAddress instead of ip

        if (!lastHeartbeat) {
            console.log(`⚠️ No heartbeat received for ${device.name} (${device.ipAddress}) yet.`);
            return;
        }

        if (currentTime - lastHeartbeat > TIMEOUT_LIMIT) {
            console.log(`🚨 Device ${device.name} (${device.ipAddress}) is now Offline!`);
            updateDeviceStatus(device.ipAddress, "Offline");
            delete lastHeartbeats[device.ipAddress]; // Remove from tracking
        }
    });
}, CHECK_INTERVAL);

// MQTT connection and message handling
mqttClient.on("connect", () => {
    console.log("✅ Connected to MQTT Broker!");
    mqttClient.subscribe(mqttTopic, (err) => {
        if (err) {
            console.log("❌ Failed to subscribe:", err);
        } else {
            console.log(`📡 Subscribed to topic: ${mqttTopic}`);
        }
    });
});

mqttClient.on("message", (topic, message) => {
    if (topic === mqttTopic) {
        try {
            const deviceData = JSON.parse(message.toString());
            const { ip, status } = deviceData;

            if (!ip) {
                console.log("⚠️ Invalid data received (no IP):", deviceData);
                return;
            }

            // Normalize status value
            let normalizedStatus = status || "Online";
            
            // Convert any variations to standard format
            if (normalizedStatus.toLowerCase() === "online" || 
                normalizedStatus.toLowerCase() === "active") {
                normalizedStatus = "Online";
            } else if (normalizedStatus.toLowerCase() === "offline" || 
                       normalizedStatus.toLowerCase() === "inactive") {
                normalizedStatus = "Offline";
            }

            // Update heartbeat timestamp based on IP address
            lastHeartbeats[ip] = Date.now();
            console.log(`🟡 Heartbeat received for ${ip}: ${normalizedStatus}`);

            updateDeviceStatus(ip, normalizedStatus);

        } catch (error) {
            console.error("❌ Error parsing MQTT message:", error);
        }
    }
});

const addDevice = async (req, res) => {
    const { name, ipAddress, ip } = req.body;
    const deviceIp = ipAddress || ip; // Accept either ipAddress or ip
    
    if (!name || !deviceIp) {
        return res.status(400).json({ error: "Name and IP address are required" });
    }

    const result = await saveDevice({ 
        name, 
        ipAddress: deviceIp, // Always store as ipAddress in the database
        status: "Unknown" 
    });
    
    if (result.success) {
        res.json({ message: "Device added successfully!", device: result.device });
    } else {
        res.status(500).json({ error: result.error || "Failed to add device" });
    }
};

const getDevices = async (req, res) => {
    const result = await getAllDevices();
    if (result.success) {
        res.json({ devices: result.devices });
    } else {
        res.status(500).json({ error: result.error || "Failed to get devices" });
    }
};

const removeDevice = async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ error: "Device ID is required" });
    }
    
    const result = await deleteDeviceFromStorage(id);
    
    if (result.success) {
        res.json({ message: "Device deleted successfully!" });
    } else {
        res.status(404).json({ error: result.error || "Device not found" });
    }
};

module.exports = { addDevice, getDevices, removeDevice };
