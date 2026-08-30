import api from './api';

// Get all signals for the authenticated user
export const getSignals = async (limit = 50) => {
  const response = await api.get('/signals', { params: { limit } });
  return response.data;
};

// Mark a signal as executed
export const markSignalExecuted = async (id, executedPrice) => {
  const response = await api.put(`/signals/${id}/execute`, { executedPrice });
  return response.data;
};
