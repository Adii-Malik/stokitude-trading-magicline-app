import api from './api';

// Start scraping historical data for symbols (Admin only)
export const startScraping = async (symbols) => {
    const response = await api.post('/historical/scrape', {
        symbols
    });
    return response.data;
};

// Get historical data for a symbol
export const getHistoricalData = async (symbol, params = {}) => {
    const response = await api.get(`/historical/${symbol}`, { params });
    return response.data;
};

