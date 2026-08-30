import api from './api';

// Get all strategies for the authenticated user
export const getStrategies = async () => {
  const response = await api.get('/strategies');
  return response.data;
};

// Get available strategies from Python service
export const getAvailableStrategies = async () => {
  const response = await api.get('/strategies/available');
  return response.data;
};

// Create a new strategy
export const createStrategy = async (strategyData) => {
  const response = await api.post('/strategies', strategyData);
  return response.data;
};

// Delete a strategy
export const deleteStrategy = async (id) => {
  const response = await api.delete(`/strategies/${id}`);
  return response.data;
};

// Activate a strategy for live trading
export const activateStrategy = async (id) => {
  const response = await api.post(`/strategies/${id}/activate`);
  return response.data;
};

// Deactivate a strategy
export const deactivateStrategy = async (id) => {
  const response = await api.post(`/strategies/${id}/deactivate`);
  return response.data;
};

// Get stop loss presets from Python core
export const getSlPresets = async () => {
  const response = await api.get('/strategies/sl-presets');
  return response.data;
};

// Get full SL config for a specific preset and timeframe
export const getSlConfig = async (preset, timeframe) => {
  const response = await api.get(`/strategies/sl-config/${preset}`, {
    params: { timeframe }
  });
  return response.data;
};
