import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const getTrafficLogs = async (ip, timeRange = '24h') => {
    try {
        const response = await axios.get(`${API_URL}/traffic/logs/${ip}`, {
            params: { timeRange }
        });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch traffic logs:', error);
        throw error;
    }
};

export const getAllTrafficLogs = async (timeRange = '24h') => {
    try {
        const response = await axios.get(`${API_URL}/traffic/logs`, {
            params: { timeRange }
        });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch network traffic:', error);
        throw error;
    }
};

// Get network-wide traffic overview
export const getNetworkTraffic = async () => {
    try {
        const response = await axios.get(`${API_URL}/traffic/network`);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch network traffic:', error);
        throw error;
    }
};

export const getTrafficAlerts = async (ip) => {
    try {
        const response = await axios.get(`${API_URL}/traffic/alerts/${ip}`);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
        throw new Error(error.response?.data?.error || 'Failed to fetch alerts');
    }
};

export const getDeviceMetrics = async (ip) => {
    try {
        const response = await axios.get(`${API_URL}/traffic/metrics/${ip}`);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch device metrics:', error);
        throw new Error(error.response?.data?.error || 'Failed to fetch device metrics');
    }
};

export const getUserActivity = async (ip) => {
    try {
        const response = await axios.get(`${API_URL}/traffic/users/${ip}`);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch user activity:', error);
        throw new Error(error.response?.data?.error || 'Failed to fetch user activity');
    }
};

export const getAllLogsWithoutFiltering = async () => {
    try {
        const response = await axios.get(`${API_URL}/traffic/all-logs`);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch all logs:', error);
        throw error;
    }
};