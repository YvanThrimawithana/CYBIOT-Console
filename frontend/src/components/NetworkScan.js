import React, { useState, useEffect } from 'react';
import { Table, Input, Button, message } from 'antd';
import { RiRadarLine, RiSearchLine, RiShieldLine } from 'react-icons/ri';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { theme } from '../styles/theme';

const NetworkScan = () => {
    const [subnet, setSubnet] = useState('');
    const [loading, setLoading] = useState(false);
    const [scanResults, setScanResults] = useState([]);
    const [isLoadingPastResults, setIsLoadingPastResults] = useState(true);

    useEffect(() => {
        fetchPastResults();
    }, []);

    const fetchPastResults = async () => {
        try {
            setIsLoadingPastResults(true);
            const response = await axios.get('http://localhost:5000/api/network-scan/results');
            if (response.data.success) {
                setScanResults(response.data.results);
            }
        } catch (error) {
            console.error('Error fetching past results:', error);
            message.error('Failed to load past scan results');
        } finally {
            setIsLoadingPastResults(false);
        }
    };

    const validateInput = (input) => {
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(input)) {
            return `${input}/32`;
        }
        if (/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(input)) {
            return input;
        }
        throw new Error('Invalid IP format. Use either single IP (e.g., 192.168.1.1) or CIDR notation (e.g., 192.168.1.0/24)');
    };

    const handleScan = async () => {
        try {
            setLoading(true);
            let scanSubnet;
            
            try {
                scanSubnet = validateInput(subnet);
            } catch (validationError) {
                message.error(validationError.message);
                setLoading(false);
                return;
            }

            const response = await axios.post('http://localhost:5000/api/network-scan/scan', { 
                subnet: scanSubnet 
            });
            
            if (response.data.success) {
                await fetchPastResults(); // Refresh results after new scan
                message.success(`Successfully scanned ${response.data.hostsScanned} hosts`);
            }
        } catch (error) {
            console.error('Scan error:', error);
            message.error(error.response?.data?.error || 'Failed to perform network scan');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'IP Address',
            dataIndex: 'ip',
            key: 'ip',
            render: (ip) => (
                <span className="text-blue-400 font-medium">{ip}</span>
            ),
            sorter: (a, b) => a.ip.localeCompare(b.ip)
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    status === 'up' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                }`}>
                    {status.toUpperCase()}
                </span>
            )
        },
        {
            title: 'Open Ports',
            dataIndex: 'ports',
            key: 'ports',
            render: (ports) => (
                <div className="max-h-32 overflow-y-auto space-y-1">
                    {ports?.filter(port => port.state === 'open').map((port, index) => (
                        <div key={`${port.portId}-${index}`} 
                            className="text-sm px-2 py-1 rounded bg-blue-500/10 text-blue-400 inline-block mr-2">
                            {port.portId}/{port.protocol} 
                            <span className="text-gray-400">({port.service || 'unknown'})</span>
                        </div>
                    ))}
                </div>
            )
        },
        {
            title: 'OS Match',
            dataIndex: 'osMatch',
            key: 'osMatch',
            render: (osMatch) => (
                <span className="text-purple-400">{osMatch}</span>
            )
        },
        {
            title: 'Last Scan',
            dataIndex: 'timestamp',
            key: 'timestamp',
            render: (timestamp) => (
                <span className="text-gray-400">
                    {new Date(timestamp).toLocaleString()}
                </span>
            ),
            sorter: (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        }
    ];

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <div className="p-6 border-b border-gray-800">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Network Scanner</h1>
                            <p className="text-gray-400">Scan and analyze devices on your network</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-gray-800 p-6 rounded-lg mb-6 border border-gray-700">
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <RiSearchLine className="text-gray-400" />
                            </div>
                            <Input
                                placeholder="Enter subnet or IP (e.g., 192.168.1.0/24 or 192.168.1.1)"
                                value={subnet}
                                onChange={(e) => setSubnet(e.target.value)}
                                className="pl-10 bg-gray-700 border-gray-600 text-white"
                                style={{ 
                                    backgroundColor: theme.colors.background.card,
                                    borderColor: theme.colors.background.card 
                                }}
                            />
                        </div>
                        <Button
                            type="primary"
                            onClick={handleScan}
                            loading={loading}
                            icon={<RiRadarLine className="mr-2" />}
                            className="flex items-center"
                            style={{ 
                                backgroundColor: theme.colors.primary.main,
                                borderColor: theme.colors.primary.main 
                            }}
                        >
                            {loading ? 'Scanning...' : 'Start Scan'}
                        </Button>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                        Note: Scanning requires appropriate permissions and may take several minutes to complete.
                    </p>
                </div>

                <AnimatePresence>
                    {scanResults.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                                <div className="flex items-center text-white">
                                    <RiShieldLine className="text-xl mr-2 text-blue-400" />
                                    <span>Scan Results</span>
                                </div>
                                <span className="text-sm text-gray-400">
                                    Found {scanResults.length} device(s)
                                </span>
                            </div>
                            <Table
                                dataSource={scanResults}
                                columns={columns}
                                rowKey={(record) => `${record.ip}-${record.timestamp}`}
                                pagination={{
                                    pageSize: 10,
                                    showSizeChanger: true,
                                    showTotal: (total) => `Total ${total} items`,
                                    className: 'text-white'
                                }}
                                className="custom-table"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default NetworkScan;