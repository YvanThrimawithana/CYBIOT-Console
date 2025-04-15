export const getTrafficData = async () => {
    try {
        const response = await fetch('http://localhost:5000/api/traffic/network');
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
