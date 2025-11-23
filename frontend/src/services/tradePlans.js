import api from './api';

// Get all trade plans with optional filters
export const getTradePlans = async (params = {}) => {
  const response = await api.get('/trade-plans', { params });
  return response.data;
};

// Get trade plan by ID
export const getTradePlanById = async (id) => {
  const response = await api.get(`/trade-plans/${id}`);
  return response.data;
};

// Get statistics
export const getTradePlanStats = async () => {
  const response = await api.get('/trade-plans/stats/summary');
  return response.data;
};

// Create a new trade plan (Admin only)
export const createTradePlan = async (planData) => {
  const response = await api.post('/trade-plans', planData);
  return response.data;
};

// Update a trade plan (Admin only)
export const updateTradePlan = async (id, planData) => {
  const response = await api.put(`/trade-plans/${id}`, planData);
  return response.data;
};

// Update trade plan status (Admin only)
export const updateTradePlanStatus = async (id, statusData) => {
  const response = await api.put(`/trade-plans/${id}/status`, statusData);
  return response.data;
};

// Delete a trade plan (Admin only)
export const deleteTradePlan = async (id) => {
  const response = await api.delete(`/trade-plans/${id}`);
  return response.data;
};

// Upload CSV file (Admin only)
export const uploadTradePlansCSV = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/trade-plans/upload/csv', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Clear all trade plans (Admin only)
export const clearAllTradePlans = async () => {
  const response = await api.delete('/trade-plans/clear-all');
  return response.data;
};

