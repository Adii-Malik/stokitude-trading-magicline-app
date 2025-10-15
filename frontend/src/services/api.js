import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

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

export const getSymbols = async () => {
  const response = await api.get('/symbols');
  return response.data;
};

export const getSymbol = async (symbol) => {
  const response = await api.get(`/symbols/${symbol}`);
  return response.data;
};

export const clearSymbols = async () => {
  const response = await api.delete('/symbols');
  return response.data;
};

export const getStats = async () => {
  const response = await api.get('/symbols/stats/summary');
  return response.data;
};

export const healthCheck = async () => {
  const response = await api.get('/health', {
    baseURL: 'http://localhost:5000'
  });
  return response.data;
};

export const fetchPrices = async () => {
  const response = await api.post('/symbols/fetch-prices');
  return response.data;
};

export default api;

