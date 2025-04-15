const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

class MQTTHandler {
    constructor() {
        this.client = mqtt.connect('mqtt://broker.hivemq.com');
        this.devicesFilePath = path.join(__dirname, 'devices.json');
        this.lastHeartbeats = new Map();
        this.heartbeatThreshold = 30000; // 30 seconds

        this.client.on('connect', () => {
            console.log('Connected to MQTT broker');
            this.client.subscribe('#');
        });

        this.client.on('message', (topic, message) => {
            this.handleMessage(topic, message);
        });

        this.startStatusChecker();
    }

    loadDevices() {
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
        if (topic.endsWith('/heartbeat')) {
            const deviceId = topic.split('/')[1];
            this.handleHeartbeat(deviceId);
            return; // Don't log heartbeats
        }

        // Log only non-heartbeat messages
        this.logNetworkTraffic({
            timestamp: new Date().toISOString(),
            topic,
            message: message.toString()
        });
    }

    logNetworkTraffic(log) {
        const logFilePath = path.join(__dirname, 'network_traffic.log');
        const logEntry = `${log.timestamp} - Topic: ${log.topic} - Message: ${log.message}\n`;
        fs.appendFileSync(logFilePath, logEntry);
    }

    checkDevicesStatus() {
        const devices = this.loadDevices();
        const now = Date.now();

        devices.forEach(device => {
            const lastBeat = device.lastHeartbeat;
            if (lastBeat && (now - lastBeat) > device.heartbeatInterval * 2) {
                device.status = 'Offline';
                device.connectionDetails.disconnectionReason = 'Heartbeat timeout';
                device.connectionDetails.reconnectAttempts += 1;
            }
        });

        this.saveDevices(devices);
    }

    // Start status checker
    startStatusChecker() {
        setInterval(() => this.checkDevicesStatus(), 15000); // Check every 15 seconds
    }
}

module.exports = MQTTHandler;