"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MdDevices, MdWifiTethering, MdPowerOff, MdFullscreen, MdFullscreenExit, MdHelpOutline } from "react-icons/md";
import { getDevices } from "../services/deviceService";
import { theme } from "../styles/theme";
import { LineChart } from "../components/Charts";
import NetworkMap from "../components/NetworkMap";
import UnregisteredDevices from "../components/UnregisteredDevices";
import { motion, AnimatePresence } from "framer-motion";

const Dashboard = () => {
    const [devices, setDevices] = useState([]);
    const [isNetworkMapExpanded, setIsNetworkMapExpanded] = useState(false);
    const [showUnregistered, setShowUnregistered] = useState(false);
    const [trafficData, setTrafficData] = useState([
        // Mock data for the traffic chart
        { time: '00:00', value: 45 },
        { time: '04:00', value: 30 },
        { time: '08:00', value: 60 },
        { time: '12:00', value: 90 },
        { time: '16:00', value: 75 },
        { time: '20:00', value: 50 },
        { time: '23:59', value: 40 }
    ]);    useEffect(() => {
        const fetchDevices = () => {
            getDevices().then(setDevices);
        };
    
        fetchDevices(); // Initial fetch
        const interval = setInterval(fetchDevices, 5000); // Refresh every 5 seconds
    
        return () => clearInterval(interval); // Cleanup
    }, []);

    // Handle newly registered device
    const handleDeviceRegistered = (device) => {
        // Refresh the device list
        getDevices().then(setDevices);
    };

    const totalDevices = devices.length;
    const activeDevices = devices.filter(device => device.status === "online" || device.status === "Online").length;
    const inactiveDevices = devices.filter(device => device.status === "offline" || device.status === "Offline").length;

    return (
        <div className="p-8" style={{ background: theme.colors.background.main }}>
            <h1 className="text-3xl font-bold mb-8" style={{ color: theme.colors.text.primary }}>
                Network Overview
            </h1>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatusCard
                    icon={<MdDevices size={24} />}
                    title="Total Devices"
                    value={totalDevices}
                    color={theme.colors.primary.main}
                />
                <StatusCard
                    icon={<MdWifiTethering size={24} />}
                    title="Active Devices"
                    value={activeDevices}
                    color={theme.colors.status.success}
                />
                <StatusCard
                    icon={<MdPowerOff size={24} />}
                    title="Inactive Devices"
                    value={inactiveDevices}
                    color={theme.colors.status.error}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-background-surface p-6 rounded-lg shadow-lg" 
                    style={{ background: theme.colors.background.surface }}>
                    <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                        Network Traffic
                    </h2>
                    <LineChart data={trafficData} />
                </div>                <div className="bg-background-surface p-6 rounded-lg shadow-lg relative"
                    style={{ background: theme.colors.background.surface }}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
                            Device Network Map
                        </h2>
                        <button
                            onClick={() => setIsNetworkMapExpanded(!isNetworkMapExpanded)}
                            className="p-2 rounded-md hover:bg-gray-700 transition-colors"
                            style={{ color: theme.colors.primary.main }}
                            title={isNetworkMapExpanded ? "Collapse" : "Expand"}
                        >
                            {isNetworkMapExpanded ? <MdFullscreenExit size={24} /> : <MdFullscreen size={24} />}
                        </button>
                    </div>
                    <div className={`${!isNetworkMapExpanded ? 'h-64' : ''}`}>
                        <NetworkMap devices={devices} expanded={isNetworkMapExpanded} />
                    </div>
                </div>
                
                {/* Expanded Network Map Overlay */}
                <AnimatePresence>
                    {isNetworkMapExpanded && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-8"
                        >
                            <motion.div 
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.9 }}
                                className="bg-background-surface rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-auto"
                                style={{ background: theme.colors.background.surface }}
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-semibold" style={{ color: theme.colors.text.primary }}>
                                        Network Topology
                                    </h2>
                                    <button
                                        onClick={() => setIsNetworkMapExpanded(false)}
                                        className="p-2 rounded-md hover:bg-gray-700 transition-colors"
                                        style={{ color: theme.colors.primary.main }}
                                        title="Collapse"
                                    >
                                        <MdFullscreenExit size={28} />
                                    </button>
                                </div>
                                <div className="h-[70vh]">
                                    <NetworkMap devices={devices} expanded={isNetworkMapExpanded} />
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>            {/* Device List */}
            <div className="bg-background-surface rounded-lg shadow-lg overflow-hidden"
                style={{ background: theme.colors.background.surface }}>
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
                        Connected Devices
                    </h2>
                    <button
                        onClick={() => setShowUnregistered(!showUnregistered)}
                        className="p-2 rounded-md hover:bg-gray-700 transition-colors flex items-center"
                        style={{ color: theme.colors.primary.main }}
                    >
                        <MdHelpOutline size={20} className="mr-1" />
                        {showUnregistered ? "Hide Unregistered" : "Show Unregistered"}
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left" style={{ backgroundColor: theme.colors.background.card }}>
                                <th className="p-4 font-semibold" style={{ color: theme.colors.text.secondary }}>Name</th>
                                <th className="p-4 font-semibold" style={{ color: theme.colors.text.secondary }}>IP Address</th>
                                <th className="p-4 font-semibold" style={{ color: theme.colors.text.secondary }}>Status</th>
                                <th className="p-4 font-semibold" style={{ color: theme.colors.text.secondary }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map((device, index) => (
                                <DeviceRow key={index} device={device} />
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Unregistered Devices Section */}
                {showUnregistered && (
                    <div className="border-t border-gray-700 p-4">
                        <UnregisteredDevices onDeviceRegistered={handleDeviceRegistered} />
                    </div>
                )}
            </div>
        </div>
    );
};

const StatusCard = ({ icon, title, value, color }) => (
    <div className="p-6 rounded-lg shadow-lg" style={{ background: theme.colors.background.surface }}>
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-full" style={{ background: `${color}20` }}>
                <div style={{ color }}>{icon}</div>
            </div>
            <div>
                <h3 className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>{title}</h3>
                <p className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>{value}</p>
            </div>
        </div>
    </div>
);

const DeviceRow = ({ device }) => (
    <tr className="border-t border-gray-700 hover:bg-background-card transition-colors">
        <td className="p-4" style={{ color: theme.colors.text.primary }}>{device.name}</td>
        <td className="p-4" style={{ color: theme.colors.text.secondary }}>{device.ipAddress || device.ip}</td>
        <td className="p-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                device.status?.toLowerCase() === "online" 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
            }`}>
                {device.status || 'Unknown'}
            </span>
        </td>
        <td className="p-4">
            <Link to={`/traffic/${device.ipAddress || device.ip}`}
                className="text-sm font-medium"
                style={{ color: theme.colors.primary.main }}>
                View Details
            </Link>
        </td>
    </tr>
);

export default Dashboard;
