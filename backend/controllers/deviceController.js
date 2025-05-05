const { getAllDevices, saveDevice, updateDeviceStatus, deleteDeviceFromStorage } = require("../models/deviceModel");

// Track heartbeat timestamp by IP address
const lastHeartbeats = {}; 

// Set interval to check for offline devices every 30 seconds
const CHECK_INTERVAL = 30000; // 30 seconds
const TIMEOUT_LIMIT  = 60000; // 1 minute timeout

// Import mqtt client only if not using MQTTHandler
let mqttClient = null;

// Use the global mqttHandler if available, otherwise set up direct MQTT connection
if (!global.mqttHandler) {
    console.log("⚠️ No global MQTT Handler found, setting up direct MQTT connection");
    const mqtt = require("mqtt");
    mqttClient = mqtt.connect("mqtt://192.168.1.7:1883");
    const mqttTopic = "cybiot/device/heartbeat";
    
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
    
                // Always force status to "online" when heartbeat is received
                const normalizedStatus = "online";
                
                // Update heartbeat timestamp based on IP address
                lastHeartbeats[ip] = Date.now();
                console.log(`🟢 Heartbeat received for ${ip}: Setting status to ${normalizedStatus}`);
                
                // Explicitly update status to online on every heartbeat
                updateDeviceStatus(ip, normalizedStatus)
                    .then(result => {
                        if (!result.success) {
                            console.log(`❌ Failed to update status for ${ip}: ${result.error}`);
                        } else {
                            console.log(`✅ Status updated for ${ip} to ${normalizedStatus}`);
                        }
                    })
                    .catch(error => {
                        console.error(`Error updating device status: ${error.message}`);
                    });
            } catch (error) {
                console.error("❌ Error parsing MQTT message:", error);
            }
        }
    });
} else {
    console.log("✅ Using global MQTT Handler for device status updates");
    
    // Copy heartbeats from MQTTHandler if available
    if (global.mqttHandler.lastHeartbeats) {
        console.log("📋 Syncing heartbeat data from global MQTT Handler");
        global.mqttHandler.lastHeartbeats.forEach((timestamp, ip) => {
            lastHeartbeats[ip] = timestamp;
        });
    }
}

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
        const deviceIp = device.ipAddress || device.ip;
        
        if (!deviceIp) {
            console.log(`⚠️ Device ${device.name} has no IP address`);
            return;
        }
        
        // Also check global MQTT handler's heartbeats if available
        let lastHeartbeat = lastHeartbeats[deviceIp];
        
        if (!lastHeartbeat && global.mqttHandler && global.mqttHandler.lastHeartbeats) {
            lastHeartbeat = global.mqttHandler.lastHeartbeats.get(deviceIp);
            
            if (lastHeartbeat) {
                // Sync it back to our local tracker
                console.log(`📡 Found heartbeat for ${deviceIp} in global MQTT handler`);
                lastHeartbeats[deviceIp] = lastHeartbeat;
            }
        }

        if (!lastHeartbeat) {
            console.log(`⚠️ No heartbeat received for ${device.name} (${deviceIp}) yet.`);
            return;
        }

        if (currentTime - lastHeartbeat > TIMEOUT_LIMIT) {
            console.log(`🚨 Device ${device.name} (${deviceIp}) is now Offline!`);
            updateDeviceStatus(deviceIp, "offline");
            delete lastHeartbeats[deviceIp]; // Remove from tracking
            
            // Also remove from global MQTT handler if available
            if (global.mqttHandler && global.mqttHandler.lastHeartbeats) {
                global.mqttHandler.lastHeartbeats.delete(deviceIp);
            }
        }
    });
}, CHECK_INTERVAL);

const addDevice = async (req, res) => {
    const { name, ipAddress, ip } = req.body;
    const deviceIp = ipAddress || ip; // Accept either ipAddress or ip
    
    if (!name || !deviceIp) {
        return res.status(400).json({ error: "Name and IP address are required" });
    }

    const result = await saveDevice({ 
        name, 
        ipAddress: deviceIp, // Always store as ipAddress in the database
        status: "offline" // Default to offline until first heartbeat
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
    const { id, ipAddress } = req.body;
    
    if (!id) {
        console.error("Delete device error: No ID provided in request");
        return res.status(400).json({ error: "Device ID is required" });
    }
    
    console.log(`Attempting to delete device with ID: ${id}, type: ${ipAddress ? 'with IP' : 'unknown'}`);
    
    try {
        let result;
        
        // First try to delete by MongoDB _id directly since that's what we're receiving now
        console.log("Attempting to delete using MongoDB _id directly");
        result = await deleteDeviceFromStorage({ _id: id });
        
        // If that didn't work, try deviceId as fallback
        if (!result.success) {
            console.log("Attempting to delete using deviceId");
            result = await deleteDeviceFromStorage({ deviceId: id });
        }
        
        if (result.success) {
            console.log(`Successfully deleted device with ID: ${id}`);
            
            // Remove this IP address from the heartbeats tracking
            if (ipAddress) {
                console.log(`Removing IP ${ipAddress} from heartbeat tracking`);
                if (lastHeartbeats[ipAddress]) {
                    delete lastHeartbeats[ipAddress];
                }
                
                // Signal to stop monitoring this IP (will be implemented in trafficMonitor.js)
                try {
                    const { stopMonitoringDevice } = require("../utils/trafficMonitor");
                    if (typeof stopMonitoringDevice === 'function') {
                        stopMonitoringDevice(ipAddress);
                        console.log(`Stopped traffic monitoring for IP: ${ipAddress}`);
                    }
                } catch (error) {
                    console.error(`Error stopping traffic monitoring: ${error.message}`);
                }
            }
            
            res.json({ message: "Device deleted successfully!" });
        } else {
            console.error(`Failed to delete device with ID: ${id}`, result.error);
            res.status(404).json({ error: result.error || "Device not found" });
        }
    } catch (error) {
        console.error(`Error while deleting device: ${error.message}`);
        res.status(500).json({ error: `Failed to delete device: ${error.message}` });
    }
};

module.exports = { addDevice, getDevices, removeDevice };
