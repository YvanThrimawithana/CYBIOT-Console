import React, { useState } from 'react';
import FirmwareUpload from '../components/FirmwareUpload';
import FirmwareList from '../components/FirmwareList';
import DeviceUpdater from '../components/DeviceUpdater';
import FirmwareAnalyzer from '../components/FirmwareAnalyzer';
import Notification from '../components/Notification';
import { theme } from "../styles/theme";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const FirmwareManagement = () => {
    const [selectedFirmware, setSelectedFirmware] = useState(null);
    const [notification, setNotification] = useState({ message: '', isError: false });

    return (
        <>
            <div className="p-8" style={{ background: theme.colors.background.main }}>
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8" style={{ color: theme.colors.text.primary }}>
                        Firmware Management
                    </h1>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="col-span-1">
                            <div className="rounded-lg shadow-lg p-6" 
                                style={{ background: theme.colors.background.surface }}>
                                <h2 className="text-xl font-semibold mb-4" 
                                    style={{ color: theme.colors.text.primary }}>
                                    Upload New Firmware
                                </h2>
                                <FirmwareUpload onUploadSuccess={() => {
                                    setNotification({ 
                                        message: 'Firmware uploaded successfully', 
                                        isError: false 
                                    });
                                }} />
                            </div>
                        </div>

                        <div className="col-span-1">
                            <div className="rounded-lg shadow-lg p-6"
                                style={{ background: theme.colors.background.surface }}>
                                <h2 className="text-xl font-semibold mb-4"
                                    style={{ color: theme.colors.text.primary }}>
                                    Analyze Firmware
                                </h2>
                                <FirmwareAnalyzer 
                                    selectedFirmware={selectedFirmware}
                                    onAnalysisComplete={(result) => {
                                        setNotification({ 
                                            message: 'Analysis completed', 
                                            isError: false 
                                        });
                                    }} 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="rounded-lg shadow-lg p-6"
                            style={{ background: theme.colors.background.surface }}>
                            <h2 className="text-xl font-semibold mb-4"
                                style={{ color: theme.colors.text.primary }}>
                                Firmware Repository
                            </h2>
                            <FirmwareList 
                                onSelect={setSelectedFirmware}
                                selected={selectedFirmware}
                            />
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="rounded-lg shadow-lg p-6"
                            style={{ background: theme.colors.background.surface }}>
                            <h2 className="text-xl font-semibold mb-4"
                                style={{ color: theme.colors.text.primary }}>
                                Device Updates
                            </h2>
                            <DeviceUpdater 
                                selectedFirmware={selectedFirmware}
                                onUpdateSuccess={() => {
                                    setNotification({ 
                                        message: 'Devices updated successfully', 
                                        isError: false 
                                    });
                                }}
                                onRevertSuccess={() => {
                                    setNotification({ 
                                        message: 'Firmware reverted successfully', 
                                        isError: false 
                                    });
                                }}
                            />
                        </div>
                    </div>

                    {notification.message && (
                        <Notification 
                            message={notification.message} 
                            isError={notification.isError} 
                        />
                    )}
                </div>
            </div>
            <ReactQueryDevtools initialIsOpen={false} />
        </>
    );
};

export default FirmwareManagement;
