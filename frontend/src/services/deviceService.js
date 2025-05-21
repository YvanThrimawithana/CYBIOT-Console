import axios from "axios";

const API_URL = "http://localhost:5000/api/devices";
const WS_URL = "ws://localhost:5000"; // WebSocket should match backend port

let socket = new WebSocket(WS_URL);
export const onDeviceUpdate = (callback) => {
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'deviceUpdate') {
            callback(data.devices);
        } else if (data.type === 'firmwareUpdate') {
            // Handle real-time firmware update status
            callback({
                type: 'firmwareUpdate',
                deviceId: data.deviceId,
                status: data.status
            });
        }
    };
};

export const addDevice = async (name, ip) => {
    try {
        const response = await axios.post(`${API_URL}/add`, { 
            name, 
            ipAddress: ip // Changed from ip to ipAddress to match backend expectations
        });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const deleteDevice = async (id, ipAddress) => {
    try {
        if (!id) {
            throw new Error("Device ID is required");
        }
        
        console.log("Sending delete request with ID:", id, "and IP:", ipAddress);
        const response = await axios.post(`${API_URL}/delete`, { 
            id: id,
            ipAddress: ipAddress
        });
        return response.data;
    } catch (error) {
        console.error("Error in deleteDevice service:", error);
        if (error.response) {
            console.error("Server response:", error.response.data);
            throw error.response.data.error || "Server error";
        }
        throw error.message || "Failed to delete device";
    }
};

export const getDevices = async () => {
    const response = await axios.get(`${API_URL}/list`);
    return response.data.devices.map(device => ({
        ...device,
        currentFirmware: device.currentFirmware || 'No firmware',
        canRevert: device.previousFirmware !== null
    }));
};

// New firmware-related functions
export const updateDeviceFirmware = async (deviceIds, firmwareId) => {
    try {
        const response = await axios.post(`${API_URL}/update-firmware`, {
            deviceIds,
            firmwareId
        });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const revertFirmware = async (deviceId) => {
    try {
        const response = await axios.post(`${API_URL}/revert-firmware`, {
            deviceId
        });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const getDeviceFirmwareHistory = async (deviceId) => {
    try {
        const response = await axios.get(`${API_URL}/${deviceId}/firmware-history`);
        return response.data.history;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const checkUpdateStatus = async (deviceId) => {
    try {
        const response = await axios.get(`${API_URL}/${deviceId}/update-status`);
        return response.data.status;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

// Keep existing traffic logs function
export const getTrafficLogs = async (ip) => {
    const response = await fetch(`/api/traffic/logs/${ip}`);
    const data = await response.json();
    return data.logs;
};

// Get list of unregistered devices
export const getUnregisteredDevices = async () => {
    try {
        const response = await axios.get(`${API_URL}/unregistered`);
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

// Register an unregistered device with a custom name
export const registerUnregisteredDevice = async (deviceId, name) => {
    try {
        const response = await axios.post(`${API_URL}/register`, { 
            deviceId,
            name
        });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};