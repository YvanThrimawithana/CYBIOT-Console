import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
    RiFileDownloadLine, 
    RiCheckboxCircleLine, 
    RiCloseCircleLine 
} from "react-icons/ri";
import { theme } from "../styles/theme";

const FirmwareReportModal = ({ show, onClose, firmware, onSendReport }) => {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [reportFormat, setReportFormat] = useState('pdf'); // Options: 'pdf', 'csv', 'html'

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Basic email validation
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await onSendReport({
                email,
                reportFormat,
                firmwareId: firmware.id
            });

            if (result.success) {
                setSuccess(true);
                setEmail('');
                // Auto close after success
                setTimeout(() => {
                    onClose();
                }, 3000);
            } else {
                setError(result.error || 'Failed to send report');
            }
        } catch (err) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!show) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
            <div className="flex items-center justify-center min-h-screen">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="relative rounded-lg overflow-hidden shadow-xl w-full max-w-md"
                    style={{ backgroundColor: theme.colors.background.surface }}
                >
                    <div className="px-6 py-4 border-b flex justify-between items-center" 
                         style={{ borderColor: theme.colors.background.card }}>
                        <h3 className="text-xl font-bold" style={{ color: theme.colors.text.primary }}>
                            Firmware Analysis Report
                        </h3>
                        <button
                            onClick={onClose}
                            style={{ color: theme.colors.text.secondary }}
                            className="hover:opacity-80"
                        >
                            <RiCloseCircleLine size={24} />
                        </button>
                    </div>

                    <div className="p-6">
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                                <p>{error}</p>
                            </div>
                        )}
                        
                        {success ? (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-6 rounded mb-4 text-center">
                                <RiCheckboxCircleLine size={48} className="mx-auto mb-2 text-green-500" />
                                <p className="text-lg font-medium">Report sent successfully!</p>
                                <p className="mt-2">The report has been sent to {email}</p>
                            </div>
                        ) : (
                            <>                                <div className="mb-4" style={{ color: theme.colors.text.primary }}>
                                    <p className="mb-2"><strong>Firmware:</strong> {firmware?.name}</p>
                                    <p className="mb-2"><strong>Version:</strong> {firmware?.version}</p>
                                    <p className="mb-2"><strong>Device Type:</strong> {firmware?.deviceType}</p>
                                    <p className="mb-2"><strong>Security Score:</strong> {firmware?.securityScore}/10</p>
                                    
                                    {firmware?.analysis && (() => {
                                        // Count critical vulnerabilities
                                        let criticalCount = 0;
                                        Object.values(firmware.analysis.static || {}).forEach(issues => {
                                            if (Array.isArray(issues)) {
                                                criticalCount += issues.filter(issue => issue.severity === 'HIGH').length;
                                            }
                                        });
                                        
                                        if (criticalCount > 0) {
                                            return (
                                                <p className="mb-3 py-2 px-3 rounded border" style={{ 
                                                    borderColor: theme.colors.status.error,
                                                    backgroundColor: `${theme.colors.status.error}10`,
                                                    color: theme.colors.status.error
                                                }}>
                                                    <strong>Warning:</strong> Report contains {criticalCount} critical security {criticalCount === 1 ? 'vulnerability' : 'vulnerabilities'}.
                                                </p>
                                            );
                                        }
                                        return null;
                                    })()}
                                    
                                    <p className="mb-6">
                                        This will generate a comprehensive report of the firmware analysis results
                                        and send it to your email address.
                                    </p>
                                </div>
                                
                                <form onSubmit={handleSubmit}>
                                    <div className="mb-4">
                                        <label htmlFor="email" className="block text-sm font-medium mb-2" 
                                            style={{ color: theme.colors.text.secondary }}>
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
                                                backgroundColor: theme.colors.background.card,
                                                borderColor: theme.colors.background.card,
                                                color: theme.colors.text.primary
                                            }}
                                            disabled={isSubmitting}
                                            required
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-2" 
                                            style={{ color: theme.colors.text.secondary }}>
                                            Report Format
                                        </label>
                                        <div className="flex space-x-4">
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name="reportFormat"
                                                    value="pdf"
                                                    checked={reportFormat === 'pdf'}
                                                    onChange={() => setReportFormat('pdf')}
                                                    className="form-radio"
                                                />
                                                <span className="ml-2" style={{ color: theme.colors.text.primary }}>PDF</span>
                                            </label>
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name="reportFormat"
                                                    value="csv"
                                                    checked={reportFormat === 'csv'}
                                                    onChange={() => setReportFormat('csv')}
                                                    className="form-radio"
                                                />
                                                <span className="ml-2" style={{ color: theme.colors.text.primary }}>CSV</span>
                                            </label>
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name="reportFormat"
                                                    value="html"
                                                    checked={reportFormat === 'html'}
                                                    onChange={() => setReportFormat('html')}
                                                    className="form-radio"
                                                />
                                                <span className="ml-2" style={{ color: theme.colors.text.primary }}>HTML</span>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-end space-x-4 mt-6">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 rounded hover:opacity-80"
                                            style={{
                                                backgroundColor: theme.colors.background.card,
                                                color: theme.colors.text.primary
                                            }}
                                            disabled={isSubmitting}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 rounded hover:opacity-80 flex items-center"
                                            style={{
                                                backgroundColor: theme.colors.primary.main,
                                                color: '#ffffff'
                                            }}
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <RiFileDownloadLine className="mr-2" />
                                                    Generate & Send
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default FirmwareReportModal;
