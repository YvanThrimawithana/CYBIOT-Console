const WebSocket = require("ws");
const { getAllDevices, updateDeviceStatus } = require("./models/deviceModel");
const { checkDeviceAvailability } = require("./utils/ping");

const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
    ws.send(JSON.stringify({ message: "Connected to WebSocket server" }));

    const sendDeviceUpdates = async () => {
        try {
            const result = await getAllDevices();
            if (!result.success) {
                console.error("Failed to get devices:", result.error);
                return;
            }

            const devices = result.devices;
            
            // Send full list of devices with their current status
            ws.send(JSON.stringify({ 
                type: 'deviceUpdate',
                devices: devices.map(device => ({
                    id: device.deviceId || device._id,
                    name: device.name,
                    ipAddress: device.ipAddress,
                    ip: device.ipAddress, // For backward compatibility
                    status: device.status || 'Unknown',
                    currentFirmware: device.currentFirmware || 'No firmware',
                    canRevert: device.previousFirmware !== null
                }))
            }));
        } catch (err) {
            console.error("Error sending device updates:", err);
        }
    };

    // Send initial device list
    sendDeviceUpdates();

    // Set up periodic updates
    const interval = setInterval(sendDeviceUpdates, 5000);
    
    ws.on("close", () => {
        console.log("Client disconnected from WebSocket");
        clearInterval(interval);
    });
});

module.exports = wss;