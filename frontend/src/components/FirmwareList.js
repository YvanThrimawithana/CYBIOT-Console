import React, { useState, useEffect } from 'react';
import { getFirmwareList } from '../services/firmwareService';
import { theme } from '../styles/theme';

const FirmwareList = ({ onSelect, selected }) => {
    const [firmwares, setFirmwares] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFirmwares();
    }, []);

    const loadFirmwares = async () => {
        try {
            const data = await getFirmwareList();
            setFirmwares(data);
        } catch (error) {
            console.error('Failed to load firmwares:', error);
        } finally {
            setLoading(false);
        }
    };

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

    if (loading) {
        return (
            <div className="bg-background-surface p-6 rounded-lg shadow-lg" 
                style={{ background: theme.colors.background.surface }}>
                <p style={{ color: theme.colors.text.primary }}>Loading firmwares...</p>
            </div>
        );
    }

    return (
        <div className="bg-background-surface rounded-lg shadow-lg overflow-hidden"
            style={{ background: theme.colors.background.surface }}>
            <table className="min-w-full table-auto">
                <thead>
                    <tr style={{ backgroundColor: theme.colors.background.card }}>
                        <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Name</th>
                        <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Version</th>
                        <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Upload Date</th>
                        <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Status</th>
                        <th className="px-4 py-2 font-semibold" style={{ color: theme.colors.text.secondary }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {firmwares.map((firmware) => (
                        <tr key={firmware.id}>
                            <td className="px-4 py-2" style={{ color: theme.colors.text.primary }}>{firmware.name}</td>
                            <td className="px-4 py-2" style={{ color: theme.colors.text.primary }}>{firmware.version}</td>
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
                            <td className="px-4 py-2">
                                <button
                                    onClick={() => onSelect(firmware)}
                                    style={{ color: theme.colors.primary.main }}
                                    className="hover:opacity-80"
                                >
                                    Select
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default FirmwareList;
