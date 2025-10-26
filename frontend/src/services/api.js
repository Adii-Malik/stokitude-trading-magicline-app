import axios from 'axios';

// Smart API URL detection:
// 1. Use VITE_API_URL env var if set (production)
// 2. Use relative path if on same domain (production build served by backend)
// 3. Fall back to localhost for development
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // If running in production (same domain as backend), use relative path
  if (import.meta.env.PROD) {
    return '/api';
  }
  // Development fallback
  return `http://localhost:${import.meta.env.VITE_API_PORT || 5000}/api`;
};

const API_URL = getApiUrl();

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

export const uploadManual = async (symbols) => {
  const response = await api.post('/upload/manual', { symbols });
  return response.data;
};

// Magic Line API
export const getSymbols = async () => {
  const response = await api.get('/magic-line');
  return response.data;
};

export const getSymbol = async (symbol) => {
  const response = await api.get(`/magic-line/${symbol}`);
  return response.data;
};

export const clearSymbols = async () => {
  const response = await api.delete('/magic-line');
  return response.data;
};

export const getStats = async () => {
  const response = await api.get('/magic-line/stats/summary');
  return response.data;
};

export const healthCheck = async () => {
  // Use the same base URL as other API calls to avoid hardcoded localhost
  const response = await axios.get('/health', {
    baseURL: API_URL.replace('/api', ''),
    timeout: 10000
  });
  return response.data;
};

export const fetchPrices = async () => {
  const response = await api.post('/magic-line/fetch-prices');
  return response.data;
};

export default api;

