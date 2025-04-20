"use client";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
    RiAlertFill, RiFilter3Line, RiSearchLine, 
    RiCheckboxCircleLine, RiCloseCircleLine, 
    RiErrorWarningFill, RiArrowRightSLine, RiTimeLine,
    RiCheckLine, RiEyeLine, RiFileDownloadLine
} from "react-icons/ri";
import { 
    getAllSystemAlerts, 
    updateAlertStatus,
    getAlertRule
} from "../services/trafficService";
import CSVReportModal from "../components/CSVReportModal";

const AlertOffenses = () => {
    const navigate = useNavigate();
    
    // State
    const [alerts, setAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [statusFilter, setStatusFilter] = useState("NEW");
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [timeRangeFilter, setTimeRangeFilter] = useState("24h");
    const [alertStats, setAlertStats] = useState({
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
        new: 0,
        acknowledged: 0,
        resolved: 0
    });
    const [alertsByDevice, setAlertsByDevice] = useState({});
    
    // Add state for CSV report modal
    const [showReportModal, setShowReportModal] = useState(false);
    
    // Auto-refresh
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [countdown, setCountdown] = useState(30);
    
    // Load alerts on component mount and when filters change
    useEffect(() => {
        loadAlerts();
        
        // Set up polling if auto-refresh is enabled
        let intervalId;
        if (autoRefresh) {
            intervalId = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        loadAlerts();
                        return 30; // Reset countdown
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [statusFilter, severityFilter, timeRangeFilter, autoRefresh]);

    const loadAlerts = async () => {
        try {
            setIsLoading(true);
            
            // Calculate the time range
            let since;
            const now = new Date();
            
            switch (timeRangeFilter) {
                case "1h":
                    since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
                    break;
                case "24h":
                    since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
                    break;
                case "7d":
                    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 0).toISOString();
                    break;
                case "30d":
                    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
                    break;
                default:
                    since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            }
            
            // Prepare filters
            const filters = { since };
            
            if (statusFilter !== "ALL") {
                filters.status = statusFilter;
            }
            
            if (severityFilter !== "ALL") {
                filters.severity = severityFilter;
            }
            
            const response = await getAllSystemAlerts(filters);
            
            if (response.success) {
                setAlerts(response.alerts || []);
                
                // Create alertStats object from the response summary
                // Handle both the old and new API response formats
                if (response.summary) {
                    setAlertStats({
                        total: response.summary.total || response.alerts.length,
                        high: response.summary.bySeverity?.HIGH || 0,
                        medium: response.summary.bySeverity?.MEDIUM || 0,
                        low: response.summary.bySeverity?.LOW || 0,
                        new: response.summary.byStatus?.NEW || 0,
                        acknowledged: response.summary.byStatus?.ACKNOWLEDGED || 0,
                        resolved: response.summary.byStatus?.RESOLVED || 0
                    });
                } else {
                    // Fallback: calculate stats from the alerts array
                    const stats = {
                        total: response.alerts.length,
                        high: 0,
                        medium: 0,
                        low: 0,
                        new: 0,
                        acknowledged: 0,
                        resolved: 0
                    };
                    
                    response.alerts.forEach(alert => {
                        // Count by severity
                        if (alert.severity === "HIGH") stats.high++;
                        else if (alert.severity === "MEDIUM") stats.medium++;
                        else if (alert.severity === "LOW") stats.low++;
                        
                        // Count by status
                        if (alert.status === "NEW") stats.new++;
                        else if (alert.status === "ACKNOWLEDGED") stats.acknowledged++;
                        else if (alert.status === "RESOLVED") stats.resolved++;
                    });
                    
                    setAlertStats(stats);
                }
                
                setAlertsByDevice(response.deviceAlerts || {});
            } else {
                throw new Error("Failed to load alerts");
            }
        } catch (err) {
            setError(`Error loading alerts: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Handle updating alert status
    const handleStatusChange = async (alertId, newStatus) => {
        try {
            setError(null); // Clear any previous errors
            
            // Make sure we're using the MongoDB _id field
            if (!alertId && selectedAlert) {
                alertId = selectedAlert._id;
            }
            
            console.log("Updating alert with ID:", alertId, "to status:", newStatus);
            
            const response = await updateAlertStatus(alertId, newStatus);
            
            if (response.success) {
                // Update the alert in state
                setAlerts(prevAlerts => 
                    prevAlerts.map(alert => 
                        alert._id === alertId  
                            ? { ...alert, status: newStatus } 
                            : alert
                    )
                );
                
                // If the alert is currently selected, update its status in the selection
                if (selectedAlert?._id === alertId) {
                    setSelectedAlert(prevAlert => ({ ...prevAlert, status: newStatus }));
                }
                
                // Update stats
                loadAlerts(); // Reload all alerts to get updated stats
            } else {
                throw new Error(response.error || "Failed to update status");
            }
        } catch (err) {
            setError(`Error updating alert status: ${err.message}`);
            console.error("Error updating alert status:", err);
        }
    };
    
    // Handle alert selection
    const handleViewAlert = async (alert) => {
        try {
            // If it's the same alert currently selected, close it
            if (selectedAlert && selectedAlert._id === alert._id) {
                setSelectedAlert(null);
                return;
            }
            
            // Try to get rule details
            let ruleDetails;
            try {
                const ruleResponse = await getAlertRule(alert.ruleId);
                if (ruleResponse.success) {
                    ruleDetails = ruleResponse.rule;
                }
            } catch (err) {
                console.error("Could not fetch rule details:", err);
                // Continue without rule details if needed
            }
            
            setSelectedAlert({
                ...alert,
                rule: ruleDetails
            });
        } catch (err) {
            setError(`Error loading alert details: ${err.message}`);
        }
    };
    
    // Filter alerts based on search query
    const filteredAlerts = alerts.filter(alert => {
        if (!searchQuery.trim()) return true;
        
        const query = searchQuery.toLowerCase();
        
        return (
            alert.ruleName.toLowerCase().includes(query) ||
            alert.description.toLowerCase().includes(query) ||
            alert.deviceIp.toLowerCase().includes(query) ||
            alert.severity.toLowerCase().includes(query) ||
            alert.status.toLowerCase().includes(query)
        );
    });
    
    // Helper functions
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: true
        });
    };
    
    const getTimeSince = (timestamp) => {
        if (!timestamp) return 'N/A';
        
        try {
            const msPerMinute = 60 * 1000;
            const msPerHour = msPerMinute * 60;
            const msPerDay = msPerHour * 24;
            
            const now = new Date();
            const timestampDate = new Date(timestamp);
            
            // Check if the date is valid
            if (isNaN(timestampDate.getTime())) return 'Invalid date';
            
            const elapsed = now - timestampDate;
            
            if (elapsed < msPerMinute) {
                const seconds = Math.floor(elapsed / 1000);
                return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
            } else if (elapsed < msPerHour) {
                const minutes = Math.floor(elapsed / msPerMinute);
                return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
            } else if (elapsed < msPerDay) {
                const hours = Math.floor(elapsed / msPerHour);
                return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
            } else {
                const days = Math.floor(elapsed / msPerDay);
                return `${days} day${days !== 1 ? 's' : ''} ago`;
            }
        } catch (error) {
            console.error("Error calculating time since:", error);
            return 'N/A';
        }
    };
    
    const getSeverityColor = (severity) => {
        switch (severity) {
            case "HIGH":
                return "text-red-500";
            case "MEDIUM":
                return "text-yellow-500";
            case "LOW":
                return "text-green-500";
            default:
                return "text-gray-500";
        }
    };
    
    const getStatusColor = (status) => {
        switch (status) {
            case "NEW":
                return "text-red-500 bg-red-500/10";
            case "ACKNOWLEDGED":
                return "text-yellow-500 bg-yellow-500/10";
            case "RESOLVED":
                return "text-green-500 bg-green-500/10";
            default:
                return "text-gray-500 bg-gray-500/10";
        }
    };
    
    const getStatusIcon = (status) => {
        switch (status) {
            case "NEW":
                return <RiAlertFill className="mr-1" />;
            case "ACKNOWLEDGED":
                return <RiEyeLine className="mr-1" />;
            case "RESOLVED":
                return <RiCheckLine className="mr-1" />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <div className="p-6 border-b border-gray-800">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Security Offenses
                            </h1>
                            <p className="text-gray-400">
                                Manage and investigate triggered security alerts
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            {/* Add CSV Report Button */}
                            <button 
                                onClick={() => setShowReportModal(true)}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
                            >
                                <RiFileDownloadLine className="mr-2" />
                                CSV Report
                            </button>
                            <div className="bg-gray-800 text-white px-3 py-2 rounded-md flex items-center">
                                <RiTimeLine className="mr-2" />
                                <span>Auto-refresh in: {countdown}s</span>
                                <button 
                                    onClick={() => setAutoRefresh(!autoRefresh)}
                                    className={`ml-3 px-2 py-1 rounded ${
                                        autoRefresh ? 'bg-blue-600' : 'bg-gray-700'
                                    }`}
                                >
                                    {autoRefresh ? 'On' : 'Off'}
                                </button>
                            </div>
                            <button
                                onClick={() => navigate("/alert-rules")}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center"
                            >
                                <RiErrorWarningFill className="mr-2" />
                                Manage Rules
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="max-w-7xl mx-auto p-6">
                {/* Error display */}
                {error && (
                    <div className="bg-red-900/50 border border-red-700 text-white p-4 rounded-lg mb-6">
                        <div className="flex items-center">
                            <RiAlertFill className="text-red-400 mr-2 text-xl" />
                            <span>{error}</span>
                        </div>
                        <button 
                            onClick={() => setError(null)}
                            className="text-red-400 hover:text-red-300 text-sm mt-2"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h3 className="text-lg font-medium text-white mb-4">Offenses by Severity</h3>
                        <div className="flex justify-between items-center">
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                                    <span className="text-white">High</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                                    <span className="text-white">Medium</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                                    <span className="text-white">Low</span>
                                </div>
                            </div>
                            <div className="space-y-2 text-right">
                                <div className="text-red-500 font-medium">{alertStats.high}</div>
                                <div className="text-yellow-500 font-medium">{alertStats.medium}</div>
                                <div className="text-green-500 font-medium">{alertStats.low}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h3 className="text-lg font-medium text-white mb-4">Offenses by Status</h3>
                        <div className="flex justify-between items-center">
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                                    <span className="text-white">New</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                                    <span className="text-white">Acknowledged</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                                    <span className="text-white">Resolved</span>
                                </div>
                            </div>
                            <div className="space-y-2 text-right">
                                <div className="text-red-500 font-medium">{alertStats.new}</div>
                                <div className="text-yellow-500 font-medium">{alertStats.acknowledged}</div>
                                <div className="text-green-500 font-medium">{alertStats.resolved}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h3 className="text-lg font-medium text-white mb-4">Source Distribution</h3>
                        <div className="space-y-3">
                            {Object.entries(alertsByDevice).map(([deviceIp, deviceAlerts], index) => (
                                <div key={`device-${deviceIp}-${index}`} className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                                        <span className="text-white overflow-hidden text-ellipsis">{deviceIp}</span>
                                    </div>
                                    <span className="text-blue-400 font-medium">{deviceAlerts.length}</span>
                                </div>
                            ))}
                            {Object.keys(alertsByDevice).length === 0 && (
                                <div className="text-gray-400 text-center">No device data available</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="mb-6 bg-gray-800 rounded-lg p-4">
                    <div className="flex flex-wrap gap-4 justify-between">
                        <div className="flex flex-wrap gap-4">
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="NEW">New</option>
                                    <option value="ACKNOWLEDGED">Acknowledged</option>
                                    <option value="RESOLVED">Resolved</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Severity</label>
                                <select
                                    value={severityFilter}
                                    onChange={(e) => setSeverityFilter(e.target.value)}
                                    className="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                                >
                                    <option value="ALL">All Severities</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Time Range</label>
                                <select
                                    value={timeRangeFilter}
                                    onChange={(e) => setTimeRangeFilter(e.target.value)}
                                    className="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                                >
                                    <option value="1h">Last Hour</option>
                                    <option value="24h">Last 24 Hours</option>
                                    <option value="7d">Last 7 Days</option>
                                    <option value="30d">Last 30 Days</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex-1 min-w-[300px]">
                            <label className="text-gray-400 text-sm block mb-1">Search</label>
                            <div className="flex bg-gray-700 rounded overflow-hidden border border-gray-600">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search offenses..."
                                    className="bg-transparent border-0 outline-none p-2 flex-1 text-white"
                                />
                                <div className="flex items-center px-3 text-gray-400">
                                    <RiSearchLine />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerts Table */}
                <div className="bg-gray-800 rounded-lg overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-900">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Severity
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Rule Name
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Source IP
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Last Updated
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700 bg-gray-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                                                <span className="ml-2 text-white">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredAlerts.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 whitespace-nowrap text-center text-gray-400">
                                            No offenses match your criteria
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAlerts.map((alert) => (
                                        <motion.tr
                                            key={alert._id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                            className={`hover:bg-gray-700 cursor-pointer ${
                                                selectedAlert?._id === alert._id ? 'bg-gray-700' : ''
                                            }`}
                                            onClick={() => handleViewAlert(alert)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center ${getSeverityColor(alert.severity)}`}>
                                                    <RiAlertFill className="mr-1" />
                                                    {alert.severity}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-white font-medium">{alert.ruleName}</div>
                                                <div className="text-xs text-gray-400 mt-1 max-w-md truncate">
                                                    {alert.description}
                                                </div>
                                                {alert.matchCount > 1 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded text-xs mt-1">
                                                        {alert.matchCount} related events
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-blue-400">
                                                {alert.deviceIp}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
                                                    {getStatusIcon(alert.status)}
                                                    {alert.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                                {getTimeSince(alert.updatedAt || alert.createdAt || alert.timestamp)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <div className="flex justify-end space-x-2">
                                                    {alert.status === "NEW" && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStatusChange(alert._id, "ACKNOWLEDGED");
                                                            }}
                                                            className="text-yellow-500 hover:text-yellow-400"
                                                            title="Acknowledge"
                                                        >
                                                            <RiEyeLine size={18} />
                                                        </button>
                                                    )}
                                                    {(alert.status === "NEW" || alert.status === "ACKNOWLEDGED") && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStatusChange(alert._id, "RESOLVED");
                                                            }}
                                                            className="text-green-500 hover:text-green-400"
                                                            title="Resolve"
                                                        >
                                                            <RiCheckboxCircleLine size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewAlert(alert);
                                                        }}
                                                        className="text-blue-500 hover:text-blue-400"
                                                        title="View Details"
                                                    >
                                                        <RiArrowRightSLine size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {/* Details sidebar */}
            {selectedAlert && (
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed top-0 right-0 h-full w-96 bg-gray-800 shadow-xl p-6 overflow-y-auto z-20"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Offense Details</h3>
                        <button 
                            onClick={() => setSelectedAlert(null)}
                            className="text-gray-400 hover:text-white text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Status Badge */}
                        <div className={`p-3 rounded flex items-center justify-between ${getStatusColor(selectedAlert.status)}`}>
                            <div className="flex items-center">
                                {getStatusIcon(selectedAlert.status)}
                                <span className="font-medium">{selectedAlert.status}</span>
                            </div>
                            
                            <div className="space-x-2">
                                {selectedAlert.status === "NEW" && (
                                    <button
                                        onClick={() => handleStatusChange(selectedAlert._id, "ACKNOWLEDGED")}
                                        className="bg-gray-800/50 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs"
                                    >
                                        Acknowledge
                                    </button>
                                )}
                                {(selectedAlert.status === "NEW" || selectedAlert.status === "ACKNOWLEDGED") && (
                                    <button
                                        onClick={() => handleStatusChange(selectedAlert._id, "RESOLVED")}
                                        className="bg-gray-800/50 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs"
                                    >
                                        Resolve
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* Alert Rule Details */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Rule Information</h4>
                            <div className="bg-gray-700 p-4 rounded">
                                <div className="flex items-center justify-between mb-2">
                                    <div className={`font-medium ${getSeverityColor(selectedAlert.severity)}`}>
                                        {selectedAlert.severity} Severity
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        ID: {selectedAlert.ruleId}
                                    </div>
                                </div>
                                <h3 className="text-lg text-white mb-2">{selectedAlert.ruleName}</h3>
                                <p className="text-sm text-gray-300">{selectedAlert.description}</p>
                            </div>
                        </div>

                        {/* Alert Timing */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Timeline</h4>
                            <div className="bg-gray-700 p-4 rounded">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-xs text-gray-400">Created</span>
                                        <span className="text-sm text-white">{formatTimestamp(selectedAlert.timestamp)}</span>
                                    </div>
                                    {selectedAlert.updatedAt && (
                                        <div className="flex justify-between">
                                            <span className="text-xs text-gray-400">Last Updated</span>
                                            <span className="text-sm text-white">{formatTimestamp(selectedAlert.updatedAt)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Source Information */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Source Information</h4>
                            <div className="bg-gray-700 p-4 rounded">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-xs text-gray-400">Device IP</span>
                                        <span className="text-sm text-blue-400">{selectedAlert.deviceIp}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Matched Logs */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Matched Logs</h4>
                            <div className="bg-gray-700 p-4 rounded">
                                {selectedAlert.matchedLogs && selectedAlert.matchedLogs.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedAlert.matchedLogs.map((log, index) => (
                                            <div key={`log-${index}-${log.timestamp || index}`} className="text-xs text-white border-l-2 border-blue-500 pl-2">
                                                <div className="text-gray-400 mb-1">
                                                    {formatTimestamp(log.timestamp)}
                                                </div>
                                                <div className="bg-gray-800 p-2 rounded">
                                                    {log.source?.info || "No information"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        No log details available
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Rule Condition */}
                        {selectedAlert.rule && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-2">Rule Condition</h4>
                                <div className="bg-gray-700 p-4 rounded">
                                    <code className="text-xs text-green-400 font-mono">
                                        {selectedAlert.rule.condition}
                                    </code>
                                    <div className="mt-2 text-xs text-gray-400">
                                        <span className="text-blue-400">Threshold:</span> {selectedAlert.rule.threshold} events in {selectedAlert.rule.timeWindow} seconds
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-6 flex space-x-3">
                            <button
                                onClick={() => navigate(`/logs?filter=${selectedAlert.deviceIp}`)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
                            >
                                View Traffic Logs
                            </button>
                            <button
                                onClick={() => navigate('/alert-rules')}
                                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded"
                            >
                                Edit Rules
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Add CSV Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
                    <CSVReportModal onClose={() => setShowReportModal(false)} />
                </div>
            )}
        </div>
    );
};

export default AlertOffenses;