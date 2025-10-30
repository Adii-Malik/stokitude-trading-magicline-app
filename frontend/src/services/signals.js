import api from './api';

// Get all signals for the authenticated user
export const getSignals = async (limit = 50) => {
  const response = await api.get('/signals', { params: { limit } });
  return response.data;
};

// Get a specific signal by ID
export const getSignalById = async (id) => {
  const response = await api.get(`/signals/${id}`);
  return response.data;
};

// Generate a signal for a specific symbol and strategy
export const generateSignal = async (signalData) => {
  const response = await api.post('/signals/generate', signalData);
  return response.data;
};

// Generate signals for multiple symbols
export const batchGenerateSignals = async (batchData) => {
  const response = await api.post('/signals/batch', batchData);
  return response.data;
};

// Mark a signal as executed
export const markSignalExecuted = async (id, executedPrice) => {
  const response = await api.put(`/signals/${id}/execute`, { executedPrice });
  return response.data;
};

// Get pending (unexecuted) signals
export const getPendingSignals = async () => {
  const response = await api.get('/signals/pending');
  return response.data;
};
