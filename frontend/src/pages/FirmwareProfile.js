import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getFirmwareById } from '../services/firmwareService';
import FirmwareMetrics from '../components/FirmwareMetrics';
import { theme } from '../styles/theme';

const FirmwareProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [error, setError] = useState(null);

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
                return <FirmwareMetrics analysisResults={firmware.analysis} />;
            case 'vulnerabilities':
                return (
                    <div className="space-y-4">
                        {Object.entries(firmware.analysis.static).map(([category, issues]) => (
                            issues?.length > 0 && (
                                <div key={category} className="p-4 rounded-lg" 
                                    style={{ background: theme.colors.background.card }}>
                                    {/* ...existing vulnerability display code... */}
                                </div>
                            )
                        ))}
                    </div>
                );
            case 'raw':
                return (
                    <pre className="p-4 rounded-lg overflow-auto"
                        style={{ background: theme.colors.background.card }}>
                        {JSON.stringify(firmware.analysis, null, 2)}
                    </pre>
                );
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="p-8" style={{ background: theme.colors.background.main }}>
                <div className="max-w-7xl mx-auto">
                    Loading firmware details...
                </div>
            </div>
        );
    }

    return (
        <div className="p-8" style={{ background: theme.colors.background.main }}>
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center mb-6">
                    <button 
                        onClick={() => navigate(-1)}
                        className="mr-4"
                        style={{ color: theme.colors.primary.main }}
                    >
                        ← Back
                    </button>
                    <h1 className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
                        {firmware?.name}
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <div className="rounded-lg shadow-lg p-6" style={{ background: theme.colors.background.surface }}>
                            <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                                Firmware Details
                            </h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm" style={{ color: theme.colors.text.secondary }}>Version</label>
                                    <div style={{ color: theme.colors.text.primary }}>{firmware?.version}</div>
                                </div>
                                <div>
                                    <label className="text-sm" style={{ color: theme.colors.text.secondary }}>Device Type</label>
                                    <div style={{ color: theme.colors.text.primary }}>{firmware?.deviceType}</div>
                                </div>
                                <div>
                                    <label className="text-sm" style={{ color: theme.colors.text.secondary }}>Upload Date</label>
                                    <div style={{ color: theme.colors.text.primary }}>
                                        {new Date(firmware?.uploadDate).toLocaleDateString()}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm" style={{ color: theme.colors.text.secondary }}>Status</label>
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
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="rounded-lg shadow-lg p-6" style={{ background: theme.colors.background.surface }}>
                            <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                                Analysis Results
                            </h2>
                            {firmware?.status === 'analyzed' && firmware?.analysis ? (
                                <div>
                                    <div className="flex space-x-4 mb-4 border-b" style={{ borderColor: theme.colors.background.card }}>
                                        {['overview', 'vulnerabilities', 'raw'].map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`px-4 py-2 -mb-px capitalize ${activeTab === tab ? 'border-b-2' : ''}`}
                                                style={{ 
                                                    color: activeTab === tab ? theme.colors.primary.main : theme.colors.text.secondary,
                                                    borderColor: theme.colors.primary.main
                                                }}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>
                                    {renderContent()}
                                </div>
                            ) : (
                                <div style={{ color: theme.colors.text.secondary }}>
                                    No analysis results available.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FirmwareProfile;
