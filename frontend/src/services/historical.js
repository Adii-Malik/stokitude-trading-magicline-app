import api from './api';

// Start scraping historical data for symbols (Admin only)
export const startScraping = async (symbols, startDate, endDate) => {
    const response = await api.post('/historical/scrape', {
        symbols,
        startDate,
        endDate
    });
    return response.data;
};

// Get scraping status for symbols
export const getScrapeStatus = async () => {
    const response = await api.get('/historical/status');
    return response.data;
};

// Get historical data for a symbol
export const getHistoricalData = async (symbol, params = {}) => {
    const response = await api.get(`/historical/${symbol}`, { params });
    return response.data;
};

