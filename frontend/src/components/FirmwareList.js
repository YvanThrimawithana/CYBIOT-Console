import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { getFirmwareList, deleteFirmware, downloadFirmware } from '../services/firmwareService';
import { theme } from '../styles/theme';
import { useNavigate } from 'react-router-dom';
import { MdFileDownload, MdDeleteOutline, MdAnalytics } from 'react-icons/md';

const FirmwareList = ({ onSelect, selected }) => {
    const { data: firmwares, isLoading } = useQuery({
        queryKey: ['firmwares'],
        queryFn: getFirmwareList,
        refetchInterval: 3000, // Poll every 3 seconds
        staleTime: 2000,
        select: (data) => data.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
    });

    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: deleteFirmware,
        onSuccess: () => {
            queryClient.invalidateQueries(['firmwares']);
        }
    });

    const downloadMutation = useMutation({
        mutationFn: downloadFirmware,
        onError: (error) => {
            console.error('Download failed:', error);
            alert(`Download failed: ${error.message || 'Unknown error'}`);
        }
    });

    const navigate = useNavigate();

    const mapStatusColor = (status) => {
        switch(status) {
            case 'analyzed':
                return theme.colors.status.success;
            case 'analyzing':
                return theme.colors.status.warning;
            case 'pending':
                return theme.colors.status.warning;
            case 'error':
                return theme.colors.status.error;
            default:
                return theme.colors.text.secondary;
        }
    };

    const handleViewResults = (firmware, e) => {
        e.stopPropagation(); // Prevent row click
        navigate(`/firmware/${firmware.id}`);
    };

    const handleSelect = (firmware, e) => {
        e.stopPropagation(); // Prevent row click
        onSelect(firmware);
    };

    const handleDownload = async (firmware, e) => {
        e.stopPropagation(); // Prevent row click
        try {
            await downloadMutation.mutateAsync(firmware.id);
        } catch (error) {
            // Error is handled in the mutation
            console.error('Download error in component:', error);
        }
    };

    const handleDelete = async (firmware, e) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete ${firmware.name}?`)) {
            try {
                await deleteMutation.mutateAsync(firmware.id);
            } catch (error) {
                console.error('Delete failed:', error);
            }
        }
    };

    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-background-surface p-6 rounded-lg shadow-lg"
            >
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse h-12 bg-gray-200 rounded" />
                    ))}
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-background-surface rounded-lg shadow-lg overflow-hidden"
        >
            <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                    <thead>
                        <tr style={{ backgroundColor: theme.colors.background.card }}>
                            <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Name</th>
                            <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Version</th>
                            <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Upload Date</th>
                            <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Status</th>
                            <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Score</th>
                            <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <AnimatePresence mode="popLayout">
                            {firmwares?.map((firmware) => (
                                <motion.tr
                                    key={firmware.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="hover:bg-opacity-10 hover:bg-white transition-colors duration-200"
                                    style={{ 
                                        backgroundColor: selected?.id === firmware.id ? 
                                            `${theme.colors.primary.main}10` : 'transparent'
                                    }}
                                >
                                    <td className="px-4 py-2" style={{ color: theme.colors.text.primary }}>
                                        {firmware.name}
                                    </td>
                                    <td className="px-4 py-2" style={{ color: theme.colors.text.primary }}>
                                        {firmware.version}
                                    </td>
                                    <td className="px-4 py-2" style={{ color: theme.colors.text.secondary }}>
                                        {new Date(firmware.uploadDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="px-2 py-1 rounded text-sm" style={{
                                            backgroundColor: `${mapStatusColor(firmware.status)}20`,
                                            color: mapStatusColor(firmware.status)
                                        }}>
                                            {firmware.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2" style={{ color: theme.colors.text.secondary }}>
                                        {firmware.securityScore !== null ? 
                                            <span style={{
                                                color: firmware.securityScore > 7 ? theme.colors.status.success : 
                                                      firmware.securityScore > 4 ? theme.colors.status.warning :
                                                      theme.colors.status.error
                                            }}>
                                                {firmware.securityScore}/10
                                            </span>
                                          : '-'}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={(e) => handleSelect(firmware, e)}
                                                style={{ 
                                                    color: theme.colors.primary.main,
                                                    opacity: selected?.id === firmware.id ? 0.5 : 1
                                                }}
                                                className="hover:opacity-80 px-2 py-1 rounded"
                                                disabled={selected?.id === firmware.id}
                                            >
                                                Select
                                            </button>
                                            {firmware.status === 'analyzed' && (
                                                <button
                                                    onClick={(e) => handleViewResults(firmware, e)}
                                                    style={{ color: theme.colors.text.secondary }}
                                                    className="hover:opacity-80 px-2 py-1 rounded flex items-center"
                                                >
                                                    <MdAnalytics className="mr-1" />
                                                    Results
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDownload(firmware, e)}
                                                style={{ color: theme.colors.primary.main }}
                                                className="hover:opacity-80 px-2 py-1 rounded flex items-center"
                                                disabled={downloadMutation.isLoading}
                                            >
                                                <MdFileDownload className="mr-1" />
                                                {downloadMutation.isLoading && firmware.id === downloadMutation.variables ? 
                                                    'Downloading...' : 'Download'}
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(firmware, e)}
                                                style={{ color: theme.colors.status.error }}
                                                className="hover:opacity-80 px-2 py-1 rounded flex items-center"
                                            >
                                                <MdDeleteOutline className="mr-1" />
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

export default FirmwareList;
