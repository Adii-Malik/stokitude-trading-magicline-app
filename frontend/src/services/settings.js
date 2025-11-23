import api from './api';

// Get system settings (Admin only)
export const getSettings = async () => {
  const response = await api.get('/settings');
  return response.data;
};

// Update system settings (Admin only)
export const updateSettings = async (settings) => {
  const response = await api.put('/settings', settings);
  return response.data;
};

// Get last price update timestamp
export const getLastUpdate = async () => {
  const response = await api.get('/settings/last-update');
  return response.data;
};

// Get market status
export const getMarketStatus = async () => {
  const response = await api.get('/settings/market-status');
  return response.data;
};

export default {
  getSettings,
  updateSettings,
  getLastUpdate,
  getMarketStatus
};

