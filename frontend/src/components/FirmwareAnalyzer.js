import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { analyzeFirmware } from '../services/firmwareService';
import { theme } from '../styles/theme';

const FirmwareAnalyzer = ({ selectedFirmware, onAnalysisComplete }) => {
    const queryClient = useQueryClient();

    const { mutate: startAnalysis, isLoading: isAnalyzing } = useMutation({
        mutationFn: () => analyzeFirmware(selectedFirmware.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['firmwares'] });
            onAnalysisComplete?.();
        }
    });

    return (
        <div className="bg-background-surface p-6 rounded-lg shadow-lg space-y-4"
            style={{ background: theme.colors.background.surface }}>
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium" style={{ color: theme.colors.text.primary }}>
                    {selectedFirmware ? 
                        `Analyze: ${selectedFirmware.name} (${selectedFirmware.version})` : 
                        'Select a firmware to analyze'}
                </h3>
                <button
                    onClick={() => startAnalysis()}
                    disabled={!selectedFirmware || isAnalyzing}
                    style={{ 
                        background: theme.colors.primary.main,
                        opacity: (!selectedFirmware || isAnalyzing) ? 0.5 : 1
                    }}
                    className="text-white px-4 py-2 rounded hover:opacity-80"
                >
                    {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
                </button>
            </div>

            <div className="text-center p-4" style={{ color: theme.colors.text.secondary }}>
                {isAnalyzing ? (
                    'Analyzing firmware... This may take a few minutes.'
                ) : (
                    selectedFirmware?.status === 'analyzed' ? (
                        'Analysis complete. View results in firmware details.'
                    ) : (
                        'Select a firmware and click "Start Analysis" to begin.'
                    )
                )}
            </div>
        </div>
    );
};

export default FirmwareAnalyzer;
