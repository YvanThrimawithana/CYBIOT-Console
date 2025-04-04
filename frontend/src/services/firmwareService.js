import axios from "axios";
const API_URL = "http://localhost:5000/api/firmware";

export const uploadFirmware = async (formData) => {
    try {
        console.log('Preparing upload request...');
        
        const config = {
            headers: { 
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                console.log('Upload progress:', percentCompleted + '%');
            },
            timeout: 30000 // 30 second timeout
        };

        const response = await axios.post(`${API_URL}/upload`, formData, config);
        console.log('Upload successful:', response.data);
        return response.data;
    } catch (error) {
        console.error('Upload error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        
        if (error.response?.data?.error) {
            throw new Error(error.response.data.error);
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Upload timed out. Please try again.');
        } else {
            throw new Error('Network error during upload. Please try again.');
        }
    }
};

export const getFirmwareList = async () => {
    try {
        const response = await axios.get(`${API_URL}/list`);
        return response.data; // Backend now returns array directly
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const getLatestFirmware = async () => {
    try {
        const response = await axios.get(`${API_URL}/latest`);
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const analyzeFirmware = async (firmwareId) => {
    try {
        const response = await axios.post(`${API_URL}/${firmwareId}/analyze`);
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const getAnalysisResult = async (firmwareId) => {
    try {
        const response = await axios.get(`${API_URL}/${firmwareId}/analysis`);
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const getFirmwareStatus = async (firmwareId) => {
    try {
        const response = await axios.get(`${API_URL}/status/${firmwareId}`);
        return response.data.status;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const markFirmwareAsStable = async (firmwareId) => {
    try {
        const response = await axios.post(`${API_URL}/mark-stable/${firmwareId}`);
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};

export const deleteFirmware = async (firmwareId) => {
    try {
        await axios.delete(`${API_URL}/${firmwareId}`);
    } catch (error) {
        throw error.response ? error.response.data.error : "Network Error";
    }
};
