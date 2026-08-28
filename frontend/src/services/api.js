import axios from 'axios';

// API URL detection:
// - Production (when served by backend): Use relative path '/api'
// - Development (localhost): Use absolute URL with port
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? `http://localhost:${import.meta.env.VITE_API_PORT || 5000}/api` : '/api');

console.log('🔗 API URL:', API_URL);
console.log('🏗️ Build Mode:', import.meta.env.MODE);
console.log('📍 Dev Mode:', import.meta.env.DEV);

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

// Add token to all requests
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

// Handle 401 responses (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear it
      localStorage.removeItem('token');
      // Optionally redirect to login
      if (!window.location.pathname.includes('/login')) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      if (onProgress) {
        onProgress(percentCompleted);
      }
    }
  });

  return response.data;
};

export default api;

