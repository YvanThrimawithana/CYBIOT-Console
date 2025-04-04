import React, { useState, useEffect } from 'react';
import { analyzeFirmware, getAnalysisResult } from '../services/firmwareService';
import { theme } from '../styles/theme';

const FirmwareAnalyzer = ({ selectedFirmware, onAnalysisComplete }) => {
    const [analyzing, setAnalyzing] = useState(false);
    const [results, setResults] = useState(null);

    const startAnalysis = async () => {
        if (!selectedFirmware) return;
        
        setAnalyzing(true);
        try {
            // Start analysis
            await analyzeFirmware(selectedFirmware.id);
            
            // Poll for results
            const results = await getAnalysisResult(selectedFirmware.id);
            setResults(results);
            onAnalysisComplete?.(results);
        } catch (error) {
            console.error('Analysis failed:', error);
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="bg-background-surface p-6 rounded-lg shadow-lg space-y-4"
            style={{ background: theme.colors.background.surface }}>
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium" style={{ color: theme.colors.text.primary }}>
                    {selectedFirmware ? 
                        `Analyze: ${selectedFirmware.version}` : 
                        'Select a firmware to analyze'}
                </h3>
                <button
                    onClick={startAnalysis}
                    disabled={!selectedFirmware || analyzing}
                    style={{ 
                        background: theme.colors.primary.main,
                        opacity: (!selectedFirmware || analyzing) ? 0.5 : 1
                    }}
                    className="text-white px-4 py-2 rounded hover:opacity-80"
                >
                    {analyzing ? 'Analyzing...' : 'Start Analysis'}
                </button>
            </div>

            {results && (
                <div className="mt-4 rounded p-4" style={{ background: theme.colors.background.card }}>
                    <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                        Analysis Results
                    </h4>
                    <div className="space-y-2">
                        {results.vulnerabilities?.map((vuln, index) => (
                            <div key={index} className="p-2 rounded" 
                                style={{ 
                                    background: `${theme.colors.status.error}20`,
                                    borderLeft: `4px solid ${theme.colors.status.error}`
                                }}>
                                <p className="font-medium" style={{ color: theme.colors.status.error }}>
                                    {vuln.severity}: {vuln.title}
                                </p>
                                <p style={{ color: theme.colors.text.secondary }}>{vuln.description}</p>
                            </div>
                        ))}
                        {results.vulnerabilities?.length === 0 && (
                            <p style={{ color: theme.colors.status.success }}>
                                No vulnerabilities detected
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FirmwareAnalyzer;
