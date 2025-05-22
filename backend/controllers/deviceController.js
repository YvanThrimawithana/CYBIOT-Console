const { getAllDevices, saveDevice, updateDeviceStatus, deleteDeviceFromStorage, getDeviceById } = require("../models/deviceModel");
const FirmwareModel = require("../models/firmwareModel");
const UnregisteredDeviceModel = require("../models/unregisteredDeviceModel");
const { scheduleFirmwareUpdate, sendFirmwareNow, registerUnregisteredDevice: registerDevice } = require("./deviceMqttController");

// Helper function to get the MQTT handler safely
const getMqttHandler = () => {
    if (global.mqttHandler) {
        return global.mqttHandler;
    }
    console.error("MQTT handler not found in global scope");
    return null;
};

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
                const ip = deviceData.ip_address || deviceData.ip;
                const deviceId = deviceData.device_id || deviceData.deviceId;
    
                if (!ip) {
                    console.log("⚠️ Invalid data received (no IP):", deviceData);
                    return;
                }
    
                // Always force status to "online" when heartbeat is received
                const normalizedStatus = "online";
                
                // Update heartbeat timestamp based on both IP address and device ID if available
                lastHeartbeats[ip] = Date.now();
                
                if (deviceId) {
                    lastHeartbeats[deviceId] = Date.now();
                    
                    // If we have global MQTT handler, update its mapping
                    if (global.mqttHandler && global.mqttHandler.mapDeviceIdToIp) {
                        global.mqttHandler.mapDeviceIdToIp(deviceId, ip);
                    }
                }
                
                console.log(`🟢 Heartbeat received for ${deviceId || ''} (${ip}): Setting status to ${normalizedStatus}`);
                
                // Explicitly update status to online on every heartbeat
                // Include all available data from the heartbeat
                const updateData = {
                    status: normalizedStatus,
                    ip_address: ip
                };
                
                if (deviceId) {
                    updateData.device_id = deviceId;
                }
                
                if (deviceData.firmware_version) {
                    updateData.firmware_version = deviceData.firmware_version;
                }
                
                if (deviceData.metrics) {
                    updateData.metrics = deviceData.metrics;
                }
                
                // Use deviceId as the primary identifier if available, otherwise use IP
                const primaryIdentifier = deviceId || ip;
                  updateDeviceStatus(primaryIdentifier, updateData)
                    .then(result => {
                        if (!result.success) {
                            // Check if this is an unregistered device
                            if (result.unregisteredDevice) {
                                console.log(`✅ Device ${deviceId || ip} added to unregistered devices`);
                            } else {
                                console.log(`❌ Failed to update status for ${primaryIdentifier}: ${result.error}`);
                            }
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
        const deviceId = device.deviceId || device._id;
        
        if (!deviceIp) {
            console.log(`⚠️ Device ${device.name} has no IP address`);
            return;
        }
        
        // Check for heartbeats using both IP and device ID if available
        let lastHeartbeat = lastHeartbeats[deviceIp];
        
        // If no heartbeat by IP, check by device ID
        if (!lastHeartbeat && deviceId) {
            lastHeartbeat = lastHeartbeats[deviceId];
        }
        
        // Also check global MQTT handler's heartbeats if available
        if (!lastHeartbeat && global.mqttHandler && global.mqttHandler.lastHeartbeats) {
            // Try by IP first
            lastHeartbeat = global.mqttHandler.lastHeartbeats.get(deviceIp);
            
            if (lastHeartbeat) {
                // Sync it back to our local tracker
                console.log(`📡 Found heartbeat for ${deviceIp} in global MQTT handler`);
                lastHeartbeats[deviceIp] = lastHeartbeat;
            }
            
            // If still not found, try by device ID
            if (!lastHeartbeat && deviceId) {
                lastHeartbeat = global.mqttHandler.lastHeartbeats.get(deviceId);
                if (lastHeartbeat) {
                    console.log(`📡 Found heartbeat for device ID ${deviceId} in global MQTT handler`);
                    lastHeartbeats[deviceIp] = lastHeartbeat;
                }
            }
            
            // Also check if there's a heartbeat by device ID in the MQTT handler
            if (!lastHeartbeat && global.mqttHandler.getDeviceByIp) {
                const deviceInfo = global.mqttHandler.getDeviceByIp(deviceIp);
                if (deviceInfo && deviceInfo.deviceId) {
                    lastHeartbeat = global.mqttHandler.lastHeartbeats.get(deviceInfo.deviceId);
                    if (lastHeartbeat) {
                        console.log(`📡 Found heartbeat for device ID ${deviceInfo.deviceId} in global MQTT handler`);
                        lastHeartbeats[deviceIp] = lastHeartbeat;
                    }
                }
            }
        }
        
        if (!lastHeartbeat) {
            console.log(`⚠️ No heartbeat received for ${device.name} (${deviceIp}) yet.`);
            
            // If the device has no heartbeat and its status is not already offline,
            // update it to offline
            if (device.status !== "offline") {
                console.log(`🚨 Device ${device.name} (${deviceIp}) has no heartbeat - setting to Offline!`);
                updateDeviceStatus(deviceIp, "offline")
                    .then(result => {
                        if (result.success) {
                            console.log(`✅ Status updated for ${deviceIp} to offline`);
                        } else {
                            console.log(`❌ Failed to update status for ${deviceIp}: ${result.error}`);
                        }
                    })
                    .catch(error => {
                        console.error(`Error updating offline device status: ${error.message}`);
                    });
            }
            return;
        }
        
        if (currentTime - lastHeartbeat > TIMEOUT_LIMIT) {
            console.log(`🚨 Device ${device.name} (${deviceIp}) is now Offline! Last heartbeat was ${Math.floor((currentTime - lastHeartbeat)/1000)} seconds ago`);
            // Update the device status to offline
            updateDeviceStatus(deviceIp, "offline")
                .then(result => {
                    if (result.success) {
                        console.log(`✅ Status updated for ${deviceIp} to offline`);
                    } else {
                        console.log(`❌ Failed to update status for ${deviceIp}: ${result.error}`);
                    }
                })
                .catch(error => {
                    console.error(`Error updating offline device status: ${error.message}`);
                });
            
            // Do NOT delete the heartbeat timestamp, just keep tracking it
            // This allows us to know how long the device has been offline
            // delete lastHeartbeats[deviceIp]; // Remove from tracking
        } else if (device.status !== "online") {
            // If device has a valid heartbeat and status is not online, update to online
            console.log(`🟢 Device ${device.name} (${deviceIp}) has recent heartbeat - setting to Online!`);
            updateDeviceStatus(deviceIp, "online")
                .then(result => {
                    if (result.success) {
                        console.log(`✅ Status updated for ${deviceIp} to online`);
                    } else {
                        console.log(`❌ Failed to update status for ${deviceIp}: ${result.error}`);
                    }
                })
                .catch(error => {
                    console.error(`Error updating online device status: ${error.message}`);
                });
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

/**
 * Schedule a firmware update for a device
 */
exports.scheduleDeviceFirmwareUpdate = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { scheduledTime, firmwareId } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ success: false, error: "Device ID is required" });
        }
        
        if (!scheduledTime) {
            return res.status(400).json({ success: false, error: "Scheduled time is required" });
        }
        
        // Check if device exists (in either registered or unregistered devices)
        const deviceResult = await DeviceModel.getDeviceByDeviceId(deviceId);
        const isRegistered = deviceResult.success;
        
        if (!isRegistered) {
            // Check unregistered devices
            const unregisteredResult = await UnregisteredDeviceModel.getUnregisteredDeviceByDeviceId(deviceId);
            if (!unregisteredResult.success) {
                return res.status(404).json({ success: false, error: "Device not found" });
            }
        }
        
        // Convert scheduledTime to Unix timestamp if it's not already
        let scheduleTimestamp = scheduledTime;
        if (typeof scheduledTime === 'string') {
            scheduleTimestamp = Math.floor(new Date(scheduledTime).getTime() / 1000);
        }
        
        // Schedule the firmware update
        const result = await scheduleFirmwareUpdate(deviceId, scheduleTimestamp, firmwareId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error("Error scheduling firmware update:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Send firmware update to a device immediately
 */
exports.sendFirmwareUpdate = async (req, res) => {
    try {
        const { deviceId, firmwareId } = req.body;
        console.log('Received firmware update request:', { deviceId, firmwareId });

        if (!deviceId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Device ID is required' 
            });
        }

        if (!firmwareId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Firmware ID is required' 
            });
        }

        // Get MQTT handler
        const mqttHandler = getMqttHandler();
        if (!mqttHandler) {
            return res.status(500).json({ 
                success: false, 
                error: 'MQTT handler not available' 
            });
        }

        // Convert to array if needed
        const deviceIds = Array.isArray(deviceId) ? deviceId : [deviceId];

        // Handle empty array
        if (deviceIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No device IDs provided'
            });
        }

        // Send firmware to each device
        const updateResults = await Promise.all(
            deviceIds.map(async (id) => {
                try {
                    if (!id || id.trim() === '') {
                        return { deviceId: id, success: false, error: 'Invalid device ID' };
                    }
                    await mqttHandler.sendFirmwareToDevice(id, firmwareId);
                    return { deviceId: id, success: true };
                } catch (error) {
                    console.error(`Error updating device ${id}:`, error);
                    return { deviceId: id, success: false, error: error.message };
                }
            })
        );

        // Check if any updates were successful
        const anySuccess = updateResults.some(result => result.success);

        if (!anySuccess) {
            return res.status(404).json({
                success: false,
                error: 'Failed to update any devices',
                results: updateResults
            });
        }

        // Return results
        res.json({
            success: true,
            message: 'Firmware update initiated',
            results: updateResults
        });

    } catch (error) {
        console.error('Error sending firmware update:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        });
    }
};

/**
 * Get available firmware for a device
 */
exports.getAvailableFirmwareForDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        if (!deviceId) {
            return res.status(400).json({ success: false, error: "Device ID is required" });
        }
        
        // Get device details
        const deviceResult = await getDeviceById(deviceId);
        if (!deviceResult.success) {
            return res.status(404).json({ success: false, error: "Device not found" });
        }
        
        const device = deviceResult.device;
        const deviceType = device.deviceType || "raspberrypi";
        
        // Get available firmware for this device type
        const firmwareResult = await FirmwareModel.getFirmwareByDeviceType(deviceType);
        if (!firmwareResult.success) {
            return res.status(404).json({ success: false, error: "No firmware available for this device type" });
        }
        
        // Format and return the firmware list
        const firmware = firmwareResult.firmware;
        
        res.json({
            success: true,
            deviceId: deviceId,
            deviceType: deviceType,
            currentFirmware: device.firmwareVersion,
            availableFirmware: firmware.map(fw => ({
                id: fw._id,
                name: fw.name,
                version: fw.version,
                uploadDate: fw.uploadDate,
                size: fw.fileSize,
                description: fw.description || ""
            }))
        });
    } catch (error) {
        console.error("Error getting available firmware:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get all unregistered devices
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const getUnregisteredDevices = async (req, res) => {
    try {
        const result = await UnregisteredDeviceModel.getAllUnregisteredDevices();
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        
        return res.status(200).json({ 
            success: true, 
            devices: result.devices.map(device => ({
                deviceId: device.deviceId,
                ipAddress: device.ipAddress,
                firmwareVersion: device.firmwareVersion,
                lastSeen: device.lastSeen,
                metrics: device.metrics,
                createdAt: device.createdAt
            }))
        });
    } catch (error) {
        console.error('Error getting unregistered devices:', error);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Register an unregistered device with a custom name
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const registerUnregisteredDevice = async (req, res) => {
    try {
        const { deviceId, name } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID is required' });
        }
        
        if (!name) {
            return res.status(400).json({ error: 'Device name is required' });
        }
        
        const result = await registerDevice(deviceId, name);
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        
        return res.status(200).json({ 
            success: true, 
            message: result.message,
            device: result.device
        });
    } catch (error) {
        console.error('Error registering unregistered device:', error);
        return res.status(500).json({ error: error.message });
    }
};

exports.updateDeviceFirmware = async (req, res) => {
    try {
        const { deviceId, firmwareId } = req.body;
        
        console.log('Firmware update request received:', { deviceId, firmwareId });
        
        if (!deviceId || !firmwareId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Device ID and firmware ID are required' 
            });
        }

        // Get MQTT handler
        const mqttHandler = getMqttHandler();
        if (!mqttHandler) {
            return res.status(500).json({ 
                success: false, 
                error: 'MQTT handler not available' 
            });
        }

        // Convert single deviceId to array for backward compatibility
        const deviceIds = Array.isArray(deviceId) ? deviceId : [deviceId];

        // Check if any device IDs are empty
        if (deviceIds.some(id => !id || id.trim() === '')) {
            return res.status(400).json({
                success: false,
                error: 'One or more invalid device IDs'
            });
        }

        // Process updates for all devices
        const updateResults = await Promise.all(
            deviceIds.map(async (id) => {
                try {
                    console.log(`Sending firmware to device: ${id}`);
                    // Send firmware directly through MQTT Handler
                    await mqttHandler.sendFirmwareToDevice(id, firmwareId);
                    return { deviceId: id, success: true };
                } catch (error) {
                    console.error(`Error updating device ${id}:`, error);
                    return { 
                        deviceId: id, 
                        success: false, 
                        error: error.message 
                    };
                }
            })
        );

        // Check if any updates failed
        const anyFailed = updateResults.some(result => !result.success);
        if (anyFailed) {
            return res.status(400).json({
                success: false,
                error: 'Some updates failed',
                results: updateResults
            });
        }

        return res.json({
            success: true,
            message: 'All firmware updates initiated successfully',
            results: updateResults
        });
    } catch (error) {
        console.error('Error updating firmware:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to update firmware'
        });
    }
};

exports.revertFirmware = async (req, res) => {
    try {
        const { deviceId } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID is required' });
        }

        const deviceResult = await getDeviceById(deviceId);
        if (!deviceResult.success) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Send revert command via MQTT
        const mqttHandler = getMqttHandler();
        if (!mqttHandler) {
            return res.status(500).json({ error: 'MQTT handler not available' });
        }

        await mqttHandler.client.publish(
            `cybiot/device/commands/${deviceId}`,
            JSON.stringify({
                action: 'revert_firmware'
            }),
            { qos: 1 }
        );

        res.json({ message: 'Revert command sent successfully' });
    } catch (error) {
        console.error('Error reverting firmware:', error);
        res.status(500).json({ error: error.message || 'Failed to revert firmware' });
    }
};

// Export all controller functions
module.exports = { 
    addDevice, 
    getDevices, 
    removeDevice,
    getUnregisteredDevices,
    registerUnregisteredDevice,
    scheduleDeviceFirmwareUpdate: exports.scheduleDeviceFirmwareUpdate,
    sendFirmwareUpdate: exports.sendFirmwareUpdate,
    getAvailableFirmwareForDevice: exports.getAvailableFirmwareForDevice,
    updateDeviceFirmware: exports.updateDeviceFirmware,
    revertFirmware: exports.revertFirmware
};
