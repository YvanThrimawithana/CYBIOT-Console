"use client";

import React from "react";
import { Link } from "react-router-dom";
import { getDevices, deleteDevice, onDeviceUpdate } from "../services/deviceService";
import { theme } from "../styles/theme";
import { MdRefresh, MdDelete, MdInfo, MdDevices } from "react-icons/md";

const DeviceList = ({ 
    devices = null, 
    refreshDevices = null, 
    loading = false, 
    onSelectDevice = null,
    selectedDeviceId = null 
}) => {
    const [localDevices, setLocalDevices] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        // If devices are provided as props, use them
        // Otherwise, fetch devices from the API
        if (devices !== null) {
            setLocalDevices(devices);
            setIsLoading(false);
        } else {
            fetchDevices();
            onDeviceUpdate(setLocalDevices);
        }
    }, [devices]);

    const fetchDevices = async () => {
        if (refreshDevices) {
            // Use the parent's refresh function if provided
            refreshDevices();
        } else {
            // Otherwise handle it locally
            setIsLoading(true);
            try {
                const deviceList = await getDevices();
                setLocalDevices(deviceList);
            } catch (error) {
                console.error("Failed to fetch devices:", error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDelete = async (device, e) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this device?")) {
            try {
                // Print the entire device object for debugging
                console.log("Full device object:", device);
                
                // In MongoDB, _id is stored in a special format with $oid
                // We need to extract it properly
                let id;
                const ipAddress = device.ipAddress || device.ip;
                
                // Case 1: When _id is an object with $oid (from direct MongoDB export)
                if (device._id && typeof device._id === 'object' && device._id.$oid) {
                    id = device._id.$oid;
                    console.log("Using MongoDB ObjectID from $oid:", id);
                } 
                // Case 2: When _id is a simple string
                else if (device._id) {
                    id = device._id;
                    console.log("Using direct _id string:", id);
                } 
                // Case 3: Fallback to deviceId
                else if (device.deviceId) {
                    id = device.deviceId;
                    console.log("Using deviceId as fallback:", id);
                }
                // Case 4: No valid ID found
                else {
                    console.error("No valid ID found for device:", device);
                    alert("Could not delete device: Missing device identifier");
                    return;
                }
                
                console.log("Deleting device with ID:", id);
                
                // Pass the IP address to stop monitoring after deletion
                await deleteDevice(id, ipAddress);
                
                // Refresh the list after deletion
                if (refreshDevices) {
                    refreshDevices();
                } else {
                    fetchDevices();
                }
            } catch (error) {
                console.error("Failed to delete device:", error);
                alert(`Failed to delete device: ${error.message || "Unknown error"}`);
            }
        }
    };
    
    const handleSelectDevice = (device) => {
        if (onSelectDevice) {
            onSelectDevice(device);
        }
    };
    
    const displayedDevices = devices !== null ? devices : localDevices;
    const isDataLoading = loading !== null ? loading : isLoading;

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold" style={{ color: theme.colors.text.primary }}>
                    <span className="flex items-center">
                        <MdDevices className="mr-2" />
                        Device List
                    </span>
                </h2>
                {!refreshDevices && (
                    <button 
                        onClick={fetchDevices}
                        className="flex items-center px-3 py-1 rounded"
                        style={{ color: theme.colors.primary.main }}
                        disabled={isDataLoading}
                    >
                        <MdRefresh className={isDataLoading ? "animate-spin" : ""} />
                        <span className="ml-1">Refresh</span>
                    </button>
                )}
            </div>
            <div className="overflow-x-auto">
                {isDataLoading ? (
                    <div className="p-6 text-center" style={{ color: theme.colors.text.secondary }}>
                        <div className="animate-pulse">Loading devices...</div>
                    </div>
                ) : displayedDevices.length > 0 ? (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-700 text-left">
                                <th className="p-4 font-semibold" style={{ color: theme.colors.text.secondary }}>Name</th>
                                <th className="p-4 font-semibold" style={{ color: theme.colors.text.secondary }}>IP Address</th>
                                <th className="p-4 font-semibold" style={{ color: theme.colors.text.secondary }}>Status</th>
                                <th className="p-4 font-semibold text-right" style={{ color: theme.colors.text.secondary }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedDevices.map((device) => (
                                <tr 
                                    key={device._id || device.deviceId || device.id || `device-${device.name}-${device.ipAddress || device.ip}`} 
                                    className={`border-t border-gray-700 hover:bg-gray-700/50 transition-colors cursor-pointer ${
                                        selectedDeviceId === (device._id || device.deviceId || device.id) ? 'bg-gray-700/70' : ''
                                    }`}
                                    onClick={() => handleSelectDevice(device)}
                                >
                                    <td className="p-4" style={{ color: theme.colors.text.primary }}>
                                        {device.name}
                                    </td>
                                    <td className="p-4" style={{ color: theme.colors.text.secondary }}>
                                        {device.ipAddress || device.ip}
                                    </td>
                                    <td className="p-4">
                                        <span 
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                (device.status || '').toLowerCase() === 'online'
                                                    ? 'bg-green-100 text-green-800'
                                                    : (device.status || '').toLowerCase() === 'offline'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                        >
                                            {device.status || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <Link 
                                            to={`/traffic/${device.ipAddress || device.ip}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                                        >
                                            <MdInfo className="mr-1" />
                                            Details
                                        </Link>
                                        <button
                                            onClick={(e) => handleDelete(device, e)}
                                            className="inline-flex items-center px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                        >
                                            <MdDelete className="mr-1" />
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-6 text-center" style={{ color: theme.colors.text.secondary }}>
                        No devices found. Add a device to get started.
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeviceList;