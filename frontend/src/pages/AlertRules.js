"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
    RiAlertFill, RiAddLine, RiEditLine, RiDeleteBin7Line, 
    RiCheckLine, RiCloseLine, RiErrorWarningFill 
} from "react-icons/ri";
import { 
    getAllAlertRules, 
    createAlertRule, 
    updateAlertRule, 
    deleteAlertRule,
    evaluateExistingLogs
} from "../services/trafficService";

const AlertRules = () => {
    // State
    const [rules, setRules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRule, setCurrentRule] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evaluationResult, setEvaluationResult] = useState(null);
    
    // Form state
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        condition: "",
        threshold: 1,
        timeWindow: 60,
        severity: "MEDIUM",
        enabled: true
    });

    // Load rules on component mount
    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        try {
            setIsLoading(true);
            const response = await getAllAlertRules();
            if (response.success && Array.isArray(response.rules)) {
                setRules(response.rules);
            } else {
                throw new Error("Invalid response format");
            }
        } catch (err) {
            setError("Failed to load alert rules: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenCreateModal = () => {
        setCurrentRule(null);
        setFormData({
            name: "",
            description: "",
            condition: "",
            threshold: 1,
            timeWindow: 60,
            severity: "MEDIUM",
            enabled: true
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (rule) => {
        setCurrentRule(rule);
        setFormData({
            name: rule.name,
            description: rule.description || "",
            condition: rule.condition,
            threshold: rule.threshold,
            timeWindow: rule.timeWindow,
            severity: rule.severity,
            enabled: rule.enabled
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleOpenDeleteModal = (rule) => {
        setCurrentRule(rule);
        setIsDeleteModalOpen(true);
    };

    const handleCloseDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setCurrentRule(null);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            let response;
            
            if (currentRule) {
                // Update existing rule using _id instead of id for MongoDB documents
                const ruleId = currentRule._id || currentRule.id;
                console.log("Updating rule with ID:", ruleId);
                
                response = await updateAlertRule(ruleId, formData);
                if (response.success) {
                    setRules(prevRules => 
                        prevRules.map(rule => 
                            (rule._id === ruleId || rule.id === ruleId) ? response.rule : rule
                        )
                    );
                }
            } else {
                // Create new rule
                response = await createAlertRule(formData);
                if (response.success) {
                    setRules(prevRules => [...prevRules, response.rule]);
                }
            }
            
            handleCloseModal();
        } catch (err) {
            setError("Failed to save rule: " + err.message);
        }
    };

    const handleDelete = async () => {
        if (!currentRule || !currentRule._id) {
            setError("Cannot delete rule: Missing rule ID");
            handleCloseDeleteModal();
            return;
        }
        
        try {
            // Use _id instead of id for MongoDB documents
            const ruleId = currentRule._id;
            console.log("Deleting rule with ID:", ruleId);
            
            const response = await deleteAlertRule(ruleId);
            if (response.success) {
                setRules(prevRules => 
                    prevRules.filter(rule => rule._id !== ruleId)
                );
                handleCloseDeleteModal();
            } else {
                throw new Error(response.error || "Failed to delete rule");
            }
        } catch (err) {
            setError("Failed to delete rule: " + err.message);
            handleCloseDeleteModal();
        }
    };

    const handleToggleRule = async (rule) => {
        try {
            const updatedRule = { ...rule, enabled: !rule.enabled };
            // Use _id instead of id for MongoDB documents
            const ruleId = rule._id || rule.id;
            console.log("Toggling rule with ID:", ruleId);
            
            const response = await updateAlertRule(ruleId, updatedRule);
            
            if (response.success) {
                setRules(prevRules => 
                    prevRules.map(r => 
                        r._id === ruleId ? response.rule : r
                    )
                );
            }
        } catch (err) {
            setError("Failed to update rule: " + err.message);
        }
    };

    const handleEvaluateRules = async () => {
        try {
            setIsEvaluating(true);
            const response = await evaluateExistingLogs();
            setEvaluationResult(response);
        } catch (err) {
            setError("Failed to evaluate logs: " + err.message);
        } finally {
            setIsEvaluating(false);
        }
    };

    // Helper function to format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    // Helper function to get severity color
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

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <div className="p-6 border-b border-gray-800">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Alert Rules
                            </h1>
                            <p className="text-gray-400">
                                Manage and configure alert rules for traffic monitoring
                            </p>
                        </div>
                        <div className="space-x-4">
                            <button
                                onClick={handleOpenCreateModal}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center"
                            >
                                <RiAddLine className="mr-2" />
                                New Rule
                            </button>
                            <button
                                onClick={handleEvaluateRules}
                                disabled={isEvaluating}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center disabled:bg-gray-700"
                            >
                                <RiErrorWarningFill className="mr-2" />
                                {isEvaluating ? "Evaluating..." : "Evaluate Logs"}
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

                {/* Evaluation result */}
                {evaluationResult && (
                    <div className="bg-green-900/50 border border-green-700 text-white p-4 rounded-lg mb-6">
                        <div className="flex items-center">
                            <RiCheckLine className="text-green-400 mr-2 text-xl" />
                            <span>{evaluationResult.message}</span>
                        </div>
                        <button 
                            onClick={() => setEvaluationResult(null)}
                            className="text-green-400 hover:text-green-300 text-sm mt-2"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Rules Table */}
                <div className="bg-gray-800 rounded-lg overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        ) : rules.length === 0 ? (
                            <div className="text-center p-12 text-gray-500">
                                <p>No alert rules found. Create your first rule to get started.</p>
                                <button 
                                    onClick={handleOpenCreateModal}
                                    className="mt-4 text-blue-500 hover:text-blue-400 underline"
                                >
                                    Create New Rule
                                </button>
                            </div>
                        ) : (
                            <table className="min-w-full">
                                <thead>
                                    <tr>
                                        <th className="px-6 py-3 bg-gray-700 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-3 bg-gray-700 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Condition
                                        </th>
                                        <th className="px-6 py-3 bg-gray-700 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Severity
                                        </th>
                                        <th className="px-6 py-3 bg-gray-700 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Threshold
                                        </th>
                                        <th className="px-6 py-3 bg-gray-700 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 bg-gray-700 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Last Updated
                                        </th>
                                        <th className="px-6 py-3 bg-gray-700 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-gray-800 divide-y divide-gray-700">
                                    {rules.map((rule) => (
                                        <motion.tr 
                                            key={rule._id || rule.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                            className={!rule.enabled ? "opacity-50" : ""}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-white">{rule.name}</div>
                                                <div className="text-xs text-gray-400">{rule.description}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <code className="bg-gray-900 px-2 py-1 rounded text-green-400 text-xs">
                                                    {rule.condition}
                                                </code>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`${getSeverityColor(rule.severity)} font-medium`}>
                                                    {rule.severity}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-white">
                                                    {rule.threshold} in {rule.timeWindow}s
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button 
                                                    onClick={() => handleToggleRule(rule)}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                        rule.enabled 
                                                            ? "bg-green-900/30 text-green-400 hover:bg-green-900/50" 
                                                            : "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                                                    }`}
                                                >
                                                    {rule.enabled ? "Enabled" : "Disabled"}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                                {formatDate(rule.updatedAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleOpenEditModal(rule)}
                                                    className="text-blue-500 hover:text-blue-400 mr-4"
                                                >
                                                    <RiEditLine size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenDeleteModal(rule)}
                                                    className="text-red-500 hover:text-red-400"
                                                >
                                                    <RiDeleteBin7Line size={18} />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Create/Edit Rule Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70">
                    <motion.div 
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gray-800 rounded-lg w-full max-w-2xl mx-4 overflow-hidden shadow-xl"
                    >
                        <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">
                                {currentRule ? "Edit Alert Rule" : "Create Alert Rule"}
                            </h3>
                            <button 
                                onClick={handleCloseModal}
                                className="text-gray-500 hover:text-white"
                            >
                                <RiCloseLine size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        Rule Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Authentication Failure Detection"
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows="2"
                                        placeholder="Detects multiple authentication failures from the same source"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        Condition (Query Syntax)
                                    </label>
                                    <textarea
                                        name="condition"
                                        value={formData.condition}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                        rows="2"
                                        placeholder="source.info:authentication AND source.info:fail"
                                        required
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Use the same syntax as in the search bar. Examples: 
                                        <code className="bg-gray-900 px-1 rounded mx-1">source.srcIp:192.168.1.1</code>
                                        <code className="bg-gray-900 px-1 rounded mx-1">source.info:error</code>
                                    </p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">
                                            Threshold
                                        </label>
                                        <input
                                            type="number"
                                            name="threshold"
                                            value={formData.threshold}
                                            onChange={handleInputChange}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            min="1"
                                            required
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">
                                            Time Window (seconds)
                                        </label>
                                        <input
                                            type="number"
                                            name="timeWindow"
                                            value={formData.timeWindow}
                                            onChange={handleInputChange}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            min="10"
                                            required
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">
                                            Severity
                                        </label>
                                        <select
                                            name="severity"
                                            value={formData.severity}
                                            onChange={handleInputChange}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="HIGH">High</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="LOW">Low</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="enabled"
                                        id="enabled"
                                        checked={formData.enabled}
                                        onChange={handleInputChange}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
                                    />
                                    <label htmlFor="enabled" className="ml-2 text-sm text-gray-400">
                                        Enable this rule
                                    </label>
                                </div>
                            </div>
                            
                            <div className="mt-8 flex justify-end space-x-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    {currentRule ? "Update Rule" : "Create Rule"}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
            
            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gray-800 rounded-lg w-full max-w-md mx-4 overflow-hidden shadow-xl"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-center mb-4 text-red-500">
                                <RiAlertFill size={48} />
                            </div>
                            <h3 className="text-xl font-bold text-white text-center mb-4">
                                Delete Alert Rule
                            </h3>
                            <p className="text-gray-400 text-center mb-6">
                                Are you sure you want to delete the rule "<span className="text-white">{currentRule?.name}</span>"? 
                                This action cannot be undone.
                            </p>
                            <div className="flex justify-center space-x-4">
                                <button
                                    onClick={handleCloseDeleteModal}
                                    className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default AlertRules;