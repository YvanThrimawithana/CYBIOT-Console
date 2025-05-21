import axios from "axios";

const API_URL = "http://localhost:5000/api/firmware";

// Create axios instance with default config
const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    timeout: 30000
});

// Add a request interceptor to include token in every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle token expiration
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If error is token expired and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Try to refresh the token
                const refreshToken = localStorage.getItem('refreshToken');
                const response = await axios.post(
                    'http://localhost:5000/api/users/refresh-token',
                    { refreshToken }
                );

                if (response.data.token) {
                    localStorage.setItem('token', response.data.token);
                    api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                // If refresh fails, redirect to login
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

// Export the api functions
export const uploadFirmware = async (formData) => {
    try {
        const userId = localStorage.getItem('userId'); // Get current user ID
        formData.append('userId', userId);
        formData.append('targetDevices', JSON.stringify(formData.get('deviceType').split(',')));

        const config = {
            headers: { 
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                console.log('Upload progress:', percentCompleted + '%');
            }
        };

        const response = await api.post('/firmware/upload', formData, config);
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

export const getFirmwareList = () => api.get('/firmware/list').then(res => res.data);

export const getFirmwareById = async (id) => {
    try {
        const response = await api.get(`/firmware/${id}`);
        
        // Validate response data
        if (!response.data) {
            throw new Error('No data received from server');
        }

        // Add validation for analysis results
        if (response.data.analysis && (!response.data.analysis.static || typeof response.data.analysis.static !== 'object')) {
            console.error('Invalid analysis results format:', response.data.analysis);
            throw new Error('Invalid analysis results format');
        }

        return response.data;
    } catch (error) {
        console.error('Error fetching firmware:', error.response || error);
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = '/login';
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch firmware details');
    }
};

export const analyzeFirmware = (id) => api.post(`/firmware/${id}/analyze`).then(res => res.data);
export const deleteFirmware = (id) => api.delete(`/firmware/${id}`).then(res => res.data);

export const getLatestFirmware = async () => {
    try {
        const response = await api.get('/firmware/latest');
        return response.data;
    } catch (error) {
        throw error.response?.data?.error || "Network Error";
    }
};

export const getAnalysisResult = async (firmwareId) => {
    try {
        const response = await api.get(`/firmware/${firmwareId}/analysis`);
        
        if (!response.data) {
            throw new Error('No analysis results received');
        }

        // Validate response data structure
        if (!response.data.static || typeof response.data.static !== 'object') {
            throw new Error('Invalid analysis results format');
        }
        
        return response.data;
    } catch (error) {
        console.error('Analysis results error:', error);
        if (error.response?.status === 404) {
            return null;
        }
        throw new Error(error.response?.data?.error || 'Failed to load analysis results');
    }
};

export const getFirmwareStatus = async (firmwareId) => {
    try {
        const response = await api.get(`/firmware/status/${firmwareId}`);
        return response.data.status;
    } catch (error) {
        throw error.response?.data?.error || "Network Error";
    }
};

export const markFirmwareAsStable = async (firmwareId) => {
    try {
        const response = await api.post(`/firmware/mark-stable/${firmwareId}`, null);
        return response.data;
    } catch (error) {
        throw error.response?.data?.error || "Network Error";
    }
};

export const sendFirmwareReport = async (firmwareId, email, reportFormat = 'pdf') => {
    try {
        const response = await api.post(`/firmware/${firmwareId}/send-report`, { 
            email,
            reportFormat
        });
        return response.data;
    } catch (error) {
        console.error('Error sending firmware report:', error);
        throw error.response?.data?.error || "Failed to send firmware report";
    }
};

export const downloadFirmware = async (firmwareId) => {
    try {
        const response = await api.get(`/firmware/${firmwareId}/download`, { 
            responseType: 'blob' 
        });
        
        // Create a download link and trigger it
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `firmware-${firmwareId}.bin`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        return { success: true };
    } catch (error) {
        console.error('Download error:', error);
        throw error.response?.data?.error || "Failed to download firmware";
    }
};
