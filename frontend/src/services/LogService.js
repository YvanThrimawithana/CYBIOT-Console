import axios from "axios";

const API_URL = "http://localhost:5000/api/traffic";

export const getTrafficLogs = async (ip) => {
    if (!ip) {
        throw new Error("IP address is required");
    }

    try {
        const response = await axios.get(`${API_URL}/logs/${ip}`);
        return response.data; // Return the full response data
    } catch (error) {
        throw new Error(error.response?.data?.error || "Failed to fetch traffic logs");
    }
};