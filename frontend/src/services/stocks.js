import api from './api';

// Get all stocks with optional filters
export const getStocks = async (params = {}) => {
  const response = await api.get('/stocks', { params });
  return response.data;
};

// Get stock by ID
export const getStockById = async (id) => {
  const response = await api.get(`/stocks/${id}`);
  return response.data;
};

// Search/Autocomplete stocks
export const searchStocks = async (query) => {
  const response = await api.get('/stocks/search/autocomplete', {
    params: { q: query }
  });
  return response.data;
};

// Create a new stock (Admin only)
export const createStock = async (stockData) => {
  const response = await api.post('/stocks', stockData);
  return response.data;
};

// Update a stock (Admin only)
export const updateStock = async (id, stockData) => {
  const response = await api.put(`/stocks/${id}`, stockData);
  return response.data;
};

// Delete a stock (Admin only)
export const deleteStock = async (id) => {
  const response = await api.delete(`/stocks/${id}`);
  return response.data;
};

// Upload CSV file (Admin only)
export const uploadStocksCSV = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/stocks/upload/csv', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Get unique sectors
export const getSectors = async () => {
  const response = await api.get('/stocks/meta/sectors');
  return response.data;
};

