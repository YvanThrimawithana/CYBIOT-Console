"use client";

import React, { useState, useEffect } from "react";
import { uploadFirmware } from "../services/firmwareService";
import { getDevices } from "../services/deviceService";
import Notification from "./Notification";
import { theme } from "../styles/theme";

const FirmwareUpload = ({ onUploadSuccess }) => {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState(null);
    const [isError, setIsError] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState("");

    useEffect(() => {
        getDevices().then(setDevices);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);
        setIsError(false);

        try {
            if (!file || !selectedDevice) {
                throw new Error("Please select both a device and a firmware file");
            }

            const formData = new FormData();
            formData.append("firmware", file);
            formData.append("deviceType", selectedDevice);
            formData.append("name", file.name.replace('.bin', ''));
            formData.append("version", "1.0.0");
            formData.append("description", `Firmware update for ${selectedDevice}`);

            console.log('Upload starting...', {
                fileName: file.name,
                deviceType: selectedDevice,
                fileSize: file.size
            });

            const response = await uploadFirmware(formData);
            
            if (response.error) {
                throw new Error(response.error);
            }

            setMessage("Firmware uploaded successfully");
            setFile(null);
            setSelectedDevice("");
            onUploadSuccess && onUploadSuccess(response);
        } catch (error) {
            console.error('Upload failed:', error);
            setMessage(error.message || "Upload failed. Please try again.");
            setIsError(true);
        }
    };

    return (
        <div className="bg-background-surface p-6 rounded-lg shadow-lg"
            style={{ background: theme.colors.background.surface }}>
            {message && <Notification message={message} isError={isError} />}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block mb-2" style={{ color: theme.colors.text.primary }}>
                        Select Device Type
                    </label>
                    <select 
                        className="w-full p-2 rounded"
                        style={{ 
                            background: theme.colors.background.card,
                            color: theme.colors.text.primary,
                            border: `1px solid ${theme.colors.background.card}`
                        }}
                        value={selectedDevice} 
                        onChange={(e) => setSelectedDevice(e.target.value)}
                    >
                        <option value="">Select Device</option>
                        {devices.map((device) => (
                            <option key={device.name} value={device.name}>{device.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block mb-2" style={{ color: theme.colors.text.primary }}>
                        Upload Firmware File
                    </label>
                    <input 
                        type="file" 
                        onChange={(e) => setFile(e.target.files[0])}
                        className="w-full p-2 rounded" 
                        style={{ 
                            background: theme.colors.background.card,
                            color: theme.colors.text.primary,
                            border: `1px solid ${theme.colors.background.card}`
                        }}
                        accept=".bin,.hex,.fw"
                    />
                </div>
                <button 
                    type="submit"
                    style={{ background: theme.colors.primary.main }}
                    className="text-white px-4 py-2 rounded hover:opacity-80"
                >
                    Upload Firmware
                </button>
            </form>
        </div>
    );
};

export default FirmwareUpload;
