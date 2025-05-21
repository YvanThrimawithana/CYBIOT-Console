import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getFirmwareById, sendFirmwareReport } from '../services/firmwareService';
import FirmwareMetrics from '../components/FirmwareMetrics';
import FirmwareEmailModal from '../components/FirmwareEmailModal';
import { theme } from '../styles/theme';
import { MdEmail, MdSecurity, MdCode, MdDataObject } from 'react-icons/md';

const FirmwareProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [error, setError] = useState(null);
    const [emailModalOpen, setEmailModalOpen] = useState(false);

    // API call to fetch firmware details
    const { data: firmware, isLoading } = useQuery({
        queryKey: ['firmware', id],
        queryFn: () => getFirmwareById(id),
        refetchInterval: (data) => data?.status === 'analyzing' ? 3000 : false,
        retry: 1,
        onError: (error) => {
            console.error('Error fetching firmware:', error);
            setError(error.message);
            if (error.response?.status === 401) {
                navigate('/login');
            }
        }
    });

    // Mutation for sending email report
    const { mutate: sendReport, isLoading: isSending, error: sendError, isSuccess: sendSuccess } = useMutation({
        mutationFn: ({ email, reportFormat }) => sendFirmwareReport(id, email, reportFormat),
        onError: (error) => {
            console.error('Error sending report:', error);
        }
    });

    if (error) {
        return (
            <div className="p-8" style={{ background: theme.colors.background.main }}>
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        <p>Error loading firmware details: {error}</p>
                        <button 
                            onClick={() => navigate('/firmware-management')}
                            className="mt-2 text-sm underline"
                        >
                            Return to Firmware Management
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        if (!firmware?.analysis) return null;

        switch (activeTab) {
            case 'overview':
                return <FirmwareMetrics analysisResults={firmware.analysis} />;            case 'vulnerabilities':
                return (
                    <div className="space-y-4">
                        {/* First show a dedicated section for critical (HIGH) vulnerabilities */}
                        {(() => {
                            // Collect all HIGH severity issues across categories
                            const criticalIssues = [];
                            Object.entries(firmware.analysis.static).forEach(([category, issues]) => {
                                if (Array.isArray(issues)) {
                                    issues.filter(issue => issue.severity === 'HIGH').forEach(issue => {
                                        criticalIssues.push({
                                            ...issue,
                                            category: category.replace(/_/g, ' ')
                                        });
                                    });
                                }
                            });
                            
                            if (criticalIssues.length > 0) {
                                return (
                                    <div className="p-4 rounded-lg mb-6 border" 
                                        style={{ 
                                            background: `${theme.colors.status.error}10`,
                                            borderColor: `${theme.colors.status.error}30`
                                        }}>                                        <h3 className="text-xl font-bold mb-3 flex items-center" 
                                            style={{ color: theme.colors.status.error }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
                                                className="w-6 h-6 mr-2">
                                                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003z" clipRule="evenodd" />
                                            </svg>
                                            <span className="uppercase tracking-wider">Critical Security Vulnerabilities</span>
                                            <span className="text-sm ml-2 px-3 py-1 rounded-full font-bold" 
                                                style={{ 
                                                    backgroundColor: theme.colors.status.error,
                                                    color: 'white'
                                                }}>
                                                {criticalIssues.length}
                                            </span>
                                        </h3>
                                        <div className="space-y-3">
                                            {criticalIssues.map((issue, idx) => (
                                                <div key={idx} className="p-3 rounded" 
                                                    style={{ 
                                                        backgroundColor: theme.colors.background.main,
                                                        borderLeft: `4px solid ${theme.colors.status.error}`
                                                    }}>
                                                    <div className="flex items-start justify-between">
                                                        <div className="font-medium" style={{ color: theme.colors.status.error }}>
                                                            {issue.match}
                                                        </div>
                                                        <div className="text-sm px-2 py-1 rounded" style={{
                                                            backgroundColor: `${theme.colors.status.error}20`,
                                                            color: theme.colors.status.error
                                                        }}>
                                                            {issue.category}
                                                        </div>
                                                    </div>
                                                    <div className="mt-1 text-sm" style={{ color: theme.colors.text.secondary }}>
                                                        File: {issue.file}, Line: {issue.line}
                                                    </div>                                                    <div className="mt-2 text-sm p-3 rounded flex items-start" style={{ 
                                                        backgroundColor: `${theme.colors.status.error}15`,
                                                        borderLeft: `3px solid ${theme.colors.status.error}`
                                                    }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
                                                            className="w-5 h-5 mr-2 flex-shrink-0" style={{ color: theme.colors.status.error }}>
                                                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                                        </svg>
                                                        <div>
                                                            <strong className="font-bold block" style={{ color: theme.colors.status.error }}>Critical Security Risk:</strong>
                                                            <span style={{ color: theme.colors.text.secondary }}>This vulnerability requires immediate attention and remediation. It may expose your system to significant security risks.</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                        
                        {/* Then show all vulnerabilities by category as before */}
                        {Object.entries(firmware.analysis.static).map(([category, issues]) => (
                            issues?.length > 0 && (
                                <div key={category} className="p-4 rounded-lg" 
                                    style={{ background: theme.colors.background.card }}>
                                    <h3 className="text-xl font-medium mb-3 capitalize" 
                                        style={{ color: theme.colors.text.primary }}>
                                        {category.replace(/_/g, ' ')}
                                        <span className="text-sm ml-2 px-2 py-1 rounded" 
                                            style={{ 
                                                backgroundColor: theme.colors.status.warning + '20',
                                                color: theme.colors.status.warning
                                            }}>
                                            {issues.length} issues
                                        </span>
                                    </h3>
                                    <div className="space-y-3">
                                        {issues.map((issue, idx) => (
                                            <div key={idx} className="p-3 rounded" 
                                                style={{ 
                                                    backgroundColor: theme.colors.background.main,
                                                    borderLeft: `4px solid ${
                                                        issue.severity === 'HIGH' ? theme.colors.status.error :
                                                        issue.severity === 'MEDIUM' ? theme.colors.status.warning :
                                                        theme.colors.status.success
                                                    }`
                                                }}>
                                                <div className="flex items-start justify-between">
                                                    <div className="font-medium" style={{ 
                                                        color: issue.severity === 'HIGH' ? theme.colors.status.error : theme.colors.text.primary
                                                    }}>
                                                        {issue.match}
                                                    </div>
                                                    <div className="text-sm px-2 py-1 rounded" style={{
                                                        backgroundColor: `${
                                                            issue.severity === 'HIGH' ? theme.colors.status.error :
                                                            issue.severity === 'MEDIUM' ? theme.colors.status.warning :
                                                            theme.colors.status.success
                                                        }20`,
                                                        color: issue.severity === 'HIGH' ? theme.colors.status.error :
                                                              issue.severity === 'MEDIUM' ? theme.colors.status.warning :
                                                              theme.colors.status.success
                                                    }}>
                                                        {issue.severity}
                                                    </div>
                                                </div>
                                                <div className="mt-1 text-sm" style={{ color: theme.colors.text.secondary }}>
                                                    File: {issue.file}, Line: {issue.line}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                );
            case 'raw':
                return (
                    <motion.pre 
                        className="p-4 rounded-lg overflow-auto max-h-[70vh]"
                        style={{ background: theme.colors.background.card }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <code style={{ color: theme.colors.text.primary }}>
                            {JSON.stringify(firmware.analysis, null, 2)}
                        </code>
                    </motion.pre>
                );
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="p-8" style={{ background: theme.colors.background.main }}>
                <div className="max-w-7xl mx-auto">
                    <div className="animate-pulse">
                        <div className="h-8 w-1/3 bg-gray-300 rounded mb-6"></div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1">
                                <div className="rounded-lg h-64 bg-gray-300"></div>
                            </div>
                            <div className="lg:col-span-2">
                                <div className="rounded-lg h-64 bg-gray-300"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8" style={{ background: theme.colors.background.main }}>
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <button 
                            onClick={() => navigate(-1)}
                            className="mr-4 hover:opacity-80 transition-opacity"
                            style={{ color: theme.colors.primary.main }}
                        >
                            ← Back
                        </button>
                        <h1 className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
                            {firmware?.name}
                        </h1>
                    </div>

                    {firmware?.status === 'analyzed' && firmware?.analysis && (
                        <button
                            onClick={() => setEmailModalOpen(true)}
                            className="px-4 py-2 rounded flex items-center hover:opacity-80 transition-opacity"
                            style={{ 
                                background: theme.colors.primary.main,
                                color: 'white'
                            }}
                        >
                            <MdEmail className="mr-2" />
                            Email Report
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <div className="rounded-lg shadow-lg p-6" style={{ background: theme.colors.background.surface }}>
                            <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                                Firmware Details
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-center p-3 rounded" style={{ background: theme.colors.background.card }}>
                                    <div className="w-10 h-10 flex items-center justify-center rounded-full mr-3" 
                                        style={{ background: `${theme.colors.primary.main}20`, color: theme.colors.primary.main }}>
                                        <MdCode size={20} />
                                    </div>
                                    <div>
                                        <label className="text-sm block" style={{ color: theme.colors.text.secondary }}>Version</label>
                                        <div style={{ color: theme.colors.text.primary }}>{firmware?.version}</div>
                                    </div>
                                </div>
                                <div className="flex items-center p-3 rounded" style={{ background: theme.colors.background.card }}>
                                    <div className="w-10 h-10 flex items-center justify-center rounded-full mr-3" 
                                        style={{ background: `${theme.colors.primary.main}20`, color: theme.colors.primary.main }}>
                                        <MdDataObject size={20} />
                                    </div>
                                    <div>
                                        <label className="text-sm block" style={{ color: theme.colors.text.secondary }}>Device Type</label>
                                        <div style={{ color: theme.colors.text.primary }}>{firmware?.deviceType}</div>
                                    </div>
                                </div>
                                <div className="flex items-center p-3 rounded" style={{ background: theme.colors.background.card }}>
                                    <div className="w-10 h-10 flex items-center justify-center rounded-full mr-3" 
                                        style={{ background: `${theme.colors.primary.main}20`, color: theme.colors.primary.main }}>
                                        <MdSecurity size={20} />
                                    </div>
                                    <div>
                                        <label className="text-sm block" style={{ color: theme.colors.text.secondary }}>Status</label>
                                        <div className="mt-1">
                                            <span className="px-2 py-1 rounded text-sm" style={{
                                                backgroundColor: firmware?.status === 'analyzed' 
                                                    ? `${theme.colors.status.success}20`
                                                    : `${theme.colors.status.warning}20`,
                                                color: firmware?.status === 'analyzed'
                                                    ? theme.colors.status.success
                                                    : theme.colors.status.warning
                                            }}>
                                                {firmware?.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 rounded" style={{ background: theme.colors.background.card }}>
                                    <label className="text-sm block" style={{ color: theme.colors.text.secondary }}>Upload Date</label>
                                    <div style={{ color: theme.colors.text.primary }}>
                                        {new Date(firmware?.uploadDate).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </div>
                                </div>
                                {firmware?.securityScore !== undefined && (
                                    <div className="p-3 rounded" style={{ background: theme.colors.background.card }}>
                                        <label className="text-sm block" style={{ color: theme.colors.text.secondary }}>Security Score</label>
                                        <div className="text-2xl font-bold" style={{ 
                                            color: firmware?.securityScore > 7 ? theme.colors.status.success : 
                                                   firmware?.securityScore > 4 ? theme.colors.status.warning :
                                                   theme.colors.status.error
                                        }}>
                                            {firmware?.securityScore}/10
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="rounded-lg shadow-lg p-6" style={{ background: theme.colors.background.surface }}>
                            <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                                Analysis Results
                            </h2>                            {firmware?.status === 'analyzed' && firmware?.analysis ? (
                                <div>
                                    {/* Display critical vulnerability alert if any exist */}
                                    {(() => {
                                        // Count critical vulnerabilities
                                        let criticalCount = 0;
                                        Object.values(firmware.analysis.static || {}).forEach(issues => {
                                            if (Array.isArray(issues)) {
                                                criticalCount += issues.filter(issue => issue.severity === 'HIGH').length;
                                            }
                                        });
                                        
                                        if (criticalCount > 0) {
                                            return (
                                                <div 
                                                    className="mb-6 p-4 rounded-lg border-l-4 flex items-center" 
                                                    style={{ 
                                                        backgroundColor: `${theme.colors.status.error}10`,
                                                        borderColor: theme.colors.status.error
                                                    }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
                                                        className="w-6 h-6 mr-3" style={{ color: theme.colors.status.error }}>
                                                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003z" clipRule="evenodd" />
                                                        <path d="M12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                                                    </svg>
                                                    
                                                    <div>
                                                        <div className="font-semibold" style={{ color: theme.colors.status.error }}>
                                                            {criticalCount} Critical {criticalCount === 1 ? 'Vulnerability' : 'Vulnerabilities'} Detected!
                                                        </div>
                                                        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                                                            Click the "Vulnerabilities" tab to see details and recommendations
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => setActiveTab('vulnerabilities')}
                                                        className="ml-auto px-3 py-1 rounded text-white text-sm"
                                                        style={{ backgroundColor: theme.colors.status.error }}
                                                    >
                                                        View Details
                                                    </button>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    
                                    <div className="flex space-x-1 mb-6 border-b" 
                                        style={{ borderColor: theme.colors.background.card }}>
                                        {[
                                            { id: 'overview', label: 'Overview', icon: <MdSecurity className="mr-1" /> },
                                            { id: 'vulnerabilities', label: 'Vulnerabilities', icon: <MdCode className="mr-1" /> },
                                            { id: 'raw', label: 'Raw JSON', icon: <MdDataObject className="mr-1" /> }
                                        ].map((tab) => (
                                            <motion.button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`px-4 py-2 -mb-px capitalize flex items-center ${activeTab === tab.id ? 'border-b-2' : ''}`}
                                                style={{ 
                                                    color: activeTab === tab.id ? theme.colors.primary.main : theme.colors.text.secondary,
                                                    borderColor: theme.colors.primary.main
                                                }}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                {tab.icon}
                                                {tab.label}
                                            </motion.button>
                                        ))}
                                    </div>
                                    <motion.div
                                        key={activeTab}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {renderContent()}
                                    </motion.div>
                                </div>
                            ) : (
                                <div style={{ color: theme.colors.text.secondary }} className="p-8 text-center">
                                    <MdSecurity size={48} className="mx-auto mb-4 opacity-50" />
                                    <p className="text-lg">No analysis results available.</p>
                                    <p className="mt-2">Analysis may still be in progress or has not been started.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <FirmwareEmailModal
                show={emailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                onSubmit={sendReport}
                isLoading={isSending}
                error={sendError}
                success={sendSuccess}
                firmware={firmware}
            />
        </div>
    );
};

export default FirmwareProfile;
