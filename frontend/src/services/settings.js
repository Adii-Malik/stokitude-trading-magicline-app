import api from './api';

// Get system settings
export const getSettings = async () => {
  const response = await api.get('/api/settings');
  return response.data;
};

// Update system settings
export const updateSettings = async (settings) => {
  const response = await api.put('/api/settings', settings);
  return response.data;
};

// Manual price refresh
export const refreshPrices = async () => {
  const response = await api.post('/api/settings/refresh-prices');
  return response.data;
};

// Get system status
export const getSystemStatus = async () => {
  const response = await api.get('/api/settings/status');
  return response.data;
};

export default {
  getSettings,
  updateSettings,
  refreshPrices,
  getSystemStatus
};

