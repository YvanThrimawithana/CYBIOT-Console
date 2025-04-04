"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getTrafficLogs } from "../services/LogService";
import { theme } from "../styles/theme";
import { 
    BarChart,
    LineChart 
} from "../components/Charts";

const TrafficLogs = () => {
    const { ip } = useParams();
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [filterText, setFilterText] = useState("");
    const [view, setView] = useState('table'); // 'table' or 'analytics'
    const [timeRange, setTimeRange] = useState('1h');

    useEffect(() => {
        if (!ip) {
            setError("No IP address provided");
            setLoading(false);
            return;
        }

        const fetchLogs = async () => {
            try {
                setLoading(true);
                const response = await getTrafficLogs(ip);
                if (response && response.logs) {
                    setLogs(response.logs);
                } else {
                    setLogs([]);
                }
            } catch (err) {
                setError(err.message || "Failed to fetch logs");
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [ip]);

    const filteredLogs = logs.filter(log => 
        JSON.stringify(log).toLowerCase().includes(filterText.toLowerCase())
    );

    const getProtocolColor = (source) => {
        // Add different colors based on protocol/source type
        if (source.protocol === 'TCP') return 'text-blue-400';
        if (source.protocol === 'UDP') return 'text-green-400';
        if (source.protocol === 'ICMP') return 'text-yellow-400';
        return 'text-white';
    };

    const stats = useMemo(() => {
        if (!logs.length) return null;
        return {
            totalPackets: logs.length,
            protocols: logs.reduce((acc, log) => {
                acc[log.source.protocol] = (acc[log.source.protocol] || 0) + 1;
                return acc;
            }, {}),
            totalBytes: logs.reduce((acc, log) => acc + log.raw.length, 0)
        };
    }, [logs]);

    if (!ip) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <p className="text-red-500">Error: No IP address provided</p>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen"
            style={{ backgroundColor: theme.colors.background.primary }}
        >
            {/* Header Section */}
            <div className="p-6 border-b border-gray-800">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Network Traffic Analysis
                            </h1>
                            <p className="text-gray-400">
                                Monitoring IP: <span className="text-blue-400">{ip}</span>
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                                className="bg-gray-800 text-white px-4 py-2 rounded-lg"
                            >
                                <option value="1h">Last Hour</option>
                                <option value="24h">Last 24 Hours</option>
                                <option value="7d">Last 7 Days</option>
                            </select>
                            <div className="flex rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setView('table')}
                                    className={`px-4 py-2 ${view === 'table' ? 
                                        'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                                >
                                    Table View
                                </button>
                                <button
                                    onClick={() => setView('analytics')}
                                    className={`px-4 py-2 ${view === 'analytics' ? 
                                        'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                                >
                                    Analytics
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-gray-800 rounded-lg p-6"
                    >
                        <h3 className="text-gray-400 mb-2">Total Packets</h3>
                        <p className="text-3xl font-bold text-blue-400">
                            {stats.totalPackets.toLocaleString()}
                        </p>
                    </motion.div>
                    {/* Add more stat cards... */}
                </div>
            )}

            {/* Main Content */}
            <div className="max-w-7xl mx-auto p-6">
                <AnimatePresence mode="wait">
                    {view === 'table' ? (
                        <motion.div
                            key="table"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-gray-800 rounded-lg shadow-xl"
                        >
                            {/* Your existing table code with enhanced styling */}
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold text-blue-400">Network Traffic Analysis - {ip}</h2>
                                <div className="flex space-x-4">
                                    <input
                                        type="text"
                                        placeholder="Filter packets..."
                                        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                                        value={filterText}
                                        onChange={(e) => setFilterText(e.target.value)}
                                    />
                                    <button 
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md"
                                        onClick={() => setLogs([])} // Clear logs
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Main content area */}
                            <div className="grid grid-cols-1 gap-4">
                                {/* Packet List */}
                                <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                                    {loading ? (
                                        <p className="p-4 text-gray-400">Loading packets...</p>
                                    ) : error ? (
                                        <p className="p-4 text-red-500">Error: {error}</p>
                                    ) : filteredLogs.length === 0 ? (
                                        <p className="p-4 text-gray-400">No packets captured</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full">
                                                <thead>
                                                    <tr className="bg-gray-700 text-left">
                                                        <th className="p-3 text-xs font-semibold">No.</th>
                                                        <th className="p-3 text-xs font-semibold">Time</th>
                                                        <th className="p-3 text-xs font-semibold">Source</th>
                                                        <th className="p-3 text-xs font-semibold">Destination</th>
                                                        <th className="p-3 text-xs font-semibold">Protocol</th>
                                                        <th className="p-3 text-xs font-semibold">Length</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredLogs.map((log, index) => (
                                                        <tr 
                                                            key={index}
                                                            className={`border-t border-gray-700 hover:bg-gray-700 cursor-pointer ${
                                                                selectedLog === index ? 'bg-gray-700' : ''
                                                            }`}
                                                            onClick={() => setSelectedLog(index)}
                                                        >
                                                            <td className="p-3 text-sm">{index + 1}</td>
                                                            <td className="p-3 text-sm">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                                            <td className="p-3 text-sm">{log.source.address}</td>
                                                            <td className="p-3 text-sm">{log.source.destination}</td>
                                                            <td className={`p-3 text-sm ${getProtocolColor(log.source)}`}>
                                                                {log.source.protocol}
                                                            </td>
                                                            <td className="p-3 text-sm">{log.raw.length} bytes</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Packet Details */}
                                {selectedLog !== null && (
                                    <div className="bg-gray-800 rounded-lg shadow-md p-4">
                                        <h3 className="text-lg font-semibold text-blue-400 mb-3">Packet Details</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-semibold text-gray-400">Frame Information</h4>
                                                <div className="bg-gray-700 p-3 rounded">
                                                    <p className="text-sm">Arrival Time: {new Date(filteredLogs[selectedLog].timestamp).toLocaleString()}</p>
                                                    <p className="text-sm">Frame Length: {filteredLogs[selectedLog].raw.length} bytes</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-semibold text-gray-400">Source Information</h4>
                                                <div className="bg-gray-700 p-3 rounded">
                                                    <p className="text-sm">Address: {filteredLogs[selectedLog].source.address}</p>
                                                    <p className="text-sm">Protocol: {filteredLogs[selectedLog].source.protocol}</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Raw Packet Data */}
                                        <div className="mt-4">
                                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Raw Packet Data</h4>
                                            <div className="bg-gray-700 p-3 rounded overflow-x-auto">
                                                <pre className="text-xs font-mono whitespace-pre-wrap">
                                                    {filteredLogs[selectedLog].raw}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="analytics"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >
                            <div className="bg-gray-800 rounded-lg p-6">
                                <h3 className="text-xl font-bold text-white mb-4">
                                    Protocol Distribution
                                </h3>
                                <BarChart data={stats.protocols} />
                            </div>
                            <div className="bg-gray-800 rounded-lg p-6">
                                <h3 className="text-xl font-bold text-white mb-4">
                                    Traffic Over Time
                                </h3>
                                <LineChart data={logs} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Packet Details Drawer */}
            <AnimatePresence>
                {selectedLog !== null && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        className="fixed top-0 right-0 h-full w-96 bg-gray-800 shadow-xl"
                    >
                        {/* Your existing packet details code with enhanced styling */}
                        <div className="bg-gray-800 rounded-lg shadow-md p-4">
                            <h3 className="text-lg font-semibold text-blue-400 mb-3">Packet Details</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-gray-400">Frame Information</h4>
                                    <div className="bg-gray-700 p-3 rounded">
                                        <p className="text-sm">Arrival Time: {new Date(filteredLogs[selectedLog].timestamp).toLocaleString()}</p>
                                        <p className="text-sm">Frame Length: {filteredLogs[selectedLog].raw.length} bytes</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-gray-400">Source Information</h4>
                                    <div className="bg-gray-700 p-3 rounded">
                                        <p className="text-sm">Address: {filteredLogs[selectedLog].source.address}</p>
                                        <p className="text-sm">Protocol: {filteredLogs[selectedLog].source.protocol}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Raw Packet Data */}
                            <div className="mt-4">
                                <h4 className="text-sm font-semibold text-gray-400 mb-2">Raw Packet Data</h4>
                                <div className="bg-gray-700 p-3 rounded overflow-x-auto">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">
                                        {filteredLogs[selectedLog].raw}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default TrafficLogs;