import React from 'react';
import { theme } from '../styles/theme';

const calculateSeverityScore = (results) => {
    // Add null checks
    if (!results || !results.static) return 0;
    
    const weights = {
        HIGH: 10,
        MEDIUM: 5,
        LOW: 2
    };

    let totalIssues = 0;
    let weightedScore = 0;
    
    // Safely iterate over static analysis results
    Object.entries(results.static).forEach(([category, issues]) => {
        if (Array.isArray(issues)) {
            issues.forEach(issue => {
                totalIssues++;
                weightedScore += weights[issue.severity] || 0;
            });
        }
    });

    // Calculate score out of 10
    const maxScore = totalIssues * 10;
    const score = maxScore ? (10 - ((weightedScore / maxScore) * 10)) : 10;
    return Math.max(0, Math.round(score * 10) / 10);
};

const getScoreColor = (score) => {
    if (score >= 7.5) return theme.colors.status.success;
    if (score >= 5) return theme.colors.status.warning;
    return theme.colors.status.error;
};

const FirmwareMetrics = ({ analysisResults }) => {
    // Add early return if no results
    if (!analysisResults || !analysisResults.static) {
        return (
            <div className="p-4 text-center" style={{ color: theme.colors.text.secondary }}>
                No analysis results available
            </div>
        );
    }

    const severityScore = calculateSeverityScore(analysisResults);
    const totalIssues = Object.values(analysisResults.static).reduce((acc, issues) => 
        acc + (Array.isArray(issues) ? issues.length : 0), 0);    // Count high severity issues across all categories
    let highSeverityCount = 0;
    Object.values(analysisResults.static).forEach(issues => {
        if (Array.isArray(issues)) {
            highSeverityCount += issues.filter(issue => issue.severity === 'HIGH').length;
        }
    });
    
    const metrics = [
        {
            category: 'Critical Vulnerabilities',
            count: highSeverityCount,
            color: theme.colors.status.error,
            priority: true
        },
        {
            category: 'Dangerous Libraries',
            count: analysisResults.static.dangerous_libs?.length || 0,
            color: theme.colors.status.warning
        },
        {
            category: 'Unsafe Libraries',
            count: analysisResults.static.unsafe_libs?.length || 0,
            color: theme.colors.status.warning
        },
        {
            category: 'Command Injection',
            count: analysisResults.static.command_injection?.length || 0,
            color: theme.colors.status.error
        },
        {
            category: 'Hardcoded Credentials',
            count: analysisResults.static.hardcoded_creds?.length || 0,
            color: theme.colors.status.error
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
                        Security Score
                    </h3>
                    <div className="text-4xl font-bold" style={{ color: getScoreColor(severityScore) }}>
                        {severityScore}/10
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-lg" style={{ color: theme.colors.text.secondary }}>
                        Total Issues
                    </span>
                    <div className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
                        {totalIssues}
                    </div>
                </div>
            </div>            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {metrics.map((metric) => (
                    <div key={metric.category} 
                        className={`p-4 rounded-lg ${metric.category === 'Critical Vulnerabilities' && metric.count > 0 ? 'border' : ''}`}
                        style={{ 
                            background: `${metric.color}15`,
                            borderColor: metric.category === 'Critical Vulnerabilities' && metric.count > 0 ? `${metric.color}50` : 'transparent'
                        }}
                    >
                        <div className="flex items-center">
                            {metric.category === 'Critical Vulnerabilities' && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
                                    className="w-4 h-4 mr-1" style={{ color: metric.color }}>
                                    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003z" clipRule="evenodd" />
                                </svg>
                            )}
                            <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                                {metric.category}
                            </div>
                        </div>
                        <div className={`text-2xl font-bold ${metric.category === 'Critical Vulnerabilities' ? 'mt-1' : ''}`} 
                            style={{ color: metric.color }}>
                            {metric.count}
                        </div>
                    </div>
                ))}
            </div><div className="mt-6">
                <h4 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                    Detailed Findings
                </h4>
                
                {/* Collect and organize all issues by severity */}
                {(() => {
                    // Collect all issues with their categories
                    const allIssues = [];
                    Object.entries(analysisResults.static).forEach(([category, issues]) => {
                        if (issues?.length > 0) {
                            issues.forEach(issue => {
                                allIssues.push({
                                    ...issue,
                                    category: category.replace(/_/g, ' ')
                                });
                            });
                        }
                    });
                    
                    // Group issues by severity
                    const highSeverityIssues = allIssues.filter(issue => issue.severity === 'HIGH');
                    const mediumSeverityIssues = allIssues.filter(issue => issue.severity === 'MEDIUM');
                    const lowSeverityIssues = allIssues.filter(issue => issue.severity === 'LOW');
                    
                    return (
                        <div>
                            {/* Critical vulnerabilities section */}
                            {highSeverityIssues.length > 0 && (                                <div className="mb-6 p-4 rounded-lg" style={{ 
                                    background: `${theme.colors.status.error}10`,
                                    border: `1px solid ${theme.colors.status.error}30`,
                                }}>
                                    <h5 className="font-medium mb-3 flex items-center" 
                                        style={{ color: theme.colors.status.error }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2">
                                            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                        </svg>
                                        Critical Vulnerabilities ({highSeverityIssues.length})
                                    </h5>
                                    <div className="space-y-2">
                                        {highSeverityIssues.map((issue, idx) => (
                                            <div key={idx} 
                                                className="p-3 rounded relative"
                                                style={{ 
                                                    background: theme.colors.background.card,
                                                    borderLeft: `4px solid ${theme.colors.status.error}`,
                                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                                }}
                                            >
                                                <div className="flex justify-between">
                                                    <span style={{ color: theme.colors.status.error, fontWeight: 'bold' }}>
                                                        {issue.match}
                                                    </span>
                                                    <span className="px-2 py-1 text-xs rounded"
                                                        style={{
                                                            backgroundColor: `${theme.colors.status.error}20`,
                                                            color: theme.colors.status.error
                                                        }}>
                                                        {issue.category}
                                                    </span>
                                                </div>
                                                <div style={{ color: theme.colors.text.secondary }}>
                                                    File: {issue.file}, Line: {issue.line}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Medium severity issues */}
                            {mediumSeverityIssues.length > 0 && (
                                <div className="mb-4">
                                    <h5 className="font-medium mb-2" style={{ color: theme.colors.status.warning }}>
                                        Medium Severity Issues ({mediumSeverityIssues.length})
                                    </h5>
                                    <div className="space-y-2">
                                        {mediumSeverityIssues.map((issue, idx) => (
                                            <div key={idx} 
                                                className="p-3 rounded"
                                                style={{ 
                                                    background: theme.colors.background.card,
                                                    borderLeft: `4px solid ${theme.colors.status.warning}`
                                                }}
                                            >
                                                <div className="flex justify-between">
                                                    <span style={{ color: theme.colors.text.primary }}>
                                                        {issue.match}
                                                    </span>
                                                    <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
                                                        {issue.category}
                                                    </span>
                                                </div>
                                                <div style={{ color: theme.colors.text.secondary }}>
                                                    File: {issue.file}, Line: {issue.line}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Low severity issues */}
                            {lowSeverityIssues.length > 0 && (
                                <div>
                                    <h5 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                                        Low Severity Issues ({lowSeverityIssues.length})
                                    </h5>
                                    <div className="space-y-2">
                                        {lowSeverityIssues.map((issue, idx) => (
                                            <div key={idx} 
                                                className="p-3 rounded"
                                                style={{ 
                                                    background: theme.colors.background.card,
                                                    borderLeft: `4px solid ${theme.colors.status.success}`
                                                }}
                                            >
                                                <div className="flex justify-between">
                                                    <span style={{ color: theme.colors.text.primary }}>
                                                        {issue.match}
                                                    </span>
                                                    <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
                                                        {issue.category}
                                                    </span>
                                                </div>
                                                <div style={{ color: theme.colors.text.secondary }}>
                                                    File: {issue.file}, Line: {issue.line}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default FirmwareMetrics;
