import api from "./api";

// Alert Rules API endpoints
export const getAllRules = async () => {
    try {
        const response = await api.get("/alerts/rules");
        return response.data;
    } catch (error) {
        console.error("Error fetching alert rules:", error);
        return { success: false, error: error.message };
    }
};

export const getRuleById = async (id) => {
    try {
        const response = await api.get(`/alerts/rules/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching rule ${id}:`, error);
        return { success: false, error: error.message };
    }
};

export const createRule = async (ruleData) => {
    try {
        const response = await api.post("/alerts/rules", ruleData);
        return response.data;
    } catch (error) {
        console.error("Error creating rule:", error);
        return { success: false, error: error.message };
    }
};

export const updateRule = async (id, ruleData) => {
    try {
        const response = await api.put(`/alerts/rules/${id}`, ruleData);
        return response.data;
    } catch (error) {
        console.error(`Error updating rule ${id}:`, error);
        return { success: false, error: error.message };
    }
};

export const deleteRule = async (id) => {
    try {
        const response = await api.delete(`/alerts/rules/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting rule ${id}:`, error);
        return { success: false, error: error.message };
    }
};

// Alerts (Offenses) API endpoints
export const getAlerts = async (filters = {}) => {
    try {
        const queryParams = new URLSearchParams();
        
        // Add filters to query params if they exist
        if (filters.status) queryParams.append("status", filters.status);
        if (filters.severity) queryParams.append("severity", filters.severity);
        if (filters.deviceIp) queryParams.append("deviceIp", filters.deviceIp);
        if (filters.since) queryParams.append("since", filters.since);
        
        const url = `/alerts/alerts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await api.get(url);
        return response.data;
    } catch (error) {
        console.error("Error fetching alerts:", error);
        return { success: false, error: error.message };
    }
};

export const getAlertById = async (id) => {
    try {
        const response = await api.get(`/alerts/alerts/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching alert ${id}:`, error);
        return { success: false, error: error.message };
    }
};

export const updateAlertStatus = async (id, status) => {
    try {
        const response = await api.patch(`/alerts/alerts/${id}/status`, { status });
        return response.data;
    } catch (error) {
        console.error(`Error updating alert ${id} status:`, error);
        return { success: false, error: error.message };
    }
};

// Generate and email CSV report of offenses
export const generateOffenseReport = async (email) => {
    try {
        const response = await api.post("/alerts/generate-report", { email });
        return response.data;
    } catch (error) {
        console.error("Error generating offense report:", error);
        return { success: false, error: error.response?.data?.error || error.message };
    }
};