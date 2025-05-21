import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { theme } from '../styles/theme';
import { RiCheckboxCircleLine, RiMailSendLine } from 'react-icons/ri';

const FirmwareEmailModal = ({ show, onClose, onSubmit, isLoading, error, success, firmware }) => {
    const [email, setEmail] = useState('');
    const [reportFormat, setReportFormat] = useState('pdf');
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ email, reportFormat });
    };

    if (!show) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-lg rounded-lg shadow-xl"
                style={{ background: theme.colors.background.surface }}
            >
                <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: theme.colors.background.card }}>
                    <h3 className="text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
                        Send Firmware Analysis Report
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>
                
                <div className="p-6">
                    {error && (
                        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded mb-4">
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {success ? (
                        <div className="bg-green-900/30 border border-green-800 text-green-300 px-4 py-6 rounded mb-4 text-center">
                            <RiCheckboxCircleLine size={48} className="mx-auto mb-2 text-green-400" />
                            <p className="text-lg font-medium">Report sent successfully!</p>
                            <p className="mt-2">The analysis report has been sent to {email}</p>
                        </div>
                    ) : (
                        <>
                            <p style={{ color: theme.colors.text.secondary }} className="mb-6">
                                Receive a detailed analysis report for "{firmware?.name}" via email. The report includes security vulnerabilities, analysis metrics and recommendations.
                            </p>
                            
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email address"
                                        className="w-full py-2 px-4 rounded border"
                                        style={{ 
                                            background: theme.colors.background.card,
                                            color: theme.colors.text.primary,
                                            borderColor: theme.colors.background.card
                                        }}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="format" className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
                                        Report Format
                                    </label>
                                    <select
                                        id="format"
                                        value={reportFormat}
                                        onChange={(e) => setReportFormat(e.target.value)}
                                        className="w-full py-2 px-4 rounded border"
                                        style={{ 
                                            background: theme.colors.background.card,
                                            color: theme.colors.text.primary,
                                            borderColor: theme.colors.background.card
                                        }}
                                        disabled={isLoading}
                                        required
                                    >
                                        <option value="pdf">PDF Document</option>
                                        <option value="html">HTML Report</option>
                                        <option value="csv">CSV Spreadsheet</option>
                                    </select>
                                    <p className="mt-1 text-xs" style={{ color: theme.colors.text.secondary }}>
                                        {reportFormat === 'pdf' && 'PDF provides the most detailed visual report with charts and tables.'}
                                        {reportFormat === 'html' && 'HTML report can be viewed in any web browser.'}
                                        {reportFormat === 'csv' && 'CSV format is useful for importing into spreadsheets or other tools.'}
                                    </p>
                                </div>
                                
                                <div className="flex justify-end space-x-4 mt-6">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 rounded hover:bg-opacity-80"
                                        style={{ 
                                            background: theme.colors.background.card,
                                            color: theme.colors.text.primary
                                        }}
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 rounded hover:bg-opacity-80 flex items-center"
                                        style={{ 
                                            background: theme.colors.primary.main,
                                            color: 'white'
                                        }}
                                        disabled={isLoading}
                                    >
                                        <RiMailSendLine className="mr-2" />
                                        {isLoading ? 'Sending...' : 'Send Report'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default FirmwareEmailModal;
