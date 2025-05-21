import React, { useState, useEffect } from "react";
import { getUnregisteredDevices, registerUnregisteredDevice } from "../services/deviceService";
import { theme } from "../styles/theme";
import { MdCheck, MdClose, MdRefresh } from "react-icons/md";

const UnregisteredDevices = ({ onDeviceRegistered }) => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [registering, setRegistering] = useState({});
    const [customNames, setCustomNames] = useState({});

    const fetchUnregisteredDevices = async () => {
        try {
            setLoading(true);
            const result = await getUnregisteredDevices();
            if (result.success) {
                setDevices(result.devices || []);
            } else {
                setError(result.error || "Failed to fetch unregistered devices");
            }
        } catch (err) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUnregisteredDevices();
    }, []);

    const handleNameChange = (deviceId, name) => {
        setCustomNames({
            ...customNames,
            [deviceId]: name
        });
    };

    const handleRegister = async (deviceId) => {
        const deviceName = customNames[deviceId] || `Device ${deviceId.substring(0, 8)}`;
        
        try {
            setRegistering({
                ...registering,
                [deviceId]: true
            });
            
            const result = await registerUnregisteredDevice(deviceId, deviceName);
            
            if (result.success) {
                // Remove from list
                setDevices(devices.filter(d => d.deviceId !== deviceId));
                
                // Notify parent component if provided
                if (onDeviceRegistered) {
                    onDeviceRegistered(result.device);
                }
            } else {
                setError(result.error || "Failed to register device");
            }
        } catch (err) {
            setError(err.toString());
        } finally {
            setRegistering({
                ...registering,
                [deviceId]: false
            });
        }
    };

    if (loading && devices.length === 0) {
        return (
            <div className="p-4 text-center" style={{ color: theme.colors.text.secondary }}>
                Loading unregistered devices...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center" style={{ color: theme.colors.error.main }}>
                Error: {error}
                <button 
                    onClick={fetchUnregisteredDevices}
                    className="ml-2 p-1 rounded-full hover:bg-gray-700"
                    style={{ color: theme.colors.primary.main }}
                >
                    <MdRefresh size={16} />
                </button>
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <div className="p-4 text-center" style={{ color: theme.colors.text.secondary }}>
                No unregistered devices found.
                <button 
                    onClick={fetchUnregisteredDevices}
                    className="ml-2 p-1 rounded-full hover:bg-gray-700"
                    style={{ color: theme.colors.primary.main }}
                >
                    <MdRefresh size={16} />
                </button>
            </div>
        );
    }

    return (
        <div className="mt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
                    Unregistered Devices ({devices.length})
                </h3>
                <button 
                    onClick={fetchUnregisteredDevices}
                    className="p-1 rounded-full hover:bg-gray-700"
                    style={{ color: theme.colors.primary.main }}
                    title="Refresh"
                >
                    <MdRefresh size={20} />
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full" style={{ color: theme.colors.text.primary }}>
                    <thead>
                        <tr className="text-left" style={{ color: theme.colors.text.secondary }}>
                            <th className="p-4 font-medium">Device ID</th>
                            <th className="p-4 font-medium">IP Address</th>
                            <th className="p-4 font-medium">Firmware</th>
                            <th className="p-4 font-medium">Custom Name</th>
                            <th className="p-4 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {devices.map(device => (
                            <tr key={device.deviceId} className="border-t border-gray-700 hover:bg-background-card transition-colors">
                                <td className="p-4">{device.deviceId}</td>
                                <td className="p-4">{device.ipAddress}</td>
                                <td className="p-4">{device.firmwareVersion || 'Unknown'}</td>
                                <td className="p-4">
                                    <input
                                        type="text"
                                        className="p-2 rounded border border-gray-600 bg-gray-800 w-full"
                                        placeholder={`Device ${device.deviceId.substring(0, 8)}`}
                                        value={customNames[device.deviceId] || ''}
                                        onChange={(e) => handleNameChange(device.deviceId, e.target.value)}
                                    />
                                </td>
                                <td className="p-4">
                                    <button
                                        onClick={() => handleRegister(device.deviceId)}
                                        disabled={registering[device.deviceId]}
                                        className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white mr-2 flex items-center"
                                    >
                                        <MdCheck size={16} className="mr-1" />
                                        {registering[device.deviceId] ? 'Registering...' : 'Register'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UnregisteredDevices;
