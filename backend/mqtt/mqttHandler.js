const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const { updateDeviceStatus } = require('../models/deviceModel');

class MQTTHandler {
    constructor() {
        // Use your local broker instead of hivemq
        this.client = mqtt.connect('mqtt://localhost:1883');
        this.devicesFilePath = path.join(__dirname, 'devices.json');
        this.lastHeartbeats = new Map();
        this.heartbeatThreshold = 15000; // 15 seconds
        this.topicToSubscribe = 'cybiot/device/heartbeat'; // Your heartbeat topic

        this.client.on('connect', () => {
            console.log('✅ Connected to MQTT broker at 192.168.1.7:1883');
            
            // Subscribe to specific topic rather than wildcard
            this.client.subscribe(this.topicToSubscribe, (err) => {
                if (err) {
                    console.log("❌ Failed to subscribe:", err);
                } else {
                    console.log(`📡 Subscribed to topic: ${this.topicToSubscribe}`);
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
    }

    handleMessage(topic, message) {
        console.log(`📨 Received message on topic ${topic}: ${message.toString()}`);
        
        if (topic === this.topicToSubscribe) {
            try {
                const deviceData = JSON.parse(message.toString());
                const { ip, status } = deviceData;

                if (!ip) {
                    console.log("⚠️ Invalid heartbeat data received (no IP):", deviceData);
                    return;
                }

                // Always force status to "online" when heartbeat is received
                const normalizedStatus = "online";
                
                // Update heartbeat timestamp based on IP address
                this.lastHeartbeats.set(ip, Date.now());
                console.log(`🟢 Heartbeat received for ${ip}: Setting status to ${normalizedStatus}`);
                
                // Update device status in MongoDB
                updateDeviceStatus(ip, normalizedStatus)
                    .then(result => {
                        if (!result || !result.success) {
                            console.log(`❌ Failed to update status for ${ip}: ${result?.error || 'Unknown error'}`);
                        } else {
                            console.log(`✅ Status updated for ${ip} to ${normalizedStatus}`);
                        }
                    })
                    .catch(error => {
                        console.error(`Error updating device status: ${error.message}`);
                    });
            } catch (error) {
                console.error("❌ Error processing MQTT message:", error);
            }
        } else {
            // Log other messages
            this.logNetworkTraffic({
                timestamp: new Date().toISOString(),
                topic,
                message: message.toString()
            });
        }
    }

    logNetworkTraffic(log) {
        const logFilePath = path.join(__dirname, 'network_traffic.log');
        const logEntry = `${log.timestamp} - Topic: ${log.topic} - Message: ${log.message}\n`;
        fs.appendFileSync(logFilePath, logEntry);
    }

    checkDevicesStatus() {
        // Use MongoDB device checking instead
        // The deviceController.js already handles this via interval
        console.log('🔍 MQTT handler checking device statuses...');
    }

    startStatusChecker() {
        // Use a shorter interval for more frequent checks
        setInterval(() => this.checkDevicesStatus(), 15000);
    }
}

module.exports = MQTTHandler;