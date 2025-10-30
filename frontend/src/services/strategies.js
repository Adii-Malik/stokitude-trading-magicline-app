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

// Get a specific strategy by ID
export const getStrategyById = async (id) => {
  const response = await api.get(`/strategies/${id}`);
  return response.data;
};

// Create a new strategy
export const createStrategy = async (strategyData) => {
  const response = await api.post('/strategies', strategyData);
  return response.data;
};

// Update a strategy
export const updateStrategy = async (id, strategyData) => {
  const response = await api.put(`/strategies/${id}`, strategyData);
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
