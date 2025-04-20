"use client";

import React, { useState, useEffect } from "react";
import AddDevice from "../components/AddDevice";
import DeviceList from "../components/DeviceList";
import { theme } from "../styles/theme";
import { MdSearch, MdFilterList, MdCheckCircle, MdError, MdRefresh, MdDevices } from "react-icons/md";
import { getDevices } from "../services/deviceService";

const DeviceConsole = () => {
    const [devices, setDevices] = useState([]);
    const [filteredDevices, setFilteredDevices] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    
    const fetchDevices = async () => {
        setRefreshing(true);
        try {
            const deviceList = await getDevices();
            setDevices(deviceList);
            applyFilters(deviceList, searchQuery, statusFilter);
        } catch (error) {
            console.error("Failed to fetch devices:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDevices();
        // Set up periodic refresh
        const interval = setInterval(fetchDevices, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        applyFilters(devices, searchQuery, statusFilter);
    }, [searchQuery, statusFilter]);

    const applyFilters = (deviceList, query, status) => {
        let filtered = [...deviceList];
        
        // Apply search filter
        if (query) {
            filtered = filtered.filter(device => 
                device.name.toLowerCase().includes(query.toLowerCase()) || 
                (device.ipAddress || device.ip).toLowerCase().includes(query.toLowerCase())
            );
        }
        
        // Apply status filter
        if (status !== "all") {
            filtered = filtered.filter(device => {
                const deviceStatus = (device.status || "unknown").toLowerCase();
                return status === deviceStatus;
            });
        }
        
        setFilteredDevices(filtered);
    };

    const handleAddDeviceSuccess = () => {
        fetchDevices();
    };

    const handleDeviceSelect = (device) => {
        setSelectedDevice(device);
    };

    // Calculate status counts
    const onlineCount = devices.filter(d => 
        (d.status || "").toLowerCase() === "online").length;
    const offlineCount = devices.filter(d => 
        (d.status || "").toLowerCase() === "offline").length;
    const unknownCount = devices.filter(d => 
        !d.status || d.status.toLowerCase() === "unknown").length;

    return (
        <div className="p-8" style={{ background: theme.colors.background.main }}>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                    <h1 className="text-3xl font-bold mb-4 md:mb-0" style={{ color: theme.colors.text.primary }}>
                        Device Management
                    </h1>
                    <div className="flex space-x-2">
                        <button 
                            onClick={fetchDevices}
                            className="flex items-center px-4 py-2 rounded-lg shadow-sm"
                            style={{ 
                                backgroundColor: theme.colors.background.surface,
                                color: theme.colors.primary.main
                            }}
                            disabled={refreshing}
                        >
                            <MdRefresh className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>
                
                {/* Status Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <StatusCard 
                        title="Online Devices" 
                        count={onlineCount} 
                        icon={<MdCheckCircle size={24} />} 
                        color={theme.colors.status.success}
                        onClick={() => setStatusFilter("online")}
                        active={statusFilter === "online"}
                    />
                    <StatusCard 
                        title="Offline Devices" 
                        count={offlineCount} 
                        icon={<MdError size={24} />} 
                        color={theme.colors.status.error}
                        onClick={() => setStatusFilter("offline")}
                        active={statusFilter === "offline"}
                    />
                    <StatusCard 
                        title="All Devices" 
                        count={devices.length} 
                        icon={<MdDevices size={24} />} 
                        color={theme.colors.primary.main}
                        onClick={() => setStatusFilter("all")}
                        active={statusFilter === "all"}
                    />
                </div>
                
                {/* Search and Filters */}
                <div className="mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-grow">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                            <input
                                type="text"
                                placeholder="Search devices by name or IP..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full py-2 pl-10 pr-4 rounded-lg border focus:outline-none focus:ring-2"
                                style={{ 
                                    backgroundColor: theme.colors.background.surface,
                                    color: theme.colors.text.primary,
                                    borderColor: theme.colors.background.card
                                }}
                            />
                        </div>
                        <div className="flex items-center">
                            <span className="mr-2" style={{ color: theme.colors.text.secondary }}>
                                <MdFilterList size={20} />
                            </span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="py-2 px-4 rounded-lg border focus:outline-none focus:ring-2"
                                style={{ 
                                    backgroundColor: theme.colors.background.surface,
                                    color: theme.colors.text.primary,
                                    borderColor: theme.colors.background.card
                                }}
                            >
                                <option value="all">All Status</option>
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
                                <option value="unknown">Unknown</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <AddDevice onSuccess={handleAddDeviceSuccess} />
                        
                        {/* Device Details Card */}
                        {selectedDevice && (
                            <div 
                                className="mt-6 p-6 rounded-lg shadow-lg" 
                                style={{ background: theme.colors.background.surface }}
                            >
                                <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.primary.main }}>
                                    Device Details
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm" style={{ color: theme.colors.text.secondary }}>
                                            Name
                                        </label>
                                        <div style={{ color: theme.colors.text.primary }}>
                                            {selectedDevice.name}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm" style={{ color: theme.colors.text.secondary }}>
                                            IP Address
                                        </label>
                                        <div style={{ color: theme.colors.text.primary }}>
                                            {selectedDevice.ipAddress || selectedDevice.ip}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm" style={{ color: theme.colors.text.secondary }}>
                                            Status
                                        </label>
                                        <div>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                (selectedDevice.status || '').toLowerCase() === 'online'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {selectedDevice.status || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>
                                    {selectedDevice.currentFirmware && (
                                        <div>
                                            <label className="block text-sm" style={{ color: theme.colors.text.secondary }}>
                                                Current Firmware
                                            </label>
                                            <div style={{ color: theme.colors.text.primary }}>
                                                {selectedDevice.currentFirmware}
                                            </div>
                                        </div>
                                    )}
                                    {selectedDevice.lastSeen && (
                                        <div>
                                            <label className="block text-sm" style={{ color: theme.colors.text.secondary }}>
                                                Last Seen
                                            </label>
                                            <div style={{ color: theme.colors.text.primary }}>
                                                {new Date(selectedDevice.lastSeen).toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="lg:col-span-2">
                        <DeviceList 
                            devices={filteredDevices} 
                            refreshDevices={fetchDevices} 
                            loading={loading}
                            onSelectDevice={handleDeviceSelect}
                            selectedDeviceId={selectedDevice?.id}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// Status Card Component
const StatusCard = ({ title, count, icon, color, onClick, active }) => (
    <button
        onClick={onClick}
        className={`p-4 rounded-lg shadow-md transition-all w-full text-left ${active ? 'ring-2' : ''}`}
        style={{ 
            background: theme.colors.background.surface,
            borderColor: active ? color : 'transparent',
            ringColor: color
        }}
    >
        <div className="flex items-center">
            <div className="mr-4 p-2 rounded-full" style={{ backgroundColor: `${color}20` }}>
                <div style={{ color: color }}>{icon}</div>
            </div>
            <div>
                <h3 className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                    {title}
                </h3>
                <p className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
                    {count}
                </p>
            </div>
        </div>
    </button>
);

export default DeviceConsole;
