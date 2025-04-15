"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { theme } from "../styles/theme";
import { RiAlertFill, RiUser3Fill, RiShieldFill, RiDatabase2Fill, RiSearchLine, RiFilter2Line } from 'react-icons/ri';
import { getDeviceTraffic, getUnifiedTrafficLogs, getNewTrafficLogs } from "../services/trafficService";

const TrafficLogs = ({ unifiedView = false }) => {
    const { ip } = useParams();
    const navigate = useNavigate();
    
    // State
    const [logs, setLogs] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [timeRange, setTimeRange] = useState('1h');
    const [alertLevel, setAlertLevel] = useState('all');
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deviceInfo, setDeviceInfo] = useState({});
    
    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdvancedSearch, setIsAdvancedSearch] = useState(false);
    const [searchHelp, setSearchHelp] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
    const [fieldSuggestions, setFieldSuggestions] = useState([]);
    const [operatorSuggestions, setOperatorSuggestions] = useState([]);
    const [valueSuggestions, setValueSuggestions] = useState([]);
    
    // Refs
    const lastTimestampRef = useRef(null);
    const pollingRef = useRef(null);
    const tableRef = useRef(null);
    const searchInputRef = useRef(null);

    // SIEM Categories and Severity definitions
    const severityLevels = {
        HIGH: { color: '#ff4d4f', label: 'High' },
        MEDIUM: { color: '#faad14', label: 'Medium' },
        LOW: { color: '#52c41a', label: 'Low' }
    };

    // Initial data load
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setIsInitialLoading(true);
                let response;
                
                if (unifiedView) {
                    response = await getUnifiedTrafficLogs();
                } else if (ip) {
                    response = await getDeviceTraffic(ip);
                } else {
                    throw new Error('No view type specified');
                }
                
                if (response?.logs?.length > 0) {
                    // Sort by timestamp, most recent first
                    const sortedLogs = response.logs.sort((a, b) => 
                        new Date(b.timestamp) - new Date(a.timestamp)
                    );
                    
                    setLogs(sortedLogs);
                    
                    // Store the timestamp of the most recent log
                    if (sortedLogs[0]?.timestamp) {
                        lastTimestampRef.current = sortedLogs[0].timestamp;
                    }
                    
                    // Store device info if available
                    if (response.deviceInfo) {
                        setDeviceInfo(response.deviceInfo);
                    }
                }
            } catch (err) {
                console.error("Error fetching logs:", err);
                setError(err.message);
            } finally {
                setIsInitialLoading(false);
            }
        };
        
        fetchInitialData();
        
        // Cleanup function
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, [ip, unifiedView]);

    // Set up polling after initial load
    useEffect(() => {
        if (!isInitialLoading) {
            const pollForNewLogs = async () => {
                try {
                    let response;
                    
                    if (unifiedView) {
                        response = await getUnifiedTrafficLogs(lastTimestampRef.current);
                    } else if (ip) {
                        response = await getNewTrafficLogs(ip, lastTimestampRef.current);
                    }
                    
                    if (response?.logs?.length > 0) {
                        // Update the latest timestamp
                        const sortedNewLogs = response.logs.sort((a, b) => 
                            new Date(b.timestamp) - new Date(a.timestamp)
                        );
                        
                        if (sortedNewLogs[0]?.timestamp) {
                            lastTimestampRef.current = sortedNewLogs[0].timestamp;
                        }
                        
                        // Add new logs to the existing ones, ensuring no duplicates
                        setLogs(prevLogs => {
                            const existingIds = new Set(prevLogs.map(log => log.id || log.timestamp));
                            const uniqueNewLogs = sortedNewLogs.filter(
                                log => !existingIds.has(log.id || log.timestamp)
                            );
                            
                            return [...uniqueNewLogs, ...prevLogs]
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                .slice(0, 500); // Limit to 500 logs to prevent performance issues
                        });
                    }
                } catch (err) {
                    console.error("Error polling for new logs:", err);
                    // Don't set error state here to avoid UI disruption
                }
            };
            
            // Poll every 2 seconds
            pollingRef.current = setInterval(pollForNewLogs, 2000);
            
            return () => {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                }
            };
        }
    }, [isInitialLoading, ip, unifiedView]);

    // Helpers
    const determineSeverity = (log) => {
        const info = (log.source?.info || "").toLowerCase();
        if (info.includes('error') || info.includes('fail') || info.includes('denied')) return 'HIGH';
        if (info.includes('warn') || info.includes('retry')) return 'MEDIUM';
        return 'LOW';
    };

    const determineCategory = (log) => {
        const info = (log.source?.info || "").toLowerCase();
        if (info.includes('auth') || info.includes('login')) return 'AUTHENTICATION';
        if (info.includes('firewall') || info.includes('security')) return 'SECURITY';
        if (info.includes('ping') || info.includes('tcp')) return 'NETWORK';
        if (info.includes('device') || info.includes('iot')) return 'IOT';
        return 'SYSTEM';
    };

    const formatTimestamp = (timestamp) => {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) throw new Error('Invalid date');
            
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch (error) {
            console.error('Error parsing timestamp:', timestamp, error);
            return 'Invalid timestamp';
        }
    };

    // Helper functions for search and filtering
    const parseSearchQuery = (query) => {
        if (!query.trim()) return null;
        
        // Check if it's a simple keyword search
        if (!query.includes(':')) {
            return { type: 'keyword', value: query.toLowerCase() };
        }
        
        // Parse QRadar-like search syntax
        try {
            const parts = query.split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/);
            return parts.map(part => {
                // Skip empty parts
                if (!part.trim()) return null;
                
                // Handle simple AND/OR operators
                if (/^(AND|OR)$/i.test(part)) {
                    return { type: 'operator', value: part.toUpperCase() };
                }
                
                // Handle key:value pairs
                if (part.includes(':')) {
                    const [key, ...valueParts] = part.split(':');
                    let value = valueParts.join(':').trim();
                    
                    // Remove quotes if present
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    
                    // Handle special operators
                    if (value.startsWith('>=')) {
                        return { type: 'filter', field: key.trim(), operator: '>=', value: value.substring(2) };
                    } else if (value.startsWith('<=')) {
                        return { type: 'filter', field: key.trim(), operator: '<=', value: value.substring(2) };
                    } else if (value.startsWith('>')) {
                        return { type: 'filter', field: key.trim(), operator: '>', value: value.substring(1) };
                    } else if (value.startsWith('<')) {
                        return { type: 'filter', field: key.trim(), operator: '<', value: value.substring(1) };
                    } else if (value.startsWith('!')) {
                        return { type: 'filter', field: key.trim(), operator: '!=', value: value.substring(1) };
                    }
                    
                    return { type: 'filter', field: key.trim(), operator: '=', value };
                }
                
                // Default to keyword search
                return { type: 'keyword', value: part.toLowerCase() };
            }).filter(Boolean);
        } catch (e) {
            console.error('Error parsing search query:', e);
            return { type: 'keyword', value: query.toLowerCase() };
        }
    };
    
    const matchSearchQuery = (log, parsedQuery) => {
        if (!parsedQuery) return true;
        
        // Simple keyword search
        if (parsedQuery.type === 'keyword') {
            const jsonString = JSON.stringify(log).toLowerCase();
            return jsonString.includes(parsedQuery.value);
        }
        
        // Advanced search with array of conditions
        if (Array.isArray(parsedQuery)) {
            let result = true;
            let orClause = false;
            let orResult = false;
            
            parsedQuery.forEach((condition, index) => {
                if (condition.type === 'operator') {
                    if (condition.value === 'OR') {
                        orClause = true;
                        orResult = result;
                        result = false;
                    } else if (condition.value === 'AND') {
                        // AND is the default behavior
                    }
                    return;
                }
                
                let conditionResult = false;
                
                if (condition.type === 'keyword') {
                    const jsonString = JSON.stringify(log).toLowerCase();
                    conditionResult = jsonString.includes(condition.value);
                } else if (condition.type === 'filter') {
                    // Handle nested properties using dot notation
                    const fieldPath = condition.field.split('.');
                    let fieldValue = log;
                    
                    for (const prop of fieldPath) {
                        if (fieldValue === null || fieldValue === undefined) {
                            fieldValue = undefined;
                            break;
                        }
                        fieldValue = fieldValue[prop];
                    }
                    
                    if (fieldValue !== undefined) {
                        // Make string comparison case-insensitive
                        const valueA = typeof fieldValue === 'string' ? fieldValue.toLowerCase() : fieldValue;
                        const valueB = typeof condition.value === 'string' ? condition.value.toLowerCase() : condition.value;
                        
                        switch (condition.operator) {
                            case '=':
                                conditionResult = valueA === valueB || 
                                    (typeof valueA === 'string' && valueA.includes(valueB));
                                break;
                            case '!=':
                                conditionResult = valueA !== valueB;
                                break;
                            case '>':
                                conditionResult = valueA > valueB;
                                break;
                            case '>=':
                                conditionResult = valueA >= valueB;
                                break;
                            case '<':
                                conditionResult = valueA < valueB;
                                break;
                            case '<=':
                                conditionResult = valueA <= valueB;
                                break;
                            default:
                                conditionResult = false;
                        }
                    }
                }
                
                if (orClause) {
                    orResult = orResult || conditionResult;
                    
                    // If it's the last condition or next is not an operator, resolve the OR clause
                    if (index === parsedQuery.length - 1 || 
                        parsedQuery[index + 1]?.type !== 'operator') {
                        result = result || orResult;
                        orClause = false;
                    }
                } else {
                    result = result && conditionResult;
                }
            });
            
            return result;
        }
        
        return true;
    };
    
    // Apply filters
    const filteredLogs = logs.filter(log => {
        // First apply severity filter
        if (alertLevel !== 'all' && determineSeverity(log) !== alertLevel) {
            return false;
        }
        
        // Then apply search query if it exists
        if (searchQuery.trim()) {
            return matchSearchQuery(log, parseSearchQuery(searchQuery));
        }
        
        return true;
    });

    // Stats calculations
    const statsData = {
        totalEvents: logs.length,
        criticalAlerts: logs.filter(log => determineSeverity(log) === 'HIGH').length,
        activeDevices: unifiedView 
            ? new Set(logs.map(log => log.deviceIp || (log.source?.srcIp))).size 
            : 1,
        lastActivity: logs[0]?.timestamp ? formatTimestamp(logs[0].timestamp) : 'No activity'
    };

    // UI Components for search help
    const renderSearchHelp = () => (
        <AnimatePresence>
            {searchHelp && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-14 w-96 bg-gray-800 border border-gray-700 rounded-md shadow-lg p-4 z-20"
                >
                    <h4 className="text-white font-bold mb-2">Search Syntax Help</h4>
                    <div className="text-gray-300 text-sm space-y-2">
                        <p>Use simple keywords or QRadar-like search syntax:</p>
                        
                        <div className="bg-gray-700 p-2 rounded">
                            <h5 className="font-semibold">Basic Search:</h5>
                            <code>error</code> - Find logs containing "error"
                        </div>
                        
                        <div className="bg-gray-700 p-2 rounded">
                            <h5 className="font-semibold">Field Search:</h5>
                            <code>source.srcIp:192.168.1.1</code> - Specific IP<br/>
                            <code>source.info:authentication</code> - Info contains "authentication"
                        </div>
                        
                        <div className="bg-gray-700 p-2 rounded">
                            <h5 className="font-semibold">Operators:</h5>
                            <code>severity:HIGH</code> - Equals HIGH<br/>
                            <code>timestamp:{">"}2023-04-15</code> - After date<br/>
                            <code>source.protocol:!TCP</code> - Not TCP
                        </div>
                        
                        <div className="bg-gray-700 p-2 rounded">
                            <h5 className="font-semibold">Combined Search:</h5>
                            <code>source.srcIp:192.168.1.1 AND severity:HIGH</code><br/>
                            <code>source.info:error OR source.info:warning</code>
                        </div>
                    </div>
                    <button 
                        onClick={() => setSearchHelp(false)}
                        className="mt-3 w-full text-center text-sm text-gray-400 hover:text-white"
                    >
                        Close
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );

    // Autocomplete suggestions
    const commonFields = [
        'source.srcIp', 
        'source.dstIp', 
        'source.protocol',
        'source.info',
        'deviceIp',
        'timestamp',
        'severity'
    ];
    
    const operators = [
        ':', ':>', ':<', ':>=', ':<=', ':!'
    ];
    
    const commonValues = {
        'severity': ['HIGH', 'MEDIUM', 'LOW'],
        'source.protocol': ['TCP', 'UDP', 'HTTP', 'HTTPS', 'ICMP'],
        'deviceIp': [...new Set(logs.map(log => log.deviceIp || log.source?.srcIp).filter(Boolean))]
    };
    
    const booleanOperators = ['AND', 'OR'];

    // Helper function to get suggestions based on current input
    const getSuggestions = useCallback(() => {
        if (!searchQuery.trim()) {
            return [];
        }
        
        // Check if we're in the middle of a field:operator:value pattern
        const lastSpaceIndex = searchQuery.lastIndexOf(' ');
        const currentTerm = lastSpaceIndex === -1 
            ? searchQuery 
            : searchQuery.substring(lastSpaceIndex + 1);
        
        // If current term includes a colon, we're looking for values or operators
        if (currentTerm.includes(':')) {
            const [field, value] = currentTerm.split(':');
            
            // If no value yet, suggest operators
            if (!value) {
                return operators.map(op => `${field}${op}`);
            }
            
            // Check if we have value suggestions for this field
            if (commonValues[field]) {
                return commonValues[field]
                    .filter(val => val.toLowerCase().includes(value.toLowerCase()))
                    .map(val => `${field}:${val}`);
            }
            
            // For other fields, suggest based on available data
            const uniqueValues = [...new Set(
                logs
                    .map(log => {
                        // Handle nested fields
                        const parts = field.split('.');
                        let result = log;
                        for (const part of parts) {
                            if (result && typeof result === 'object') {
                                result = result[part];
                            } else {
                                result = undefined;
                                break;
                            }
                        }
                        return result;
                    })
                    .filter(Boolean)
                    .map(val => String(val))
            )];
            
            return uniqueValues
                .filter(val => val.toLowerCase().includes(value.toLowerCase()))
                .map(val => `${field}:${val}`);
        }
        
        // If the term doesn't have a colon yet, suggest fields or boolean operators
        const possibleSuggestions = [
            ...commonFields.map(field => `${field}:`),
            ...booleanOperators
        ];
        
        return possibleSuggestions.filter(suggestion => 
            suggestion.toLowerCase().startsWith(currentTerm.toLowerCase())
        );
    }, [searchQuery, logs]);
    
    // Update suggestions when search query changes
    useEffect(() => {
        const newSuggestions = getSuggestions();
        setSuggestions(newSuggestions);
        setShowSuggestions(newSuggestions.length > 0);
        setSelectedSuggestion(-1);
    }, [searchQuery, getSuggestions]);

    // Handle arrow key navigation and selection of suggestions
    const handleKeyDown = (e) => {
        // If no suggestions or they're not shown, do nothing
        if (!showSuggestions || suggestions.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedSuggestion(prev => 
                prev < suggestions.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedSuggestion(prev => 
                prev > 0 ? prev - 1 : suggestions.length - 1
            );
        } else if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            if (selectedSuggestion >= 0) {
                applySuggestion(suggestions[selectedSuggestion]);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };
    
    // Apply the selected suggestion to the search query
    const applySuggestion = (suggestion) => {
        const lastSpaceIndex = searchQuery.lastIndexOf(' ');
        
        if (lastSpaceIndex === -1) {
            setSearchQuery(suggestion + ' ');
        } else {
            setSearchQuery(
                searchQuery.substring(0, lastSpaceIndex + 1) + suggestion + ' '
            );
        }
        
        setShowSuggestions(false);
        // Focus back on input after selecting
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    };

    // Render autocomplete suggestions
    const renderSuggestions = () => {
        if (!showSuggestions || suggestions.length === 0) return null;
        
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-50 bg-gray-800 w-full border border-gray-700 rounded-b-md mt-1 max-h-60 overflow-y-auto"
            >
                {suggestions.map((suggestion, index) => (
                    <div
                        key={suggestion}
                        className={`p-2 cursor-pointer hover:bg-gray-700 ${
                            index === selectedSuggestion ? 'bg-gray-700' : ''
                        }`}
                        onClick={() => applySuggestion(suggestion)}
                        onMouseEnter={() => setSelectedSuggestion(index)}
                    >
                        <span className="text-blue-400">
                            {suggestion.includes(':') 
                                ? suggestion.split(':')[0] + ':' 
                                : suggestion}
                        </span>
                        <span className="text-white">
                            {suggestion.includes(':') ? suggestion.split(':')[1] : ''}
                        </span>
                    </div>
                ))}
            </motion.div>
        );
    };

    const renderSearchBar = () => (
        <div className="mb-6 relative">
            <div className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <div className="flex-1 flex items-center">
                    <RiSearchLine className="text-gray-400 ml-3" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            if (suggestions.length > 0) {
                                setShowSuggestions(true);
                            }
                        }}
                        placeholder={isAdvancedSearch 
                            ? 'source.srcIp:192.168.1.1 AND severity:HIGH' 
                            : 'Search logs...'}
                        className="bg-transparent border-0 outline-none p-3 w-full text-white"
                    />
                </div>
                <button
                    onClick={() => setIsAdvancedSearch(!isAdvancedSearch)}
                    className={`px-3 flex items-center ${
                        isAdvancedSearch ? 'text-blue-400' : 'text-gray-400'
                    } hover:text-white transition-colors`}
                >
                    <RiFilter2Line />
                    <span className="ml-1 text-sm">Advanced</span>
                </button>
                <button
                    onClick={() => setSearchHelp(!searchHelp)}
                    className="px-3 border-l border-gray-700 text-gray-400 hover:text-white transition-colors"
                >
                    ?
                </button>
            </div>
            {renderSearchHelp()}
            {renderSuggestions()}
        </div>
    );

    // UI Components
    const renderStatsCards = () => (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            <motion.div 
                className="bg-gray-800 p-6 rounded-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-400">Total Events</p>
                        <motion.h3 
                            key={statsData.totalEvents}
                            initial={{ scale: 1.05 }}
                            animate={{ scale: 1 }}
                            className="text-2xl font-bold text-white"
                        >
                            {statsData.totalEvents}
                        </motion.h3>
                    </div>
                    <RiDatabase2Fill className="text-blue-400 text-3xl" />
                </div>
            </motion.div>
            
            <motion.div 
                className="bg-gray-800 p-6 rounded-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-400">Critical Alerts</p>
                        <motion.h3 
                            key={statsData.criticalAlerts}
                            initial={{ scale: 1.05 }}
                            animate={{ scale: 1 }}
                            className="text-2xl font-bold text-red-400"
                        >
                            {statsData.criticalAlerts}
                        </motion.h3>
                    </div>
                    <RiAlertFill className="text-red-400 text-3xl" />
                </div>
            </motion.div>

            <motion.div 
                className="bg-gray-800 p-6 rounded-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-400">
                            {unifiedView ? 'Active Devices' : 'Connection Status'}
                        </p>
                        <motion.h3 
                            key={unifiedView ? statsData.activeDevices : (deviceInfo.status || 'Unknown')}
                            initial={{ scale: 1.05 }}
                            animate={{ scale: 1 }}
                            className={`text-2xl font-bold ${unifiedView ? 'text-green-400' : 
                                deviceInfo.status === 'Online' ? 'text-green-400' : 'text-yellow-400'}`}
                        >
                            {unifiedView ? statsData.activeDevices : (deviceInfo.status || 'Unknown')}
                        </motion.h3>
                    </div>
                    <RiUser3Fill className="text-green-400 text-3xl" />
                </div>
            </motion.div>

            <motion.div 
                className="bg-gray-800 p-6 rounded-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-400">Last Activity</p>
                        <h3 className="text-2xl font-bold text-purple-400 truncate max-w-[180px]">
                            {statsData.lastActivity}
                        </h3>
                    </div>
                    <RiShieldFill className="text-purple-400 text-3xl" />
                </div>
            </motion.div>
        </div>
    );

    const renderLogsTable = () => (
        <div 
            ref={tableRef}
            className="overflow-y-auto max-h-[calc(100vh-320px)] rounded-lg bg-gray-800"
        >
            <table className="min-w-full">
                <thead className="sticky top-0 bg-gray-800 z-10">
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="p-3">Time</th>
                        {unifiedView && <th className="p-3">Device IP</th>}
                        <th className="p-3">Category</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Event</th>
                        <th className="p-3">Severity</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLogs.length > 0 ? filteredLogs.map((log, index) => (
                        <tr
                            key={`${log.timestamp}-${index}`}
                            className="border-t border-gray-700 hover:bg-gray-700 cursor-pointer"
                            onClick={() => setSelectedEvent(log)}
                        >
                            <td className="p-3 text-sm text-gray-300">
                                {formatTimestamp(log.timestamp)}
                            </td>
                            {unifiedView && (
                                <td className="p-3 text-sm text-blue-400">
                                    {log.deviceIp || log.source?.srcIp || 'Unknown'}
                                </td>
                            )}
                            <td className="p-3 text-sm text-gray-300">
                                {determineCategory(log)}
                            </td>
                            <td className="p-3 text-sm text-gray-300">
                                {log.source?.srcIp || 'Unknown'}
                            </td>
                            <td className="p-3 text-sm text-gray-300 truncate max-w-[300px]">
                                {log.source?.info || 'No information'}
                            </td>
                            <td className="p-3">
                                <span className="px-2 py-1 rounded text-xs"
                                    style={{
                                        backgroundColor: `${severityLevels[determineSeverity(log)].color}20`,
                                        color: severityLevels[determineSeverity(log)].color
                                    }}>
                                    {severityLevels[determineSeverity(log)].label}
                                </span>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={unifiedView ? 6 : 5} className="p-4 text-center text-gray-500">
                                No logs found matching your filters
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderEventDetails = () => (
        <AnimatePresence>
            {selectedEvent && (
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed top-0 right-0 h-full w-96 bg-gray-800 shadow-xl p-6 overflow-y-auto z-20"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Event Details</h3>
                        <button 
                            onClick={() => setSelectedEvent(null)}
                            className="text-gray-400 hover:text-white text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Event Summary</h4>
                            <div className="bg-gray-700 p-4 rounded">
                                <p className="text-sm text-white">{selectedEvent.source?.info || 'No information'}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {formatTimestamp(selectedEvent.timestamp)}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Source Details</h4>
                            <div className="bg-gray-700 p-4 rounded">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-400">Source IP</p>
                                        <p className="text-sm text-white">{selectedEvent.source?.srcIp || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">Destination IP</p>
                                        <p className="text-sm text-white">{selectedEvent.source?.dstIp || 'Unknown'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Protocol Details</h4>
                            <div className="bg-gray-700 p-4 rounded">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-400">Protocol</p>
                                        <p className="text-sm text-white">{selectedEvent.source?.protocol || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">Category</p>
                                        <p className="text-sm text-white">{determineCategory(selectedEvent)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Raw Data</h4>
                            <div className="bg-gray-700 p-4 rounded">
                                <pre className="text-xs text-white whitespace-pre-wrap overflow-auto max-h-[200px]">
                                    {JSON.stringify(selectedEvent, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-red-500 text-xl mb-2">Error</h2>
                    <p className="text-white">{error}</p>
                    <button 
                        onClick={() => navigate(-1)} 
                        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: theme.colors.background.primary }}>
            {/* Header */}
            <div className="p-6 border-b border-gray-800">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                {unifiedView ? 'Network Traffic Logs' : 'Device Traffic Analysis'}
                            </h1>
                            {!unifiedView && ip && (
                                <p className="text-gray-400">
                                    Monitoring Device: <span className="text-blue-400">{ip}</span>
                                </p>
                            )}
                        </div>
                        <div className="flex space-x-4">
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                                className="bg-gray-800 text-white px-4 py-2 rounded border border-gray-700"
                            >
                                <option value="1h">Last Hour</option>
                                <option value="24h">Last 24 Hours</option>
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="max-w-7xl mx-auto p-6">
                {/* Initial loading placeholder */}
                {isInitialLoading ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-gray-800 p-6 rounded-lg animate-pulse">
                                    <div className="h-4 bg-gray-700 rounded w-2/3 mb-4"></div>
                                    <div className="h-8 bg-gray-700 rounded w-1/3"></div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="bg-gray-800 p-6 rounded-lg animate-pulse">
                            <div className="h-6 bg-gray-700 rounded w-1/4 mb-6"></div>
                            <div className="space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-10 bg-gray-700 rounded"></div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {renderStatsCards()}
                        
                        {/* Add Search Bar */}
                        {renderSearchBar()}
                        
                        <div className="bg-gray-800 rounded-lg p-6 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white">Live Traffic Logs</h3>
                                <div className="flex space-x-4">
                                    <select 
                                        value={alertLevel} 
                                        onChange={(e) => setAlertLevel(e.target.value)}
                                        className="bg-gray-700 text-white rounded px-3 py-1 border border-gray-600"
                                    >
                                        <option value="all">All Severities</option>
                                        {Object.entries(severityLevels).map(([key, value]) => (
                                            <option key={key} value={key}>{value.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {renderLogsTable()}
                            {filteredLogs.length === 0 && !isInitialLoading && (
                                <div className="text-center py-8 text-gray-400">
                                    <p>No logs match your search criteria</p>
                                    {searchQuery && (
                                        <button 
                                            onClick={() => setSearchQuery('')}
                                            className="mt-2 text-blue-400 hover:underline"
                                        >
                                            Clear search
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
            
            {/* Event details sidebar */}
            {renderEventDetails()}
        </div>
    );
};

export default TrafficLogs;