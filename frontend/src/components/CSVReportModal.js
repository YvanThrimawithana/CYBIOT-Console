import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
    RiFileDownloadLine, 
    RiCheckboxCircleLine, 
    RiCloseCircleLine 
} from "react-icons/ri";
import { generateOffenseReport } from "../services/trafficService";

const CSVReportModal = ({ show, onClose }) => {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

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
            const response = await generateOffenseReport(email);

            if (response.success) {
                setSuccess(true);
                setEmail('');
                // Auto close after success
                setTimeout(() => {
                    onClose();
                }, 3000);
            } else {
                setError(response.error || 'Failed to generate CSV report');
            }
        } catch (err) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-800 rounded-lg w-full max-w-md overflow-hidden shadow-xl"
        >
            <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Generate Offense Report</h3>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white"
                >
                    <RiCloseCircleLine size={24} />
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
                        <p className="mt-2">The CSV report has been sent to {email}</p>
                    </div>
                ) : (
                    <>
                        <p className="text-gray-300 mb-6">
                            Generate a comprehensive CSV report of all offense records, including new, acknowledged, and resolved. 
                            The report will be sent to your email address.
                        </p>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email address"
                                    className="bg-gray-700 text-white w-full py-2 px-4 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                            
                            <div className="flex justify-end space-x-4 mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
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
    );
};

export default CSVReportModal;