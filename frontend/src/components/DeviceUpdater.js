import React, { useState, useEffect } from 'react';
import { getDevices, updateDeviceFirmware, revertFirmware } from '../services/deviceService';

const DeviceUpdater = ({ selectedFirmware, onUpdateSuccess, onRevertSuccess }) => {
    const [devices, setDevices] = useState([]);
    const [selectedDevices, setSelectedDevices] = useState([]);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        loadDevices();
    }, []);

    const loadDevices = async () => {
        const deviceList = await getDevices();
        setDevices(deviceList);
    };

    const handleUpdate = async () => {
        if (!selectedFirmware || selectedDevices.length === 0) return;
        
        setUpdating(true);
        try {
            // Make sure we're passing a proper firmware ID
            if (!selectedFirmware.id) {
                throw new Error('Selected firmware does not have a valid ID');
            }
            
            // Filter out any invalid device IDs
            const validDevices = selectedDevices.filter(id => id && id.trim() !== '');
            
            if (validDevices.length === 0) {
                throw new Error('No valid devices selected');
            }
            
            await updateDeviceFirmware(validDevices, selectedFirmware.id);
            onUpdateSuccess?.();
        } catch (error) {
            console.error('Update failed:', error);
            alert(`Update failed: ${error.message || 'Unknown error'}`);
        } finally {
            setUpdating(false);
        }
    };

    const handleRevert = async (deviceId) => {
        try {
            await revertFirmware(deviceId);
            onRevertSuccess?.();
            await loadDevices();
        } catch (error) {
            console.error('Revert failed:', error);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex space-x-4 items-center">
                <button
                    onClick={() => setSelectedDevices(devices.map(d => d.id))}
                    className="text-sm text-blue-600"
                >
                    Select All
                </button>
                <button
                    onClick={() => setSelectedDevices([])}
                    className="text-sm text-blue-600"
                >
                    Clear Selection
                </button>
            </div>

            <div className="border rounded">
                {devices.map(device => (
                    <div key={device.id} className="flex items-center justify-between p-3 border-b">
                        <div className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={selectedDevices.includes(device.id)}
                                onChange={(e) => {
                                    setSelectedDevices(prev => 
                                        e.target.checked 
                                            ? [...prev, device.id]
                                            : prev.filter(id => id !== device.id)
                                    );
                                }}
                            />
                            <span>{device.name}</span>
                            <span className="text-sm text-gray-500">
                                Current: {device.currentFirmware}
                            </span>
                        </div>
                        
                        <button
                            onClick={() => handleRevert(device.id)}
                            className="text-sm text-red-600"
                            disabled={!device.canRevert}
                        >
                            Revert
                        </button>
                    </div>
                ))}
            </div>

            <button
                onClick={handleUpdate}
                disabled={!selectedFirmware || selectedDevices.length === 0 || updating}
                className="w-full bg-blue-500 text-white py-2 rounded disabled:bg-gray-300"
            >
                {updating ? 'Updating...' : 'Update Selected Devices'}
            </button>
        </div>
    );
};

export default DeviceUpdater;
