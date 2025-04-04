export const getTrafficData = async () => {
    try {
        const response = await fetch('http://localhost:5000/api/traffic');
        if (!response.ok) throw new Error('Failed to fetch traffic data');
        return await response.json();
    } catch (error) {
        console.error('Error fetching traffic data:', error);
        return [];
    }
};
