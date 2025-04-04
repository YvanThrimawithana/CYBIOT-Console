const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid"); // Import UUID for unique IDs

const devicesPath = path.join(__dirname, "../data/devices.json");

const getAllDevices = () => {
    if (!fs.existsSync(devicesPath)) return [];
    return JSON.parse(fs.readFileSync(devicesPath, "utf8"));
};

const saveDevice = (device) => {
    const devices = getAllDevices();

    // Check if device already exists based on IP
    const existingDevice = devices.find(d => d.ip === device.ip);
    if (existingDevice) return existingDevice;

    const newDevice = {
        id: uuidv4(), // Assign a unique ID
        ...device
    };

    devices.push(newDevice);
    fs.writeFileSync(devicesPath, JSON.stringify(devices, null, 2), "utf8");
    return newDevice;
};

const updateDeviceStatus = (ip, status) => {
    const devices = getAllDevices();
    let found = false;

    const updatedDevices = devices.map(device => {
        if (device.ip === ip) {
            found = true;
            return { ...device, status };
        }
        return device;
    });

    if (!found) {
        console.log(`⚠️ Device with IP ${ip} not found in database!`);
        return;
    }

    fs.writeFileSync(devicesPath, JSON.stringify(updatedDevices, null, 2), "utf8");
    console.log(`✅ Device with IP ${ip} status updated to ${status}`);
};



const deleteDeviceFromStorage = (id) => {
    let devices = getAllDevices();
    devices = devices.filter(device => device.id !== id);
    fs.writeFileSync(devicesPath, JSON.stringify(devices, null, 2), "utf8");
};

module.exports = { getAllDevices, saveDevice, updateDeviceStatus, deleteDeviceFromStorage };
