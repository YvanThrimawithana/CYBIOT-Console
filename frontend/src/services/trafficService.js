

export const getTrafficData = async () => {
    try {
        const response = await fetch(API_ENDPOINTS.TRAFFIC_NETWORK);
        if (!response.ok) throw new Error('Failed to fetch traffic data');
        return await response.json();
    } catch (error) {
        console.error('Error fetching traffic data:', error);
        throw error;
    }
};

export const getDeviceTraffic = async (deviceId) => {
    try {
        const response = await fetch(`http://localhost:5000/api/traffic/logs/${deviceId}`);
        if (!response.ok) throw new Error('Failed to fetch device traffic');
        return await response.json();
    } catch (error) {
        console.error('Error fetching device traffic:', error);
        throw error;
    }
};

export const getUnifiedTrafficLogs = async (timestamp = null) => {
    try {
        let url = 'http://localhost:5000/api/traffic/all-logs';
        if (timestamp) {
            url += `?since=${timestamp}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch unified traffic logs');
        return await response.json();
    } catch (error) {
        console.error('Error fetching unified traffic logs:', error);
        throw error;
    }
};

export const getNewTrafficLogs = async (deviceId, timestamp = null) => {
    try {
        let url = `http://localhost:5000/api/traffic/logs/${deviceId}`;
        if (timestamp) {
            url += `?since=${timestamp}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch new traffic logs');
        return await response.json();
    } catch (error) {
        console.error('Error fetching new traffic logs:', error);
        throw error;
    }
};

// New functions for alert rules
export const getAllAlertRules = async () => {
    try {
        const response = await fetch('http://localhost:5000/api/traffic/rules');
        if (!response.ok) throw new Error('Failed to fetch alert rules');
        return await response.json();
    } catch (error) {
        console.error('Error fetching alert rules:', error);
        throw error;
    }
};

export const getAlertRule = async (ruleId) => {
    try {
        const response = await fetch(`http://localhost:5000/api/traffic/rules/${ruleId}`);
        if (!response.ok) throw new Error('Failed to fetch alert rule');
        return await response.json();
    } catch (error) {
        console.error('Error fetching alert rule:', error);
        throw error;
    }
};

export const createAlertRule = async (ruleData) => {
    try {
        const response = await fetch('http://localhost:5000/api/traffic/rules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(ruleData),
        });
        if (!response.ok) throw new Error('Failed to create alert rule');
        return await response.json();
    } catch (error) {
        console.error('Error creating alert rule:', error);
        throw error;
    }
};

export const updateAlertRule = async (ruleId, ruleData) => {
    try {
        const response = await fetch(`http://localhost:5000/api/traffic/rules/${ruleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(ruleData),
        });
        if (!response.ok) throw new Error('Failed to update alert rule');
        return await response.json();
    } catch (error) {
        console.error('Error updating alert rule:', error);
        throw error;
    }
};

export const deleteAlertRule = async (ruleId) => {
    try {
        if (!ruleId) {
            console.error('Invalid rule ID:', ruleId);
            throw new Error('Invalid rule ID provided');
        }
        
        console.log(`Sending delete request for rule ID: ${ruleId}`);
        const response = await fetch(`http://localhost:5000/api/traffic/rules/${ruleId}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete alert rule');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error deleting alert rule:', error);
        throw error;
    }
};

// New functions for alerts
export const getActiveAlerts = async (deviceId = null, timestamp = null) => {
    try {
        let url = 'http://localhost:5000/api/traffic/active-alerts';
        if (deviceId && deviceId !== 'all') {
            url += `/${deviceId}`;
        }
        
        const queryParams = new URLSearchParams();
        if (timestamp) {
            queryParams.append('since', timestamp);
        }
        
        if (queryParams.toString()) {
            url += `?${queryParams.toString()}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch active alerts');
        return await response.json();
    } catch (error) {
        console.error('Error fetching active alerts:', error);
        throw error;
    }
};

export const getAllSystemAlerts = async (filters = {}) => {
    try {
        let url = 'http://localhost:5000/api/traffic/system-alerts';
        
        // Add query parameters if provided
        const queryParams = new URLSearchParams();
        
        if (filters.status) {
            queryParams.append('status', filters.status);
        }
        
        if (filters.since) {
            queryParams.append('since', filters.since);
        }
        
        if (filters.severity) {
            queryParams.append('severity', filters.severity);
        }
        
        if (queryParams.toString()) {
            url += `?${queryParams.toString()}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch system alerts');
        return await response.json();
    } catch (error) {
        console.error('Error fetching system alerts:', error);
        throw error;
    }
};

export const updateAlertStatus = async (alertId, newStatus) => {
    try {
        // Check if alertId is defined
        if (!alertId) {
            console.error('Alert ID is undefined or empty');
            return {
                success: false,
                error: 'Invalid alert ID: Alert ID cannot be undefined'
            };
        }

        const response = await fetch(`http://localhost:5000/api/traffic/alert-status/${alertId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('Server returned error:', data);
            throw new Error(data.error || 'Failed to update alert status');
        }
        
        return data;
    } catch (error) {
        console.error('Error updating alert status:', error);
        return {
            success: false,
            error: error.message || 'Failed to update alert status'
        };
    }
};

export const evaluateExistingLogs = async () => {
    try {
        const response = await fetch('http://localhost:5000/api/traffic/evaluate-logs', {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to evaluate logs');
        return await response.json();
    } catch (error) {
        console.error('Error evaluating logs:', error);
        throw error;
    }
};

// Generate CSV report of offenses and send via email
export const generateOffenseReport = async (email) => {
    try {
        const response = await fetch('http://localhost:5000/api/traffic/generate-csv-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });
        if (!response.ok) throw new Error('Failed to generate report');
        return await response.json();
    } catch (error) {
        console.error('Error generating offense report:', error);
        throw error;
    }
};
