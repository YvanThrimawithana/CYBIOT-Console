const { getAllDevices, saveDevice, updateDeviceStatus, deleteDeviceFromStorage } = require("../models/deviceModel");
const mqtt = require("mqtt");

const mqttClient = mqtt.connect("mqtt://192.168.1.10:1883");
const mqttTopic = "cybiot/device/heartbeat";

const lastHeartbeats = {}; // Track heartbeat timestamp by IP address

// Set interval to check for offline devices every 30 seconds
const CHECK_INTERVAL = 30000; // 30 seconds
const TIMEOUT_LIMIT  = 20000; // 1 minute timeout

// Periodic check for offline devices
setInterval(() => {
    console.log("🔍 Checking for offline devices...");

    const currentTime = Date.now();
    const devices = getAllDevices();

    devices.forEach(device => {
        const lastHeartbeat = lastHeartbeats[device.ip]; // Check based on IP address

        if (!lastHeartbeat) {
            console.log(`⚠️ No heartbeat received for ${device.name} yet.`);
            return;
        }

        if (currentTime - lastHeartbeat > TIMEOUT_LIMIT) {
            console.log(`🚨 Device ${device.name} (${device.ip}) is now Offline!`);
            updateDeviceStatus(device.ip, "Offline");
            delete lastHeartbeats[device.ip]; // Remove from tracking
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
            const { ip, status } = deviceData; // Use IP address and status

            if (!ip || !status) {
                console.log("⚠️ Invalid data received:", deviceData);
                return;
            }

            // Update heartbeat timestamp based on IP address
            lastHeartbeats[ip] = Date.now();
            console.log(`🟡 Heartbeat received for ${ip}: ${status}`);

            updateDeviceStatus(ip, status); // Update status to Active

        } catch (error) {
            console.error("❌ Error parsing MQTT message:", error);
        }
    }
});



const addDevice = async (req, res) => {
    const { name, ip } = req.body;
    if (!name || !ip) {
        return res.status(400).json({ error: "Name and IP address are required" });
    }

    const newDevice = saveDevice({ name, ip, status: "Unknown" });
    res.json({ message: "Device added successfully!", device: newDevice });
};

const getDevices = async (req, res) => {
    const devices = getAllDevices();
    res.json({ devices });
};

const removeDevice = (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ error: "Device ID is required" });
    }

    const devices = getAllDevices();
    const deviceExists = devices.some(device => device.id === id);

    if (!deviceExists) {
        return res.status(404).json({ error: "Device not found" });
    }

    deleteDeviceFromStorage(id);
    res.json({ message: "Device deleted successfully!" });
};

module.exports = { addDevice, getDevices, removeDevice };
