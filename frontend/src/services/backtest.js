import api from './api';

// Trigger a new backtest
export const runBacktest = async (backtestData) => {
  const response = await api.post('/backtest/run', backtestData);
  return response.data;
};

// Get backtest result by ID
export const getBacktestById = async (id) => {
  const response = await api.get(`/backtest/${id}`);
  return response.data;
};

// Get backtest status
export const getBacktestStatus = async (id) => {
  const response = await api.get(`/backtest/${id}/status`);
  return response.data;
};

// Get user's backtest history
export const getBacktestHistory = async (limit = 20) => {
  const response = await api.get('/backtest/history', { params: { limit } });
  return response.data;
};

// Delete a backtest result
export const deleteBacktest = async (id) => {
  const response = await api.delete(`/backtest/${id}`);
  return response.data;
};
