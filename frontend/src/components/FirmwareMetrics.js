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
        acc + (Array.isArray(issues) ? issues.length : 0), 0);

    const metrics = [
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
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {metrics.map((metric) => (
                    <div key={metric.category} 
                        className="p-4 rounded-lg"
                        style={{ background: `${metric.color}15` }}
                    >
                        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                            {metric.category}
                        </div>
                        <div className="text-2xl font-bold" style={{ color: metric.color }}>
                            {metric.count}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6">
                <h4 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                    Detailed Findings
                </h4>
                {Object.entries(analysisResults.static).map(([category, issues]) => (
                    issues?.length > 0 && (
                        <div key={category} className="mb-4">
                            <h5 className="font-medium mb-2 capitalize" style={{ color: theme.colors.text.primary }}>
                                {category.replace(/_/g, ' ')}
                            </h5>
                            <div className="space-y-2">
                                {issues.map((issue, idx) => (
                                    <div key={idx} 
                                        className="p-3 rounded"
                                        style={{ 
                                            background: theme.colors.background.card,
                                            borderLeft: `4px solid ${
                                                issue.severity === 'HIGH' ? theme.colors.status.error :
                                                issue.severity === 'MEDIUM' ? theme.colors.status.warning :
                                                theme.colors.status.success
                                            }`
                                        }}
                                    >
                                        <div className="flex justify-between">
                                            <span style={{ color: theme.colors.text.primary }}>
                                                {issue.match}
                                            </span>
                                            <span style={{ 
                                                color: issue.severity === 'HIGH' ? theme.colors.status.error :
                                                    issue.severity === 'MEDIUM' ? theme.colors.status.warning :
                                                    theme.colors.status.success 
                                            }}>
                                                {issue.severity}
                                            </span>
                                        </div>
                                        <div style={{ color: theme.colors.text.secondary }}>
                                            File: {issue.file}, Line: {issue.line}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
};

export default FirmwareMetrics;
