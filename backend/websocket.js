const WebSocket = require("ws");
const { getAllDevices, updateDeviceStatus } = require("./models/deviceModel");
const { checkDeviceAvailability } = require("./utils/ping");

const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
    ws.send(JSON.stringify({ message: "Connected to WebSocket server" }));

    const sendDeviceUpdates = async () => {
        const devices = getAllDevices();
        const updatedDevices = await Promise.all(devices.map(async (device) => {
            device.status = await checkDeviceAvailability(device.ip) ? "Active" : "Offline";
            updateDeviceStatus(device.ip, device.status);
            return device;
        }));
        ws.send(JSON.stringify({ devices: updatedDevices }));
    };

    const interval = setInterval(sendDeviceUpdates, 5000);
    ws.on("close", () => clearInterval(interval));
});

module.exports = wss;