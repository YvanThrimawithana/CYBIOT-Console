"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDevices, deleteDevice, onDeviceUpdate } from "../services/deviceService";

const DeviceList = () => {
    const [devices, setDevices] = useState([]);

    useEffect(() => {
        getDevices().then(setDevices);
        onDeviceUpdate(setDevices);
    }, []);

    const handleDelete = async (id) => {
        await deleteDevice(id);
        setDevices(devices.filter(device => device.id !== id));
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white items-center p-0 pt-10">
            <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-blue-400 mb-4 text-center">Registered IoT Devices</h2>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-700 text-blue-300 text-left">
                                <th className="p-3">Name</th>
                                <th className="p-3">IP Address</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map((device, index) => (
                                <tr key={index} className="border-b border-gray-600 hover:bg-gray-700 cursor-pointer">
                                    <td className="p-3">
                                    <Link to={`/traffic/${device.ip}`} className="text-blue-400 hover:underline">
                                    {device.name}
                                    </Link>
                                    </td>
                                    <td className="p-3">{device.ip}</td>
                                    <td className="p-3 font-bold" style={{ color: device.status === "Active" ? "#4CAF50" : "#E53E3E" }}>
                                        {device.status}
                                    </td>
                                    <td className="p-3">
                                        <button 
                                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition-all duration-300"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DeviceList;