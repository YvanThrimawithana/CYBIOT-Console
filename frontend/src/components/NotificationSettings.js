import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiMailSendLine, RiSettings3Line, RiCheckLine, RiCloseLine } from 'react-icons/ri';

const NotificationSettings = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState({
        enabled: true,
        email: 'yvan.thrimawithana@gmail.com',
        notifyHighSeverity: true,
        notifyMediumSeverity: false,
        notifyLowSeverity: false,
        digestEnabled: false,
        digestFrequency: 'daily'
    });
    
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(null);
    const [testSending, setTestSending] = useState(false);
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        // In the future, you can load settings from the backend here
        // For now, we'll use default values
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings({
            ...settings,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            
            // In the future, you can save settings to backend here
            // For now, we'll just simulate a successful save
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(null), 3000);
        } catch (error) {
            console.error('Error saving notification settings:', error);
            setSaveSuccess(false);
            setTimeout(() => setSaveSuccess(null), 3000);
        } finally {
            setSaving(false);
        }
    };

    const handleTestEmail = async () => {
        try {
            setTestSending(true);
            setTestResult(null);
            
            // In the future, you can send a test email here
            // For now, we'll just simulate sending a test email
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            setTestResult({ success: true, message: 'Test email sent successfully!' });
            setTimeout(() => setTestResult(null), 3000);
        } catch (error) {
            console.error('Error sending test email:', error);
            setTestResult({ success: false, message: 'Failed to send test email: ' + error.message });
            setTimeout(() => setTestResult(null), 3000);
        } finally {
            setTestSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden"
            >
                <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <RiMailSendLine className="mr-2 text-blue-400" />
                        Email Notification Settings
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <RiCloseLine size={24} />
                    </button>
                </div>

                <div className="p-5 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-white font-medium">Email Notifications</label>
                                <div className="relative inline-block w-12 align-middle select-none">
                                    <input
                                        type="checkbox"
                                        name="enabled"
                                        id="enabled"
                                        checked={settings.enabled}
                                        onChange={handleChange}
                                        className="opacity-0 absolute block w-6 h-6 cursor-pointer"
                                    />
                                    <label
                                        htmlFor="enabled"
                                        className={`block overflow-hidden h-6 rounded-full bg-gray-700 cursor-pointer ${
                                            settings.enabled ? 'bg-blue-600' : ''
                                        }`}
                                    >
                                        <span
                                            className={`block h-6 w-6 rounded-full bg-white transform transition-transform ${
                                                settings.enabled ? 'translate-x-6' : 'translate-x-0'
                                            }`}
                                        ></span>
                                    </label>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400">
                                Receive email notifications for security alerts
                            </p>
                        </div>

                        <div>
                            <label className="block text-white font-medium mb-2">
                                Notification Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={settings.email}
                                onChange={handleChange}
                                disabled={!settings.enabled}
                                className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2 disabled:opacity-50"
                                placeholder="your-email@example.com"
                            />
                        </div>

                        <div>
                            <h3 className="text-white font-medium mb-3">Notification Severity Levels</h3>
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="notifyHighSeverity"
                                        id="notifyHighSeverity"
                                        checked={settings.notifyHighSeverity}
                                        onChange={handleChange}
                                        disabled={!settings.enabled}
                                        className="mr-2 h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                    />
                                    <label htmlFor="notifyHighSeverity" className="text-white">
                                        High Severity Alerts
                                    </label>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="notifyMediumSeverity"
                                        id="notifyMediumSeverity"
                                        checked={settings.notifyMediumSeverity}
                                        onChange={handleChange}
                                        disabled={!settings.enabled}
                                        className="mr-2 h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                    />
                                    <label htmlFor="notifyMediumSeverity" className="text-white">
                                        Medium Severity Alerts
                                    </label>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="notifyLowSeverity"
                                        id="notifyLowSeverity"
                                        checked={settings.notifyLowSeverity}
                                        onChange={handleChange}
                                        disabled={!settings.enabled}
                                        className="mr-2 h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                    />
                                    <label htmlFor="notifyLowSeverity" className="text-white">
                                        Low Severity Alerts
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-white font-medium">Daily Digest</label>
                                <div className="relative inline-block w-12 align-middle select-none">
                                    <input
                                        type="checkbox"
                                        name="digestEnabled"
                                        id="digestEnabled"
                                        checked={settings.digestEnabled}
                                        onChange={handleChange}
                                        disabled={!settings.enabled}
                                        className="opacity-0 absolute block w-6 h-6 cursor-pointer"
                                    />
                                    <label
                                        htmlFor="digestEnabled"
                                        className={`block overflow-hidden h-6 rounded-full bg-gray-700 cursor-pointer ${
                                            settings.digestEnabled && settings.enabled ? 'bg-blue-600' : ''
                                        }`}
                                    >
                                        <span
                                            className={`block h-6 w-6 rounded-full bg-white transform transition-transform ${
                                                settings.digestEnabled && settings.enabled ? 'translate-x-6' : 'translate-x-0'
                                            }`}
                                        ></span>
                                    </label>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400">
                                Receive a summary of all alerts
                            </p>

                            {settings.digestEnabled && settings.enabled && (
                                <div className="mt-3">
                                    <label className="block text-white text-sm mb-1">
                                        Frequency
                                    </label>
                                    <select
                                        name="digestFrequency"
                                        value={settings.digestFrequency}
                                        onChange={handleChange}
                                        className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2"
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status messages */}
                    {saveSuccess !== null && (
                        <div className={`mt-4 p-3 rounded ${saveSuccess ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                            {saveSuccess ? (
                                <div className="flex items-center">
                                    <RiCheckLine className="mr-2" />
                                    <span>Settings saved successfully!</span>
                                </div>
                            ) : (
                                <div className="flex items-center">
                                    <RiCloseLine className="mr-2" />
                                    <span>Failed to save settings</span>
                                </div>
                            )}
                        </div>
                    )}

                    {testResult !== null && (
                        <div className={`mt-4 p-3 rounded ${testResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                            {testResult.success ? (
                                <div className="flex items-center">
                                    <RiCheckLine className="mr-2" />
                                    <span>{testResult.message}</span>
                                </div>
                            ) : (
                                <div className="flex items-center">
                                    <RiCloseLine className="mr-2" />
                                    <span>{testResult.message}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-gray-700">
                    <div className="flex justify-between">
                        <button
                            onClick={handleTestEmail}
                            disabled={testSending || !settings.enabled}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded disabled:opacity-50 transition-colors"
                        >
                            {testSending ? 'Sending...' : 'Test Email'}
                        </button>
                        <div className="space-x-3">
                            <button
                                onClick={onClose}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50 transition-colors"
                            >
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default NotificationSettings;