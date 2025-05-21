const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const { updateDeviceStatus } = require('../models/deviceModel');

class MQTTHandler {    constructor() {
        // Use your local broker instead of hivemq
        this.client = mqtt.connect('mqtt://localhost:1883');
        this.devicesFilePath = path.join(__dirname, 'devices.json');
        this.lastHeartbeats = new Map();
        this._deviceIdToIpMap = new Map(); // Map device IDs to IP addresses
        this._ipToDeviceIdMap = new Map(); // Map IP addresses to device IDs
        this.heartbeatThreshold = 15000; // 15 seconds
        this.topicToSubscribe = 'cybiot/device/heartbeat'; // Your heartbeat topic
        this.commandTopicPrefix = 'cybiot/device/commands/'; // Topic prefix for commands
        this.firmwareTopicPrefix = 'cybiot/device/firmware/'; // Topic prefix for firmware updates

        // Add WebSocket reference
        this.wss = global.wss;

        this.client.on('connect', () => {
            console.log('✅ Connected to MQTT broker at 192.168.1.7:1883');
            
            // Subscribe to heartbeat topic
            this.client.subscribe(this.topicToSubscribe, (err) => {
                if (err) {
                    console.log("❌ Failed to subscribe to heartbeat topic:", err);
                } else {
                    console.log(`📡 Subscribed to heartbeat topic: ${this.topicToSubscribe}`);
                }
            });
            
            // Subscribe to command responses
            this.client.subscribe(`${this.commandTopicPrefix}+`, (err) => {
                if (err) {
                    console.log("❌ Failed to subscribe to command topics:", err);
                } else {
                    console.log(`📡 Subscribed to command topics: ${this.commandTopicPrefix}+`);
                }
            });
        });

        this.client.on('error', (error) => {
            console.error('❌ MQTT connection error:', error);
        });

        this.client.on('disconnect', () => {
            console.log('⚠️ Disconnected from MQTT broker');
        });

        this.client.on('message', (topic, message) => {
            this.handleMessage(topic, message);
        });

        this.startStatusChecker();
    }

    loadDevices() {
        // Continue with existing code
        if (fs.existsSync(this.devicesFilePath)) {
            const data = fs.readFileSync(this.devicesFilePath);
            return JSON.parse(data);
        }
        return [];
    }

    saveDevices(devices) {
        fs.writeFileSync(this.devicesFilePath, JSON.stringify(devices, null, 2));
    }

    handleHeartbeat(deviceId) {
        const now = Date.now();
        const devices = this.loadDevices();
        const device = devices.find(d => d.id === deviceId);
        
        if (!device) return;

        const lastBeat = this.lastHeartbeats.get(deviceId);
        if (!lastBeat || (now - lastBeat) >= device.heartbeatInterval) {
            device.lastHeartbeat = now;
            device.status = 'Online';
            device.connectionDetails.lastConnected = now;
            this.lastHeartbeats.set(deviceId, now);
            this.saveDevices(devices);
        }
    }    async handleMessage(topic, message) {
        console.log(`📨 Received message on topic ${topic}: ${message.toString()}`);
        
        if (topic === this.topicToSubscribe) {
            try {
                const data = JSON.parse(message.toString());
                const ipAddress = data.ip_address || data.ip;
                const deviceId = data.device_id || data.deviceId;
                
                if (!ipAddress) {
                    console.log("⚠️ No IP address in heartbeat message:", data);
                    return;
                }
                
                // Always force status to "online" when heartbeat is received
                const normalizedStatus = "online";
                
                // Map the device ID to IP if we have both
                if (deviceId && ipAddress) {
                    this.mapDeviceIdToIp(deviceId, ipAddress);
                }
                
                // Debounce heartbeats to avoid processing too many updates
                const now = Date.now();
                const lastBeat = this.lastHeartbeats.get(deviceId || ipAddress);
                
                if (lastBeat && (now - lastBeat < 100)) { // Debounce threshold of 100ms
                    console.log(`🔄 Heartbeat for ${deviceId || ipAddress} received too soon after previous one (${now - lastBeat}ms), debouncing...`);
                    return;
                }
                
                // Store heartbeat timestamp by device ID and IP address
                if (deviceId) {
                    this.lastHeartbeats.set(deviceId, now);
                }
                
                if (ipAddress) {
                    this.lastHeartbeats.set(ipAddress, now);
                }
                
                // Emit the heartbeat event
                console.log(`🟢 Heartbeat received for ${deviceId || ''} (${ipAddress}): Setting status to ${normalizedStatus}`);
                
                // Update the device in the database
                const DeviceModel = require('../models/deviceModel');
                
                let updateTarget = deviceId || ipAddress;
                let updateData = { 
                    status: normalizedStatus,
                    ipAddress: ipAddress
                };
                
                if (data.firmware_version) {
                    updateData.firmwareVersion = data.firmware_version;
                }
                
                if (deviceId) {
                    updateData.device_id = deviceId;
                }
                
                // Include any metrics in the update
                if (data.metrics) {
                    updateData.metrics = data.metrics;
                }
                  DeviceModel.updateDeviceStatus(updateTarget, updateData)
                    .then(result => {
                        if (!result.success) {
                            // Check if this is an unregistered device
                            if (result.unregisteredDevice) {
                                console.log(`✅ Device ${deviceId || ipAddress} added to unregistered devices`);
                            } else {
                                console.log(`❌ Failed to update device ${updateTarget}: ${result.error}`);
                            }
                        } else if (result.wasCreated) {
                            console.log(`🆕 Auto-registered new device ${result.device.name} from heartbeat`);
                        } else {
                            console.log(`✅ MQTT Handler: Status updated for ${ipAddress} to ${normalizedStatus}`);
                        }
                    })
                    .catch(error => {
                        console.error(`MQTT Handler: Error updating ${normalizedStatus} device status: ${error.message}`);
                    });
            } catch (error) {
                console.error("❌ Error processing heartbeat message:", error);
            }
        } else if (topic.startsWith(this.commandTopicPrefix)) {
            // Process command responses
            const deviceId = topic.split('/').pop();
            console.log(`📬 Received command response from device ${deviceId}`);
            
            try {
                const response = JSON.parse(message.toString());
                
                // If WebSocket is available, forward the response to clients
                if (this.wss && this.wss.clients) {
                    this.wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'commandResponse',
                                deviceId,
                                response
                            }));
                        }
                    });
                }
            } catch (error) {
                console.error("❌ Error processing command response:", error);
            }
        } else {
            // Handle other topics
            console.log(`📨 Received message on unhandled topic ${topic}`);
        }
    }    logNetworkTraffic(log) {
        const logFilePath = path.join(__dirname, 'network_traffic.log');
        const logEntry = `${log.timestamp} - Topic: ${log.topic} - Message: ${log.message}\n`;
        fs.appendFileSync(logFilePath, logEntry);
    }
    
    async sendFirmwareToDevice(deviceId, originalDeviceId = null) {
        try {
            console.log(`🔄 Processing firmware request for device ${deviceId}`);
            
            // Get device info from MongoDB to determine which firmware to send
            const DeviceModel = require('../models/deviceModel');
            const FirmwareModel = require('../models/firmwareModel');
            
            const deviceResult = await DeviceModel.getDeviceById(deviceId);
            if (!deviceResult || !deviceResult.success) {
                console.error(`❌ Device not found: ${deviceId}`);
                return;
            }
            
            const device = deviceResult.device;
            const deviceType = device.deviceType || 'raspberrypi';
            
            // Get the latest firmware for this device type
            const firmwareResult = await FirmwareModel.getLatestFirmware(deviceType);
            if (!firmwareResult || !firmwareResult.success) {
                console.error(`❌ No firmware found for device type: ${deviceType}`);
                return;
            }
            
            const firmware = firmwareResult.firmware;
            const firmwareId = firmware._id.toString();
            
            // Get the firmware file binary
            const fileBuffer = await FirmwareModel.getFirmwareFile(firmwareId);
            if (!fileBuffer) {
                console.error(`❌ Failed to retrieve firmware binary: ${firmwareId}`);
                return;
            }
            
            // Create firmware info header
            const firmwareInfo = {
                name: firmware.name,
                version: firmware.version,
                hash: firmware.hash,
                device_type: deviceType,
                size: fileBuffer.length,
                timestamp: Date.now()
            };
            
            // Create binary message with JSON header and binary data
            // Format: JSON metadata followed by null byte, then the binary data
            const infoBuffer = Buffer.from(JSON.stringify(firmwareInfo) + '\0');
            const completeBuffer = Buffer.concat([infoBuffer, fileBuffer]);
            
            // Send the firmware to the device
            console.log(`📤 Sending firmware ${firmware.name} v${firmware.version} to device ${deviceId}`);
            this.client.publish(`${this.firmwareTopicPrefix}${deviceId}`, completeBuffer, { qos: 1 });
            
            // Update device record to indicate firmware was sent
            await DeviceModel.updateDevice(deviceId, {
                lastFirmwareSent: new Date(),
                lastFirmwareId: firmwareId,
                updateStatus: 'sent'
            });
            
            console.log(`✅ Firmware sent to device ${deviceId}`);
        } catch (error) {
            console.error(`❌ Error sending firmware: ${error.message}`);
        }
    }    checkDevicesStatus() {
        // Use MongoDB device checking instead
        // The deviceController.js already handles this via interval
        console.log('🔍 MQTT handler checking device statuses...');
        
        // Get all devices from MongoDB and check their statuses
        const DeviceModel = require('../models/deviceModel');
        const { updateDeviceStatus } = require('../models/deviceModel');
        
        DeviceModel.getAllDevices()
            .then(result => {
                if (!result.success) {
                    console.error('Error getting devices:', result.error);
                    return;
                }
                
                const devices = result.devices;
                const now = Date.now();
                
                devices.forEach(device => {
                    const ipAddress = device.ipAddress || device.ip;
                    const deviceId = device.deviceId;
                    
                    if (!ipAddress) {
                        console.log(`⚠️ Device ${device.name} has no IP address`);
                        return;
                    }
                    
                    // Check both deviceId and IP address for heartbeats
                    let lastHeartbeat = null;
                    
                    if (deviceId) {
                        lastHeartbeat = this.lastHeartbeats.get(deviceId);
                    }
                    
                    if (!lastHeartbeat) {
                        lastHeartbeat = this.lastHeartbeats.get(ipAddress);
                    }
                    
                    if (!lastHeartbeat) {
                        return; // Let the device controller handle new devices with no heartbeat
                    }
                    
                    // Check if device is offline based on heartbeat threshold
                    if (now - lastHeartbeat > this.heartbeatThreshold) {
                        console.log(`🚨 MQTT Handler: Device ${device.name} (${ipAddress}) is now Offline! Last heartbeat was ${Math.floor((now - lastHeartbeat)/1000)} seconds ago`);
                        
                        // Only update if the current status is not already offline
                        if (device.status !== 'offline') {
                            console.log(`📝 Attempting to update device status for ${ipAddress} to offline`);
                            
                            updateDeviceStatus(deviceId || ipAddress, 'offline')
                                .then(result => {
                                    if (result.success) {
                                        console.log(`✅ MQTT Handler: Status updated for ${ipAddress} to offline`);
                                    } else {
                                        console.log(`❌ MQTT Handler: Failed to update status for ${ipAddress}: ${result.error}`);
                                    }
                                })
                                .catch(err => {
                                    console.error(`MQTT Handler: Error updating offline device status: ${err.message}`);
                                });
                        }
                    } else if (device.status !== 'online') {
                        // Device has a recent heartbeat but status is not online
                        console.log(`🟢 MQTT Handler: Device ${device.name} (${ipAddress}) has recent heartbeat - setting to Online!`);
                        
                        updateDeviceStatus(deviceId || ipAddress, 'online')
                            .then(result => {
                                if (result.success) {
                                    console.log(`✅ MQTT Handler: Status updated for ${ipAddress} to online`);
                                } else {
                                    console.log(`❌ MQTT Handler: Failed to update status for ${ipAddress}: ${result.error}`);
                                }
                            })
                            .catch(err => {
                                console.error(`MQTT Handler: Error updating online device status: ${err.message}`);
                            });
                    }
                });
            })
            .catch(error => {
                console.error('MQTT Handler: Error checking device statuses:', error);
            });
    }startStatusChecker() {
        // Use a shorter interval for more frequent checks
        setInterval(() => this.checkDevicesStatus(), 10000); // Check every 10 seconds
    }
    
    // Get device info by IP
    getDeviceByIp(ipAddress) {
        if (!ipAddress) {
            return null;
        }
        
        // First check our map for a device ID
        const deviceId = this._ipToDeviceIdMap.get(ipAddress);
        if (deviceId) {
            return { deviceId, ipAddress };
        }
        
        // Search for the device with this IP in our MongoDB
        const DeviceModel = require('../models/deviceModel');
        
        return DeviceModel.findOneAndUpdate({ ipAddress }, {}, { new: true })
            .then(device => {
                if (device && device.deviceId) {
                    // Update our maps
                    this.mapDeviceIdToIp(device.deviceId, ipAddress);
                    return { deviceId: device.deviceId, ipAddress };
                }
                return null;
            })
            .catch(err => {
                console.error(`Error getting device by IP ${ipAddress}:`, err);
                return null;
            });
    }
    
    // Map a device ID to an IP address
    mapDeviceIdToIp(deviceId, ipAddress) {
        if (!deviceId || !ipAddress) {
            return;
        }
        
        // Initialize maps if they don't exist yet
        if (!this._deviceIdToIpMap) {
            this._deviceIdToIpMap = new Map();
        }
        
        if (!this._ipToDeviceIdMap) {
            this._ipToDeviceIdMap = new Map();
        }
        
        this._deviceIdToIpMap.set(deviceId, ipAddress);
        this._ipToDeviceIdMap.set(ipAddress, deviceId);
        console.log(`📍 Mapped device ID ${deviceId} to IP ${ipAddress}`);
    }
}

// Export as a singleton instance
const mqttHandler = new MQTTHandler();

module.exports = {
    getInstance: () => {
        if (!global.mqttHandler) {
            global.mqttHandler = mqttHandler;
        }
        return global.mqttHandler;
    },
    MQTTHandler // Export the class as well for type checking
};