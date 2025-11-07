import axios from 'axios';
import config from '../config/config.js';

/**
 * TradingView API Service
 * Fetches adjusted OHLCV data from core engine
 * Endpoint: http://localhost:5002/api/tradingview/populate
 */

class TradingViewScraper {
    constructor() {
        this.apiUrl = config.dataSources.tradingview.apiUrl;
        this.timeout = config.dataSources.tradingview.timeout;
        this.enabled = config.dataSources.tradingview.enabled;
    }

    /**
     * Fetch all timeframes for a symbol from TradingView
     * Note: TradingView API populates MongoDB directly, we just trigger the API
     * @param {string} symbol - Stock symbol (e.g., 'OGDC')
     * @returns {Promise<Object>} - { daily, weekly, monthly }
     */
    async fetchAllTimeframes(symbol) {
        if (!this.enabled) {
            throw new Error('TradingView data source is disabled');
        }

        console.log(`\n📊 Triggering TradingView API for ${symbol}...`);

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    symbols: [symbol],
                    timeframes: ['daily', 'weekly', 'monthly']
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            if (!response.data || !response.data.success) {
                throw new Error(response.data?.message || 'Invalid response from TradingView API');
            }

            // TradingView API populates MongoDB directly
            // Return counts from API response
            const symbolData = response.data.data?.[symbol];
            if (!symbolData) {
                throw new Error(`No data returned for symbol ${symbol}`);
            }

            const dailyCount = symbolData.daily?.length || 0;
            const weeklyCount = symbolData.weekly?.length || 0;
            const monthlyCount = symbolData.monthly?.length || 0;

            console.log(`✅ TradingView populated ${dailyCount + weeklyCount + monthlyCount} records for ${symbol}`);

            // Return format compatible with dataSourceService
            return {
                daily: { success: Array(dailyCount).fill({}), failed: [], total: dailyCount },
                weekly: { success: Array(weeklyCount).fill({}), failed: [], total: weeklyCount },
                monthly: { success: Array(monthlyCount).fill({}), failed: [], total: monthlyCount }
            };
        } catch (error) {
            console.error(`❌ Error calling TradingView API for ${symbol}:`, error.message);

            return {
                daily: { success: [], failed: [{ symbol, error: error.message }], total: 0 },
                weekly: { success: [], failed: [{ symbol, error: error.message }], total: 0 },
                monthly: { success: [], failed: [{ symbol, error: error.message }], total: 0 }
            };
        }
    }


    /**
     * Check if TradingView API is available
     * @returns {Promise<boolean>}
     */
    async checkHealth() {
        try {
            const response = await axios.get(this.apiUrl.replace('/populate', '/health'), {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
}

export default new TradingViewScraper();

