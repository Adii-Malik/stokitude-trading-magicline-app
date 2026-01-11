import axios from 'axios';
import config from '../../../config/config.js';
import fundamentalMapper from '../../../utils/fundamentalMapper.js';

class TradingViewApiSource {
    constructor() {
        this.priority = 60; // Between Manual (100) and PSX Scraper (50)
        this.name = 'TradingView API';
        this.baseUrl = config.pythonCore?.baseUrl || process.env.PYTHON_SERVICE_URL || 'http://localhost:5002';
    }

    /**
     * Get source name
     */
    getName() {
        return this.name;
    }

    /**
     * Get priority for sorting
     */
    getPriority() {
        return this.priority;
    }

    /**
     * Check if source is enabled
     */
    isEnabled() {
        return true; // Always enabled
    }

    /**
     * Get fundamentals for a single symbol (required by FundamentalsAggregator)
     * @param {string} symbol - Stock symbol
     * @returns {Promise<Object>} Fundamental data or empty object
     */
    async getFundamentals(symbol) {
        try {
            const data = await this.fetchSingle(symbol, false);
            return data || {};
        } catch (error) {
            return {};
        }
    }

    /**
     * Fetch fundamentals from TradingView via PSX Engine (batch)
     * @param {string[]} symbols - Array of stock symbols
     * @param {boolean} forceRefresh - Force refresh even if cached
     * @returns {Promise<Object>} Map of symbol -> fundamental data
     */
    async fetchFundamentals(symbols, forceRefresh = false) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/fundamental/fetch`,
                {
                    symbols,
                    force_refresh: forceRefresh
                },
                {
                    timeout: 30000, // 30 second timeout for batch requests
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
                return {};
            }

            const results = {};

            // PSX Engine returns array of stock data
            for (const data of response.data.data) {
                if (data && data.name) {
                    const symbol = data.name.toUpperCase();
                    results[symbol] = this._transformData(symbol, data);
                }
            }

            return results;

        } catch (error) {
            return {};
        }
    }

    /**
     * Fetch fundamentals for a single symbol
     * @param {string} symbol - Stock symbol
     * @param {boolean} forceRefresh - Force refresh even if cached
     * @returns {Promise<Object|null>} Fundamental data or null
     */
    async fetchSingle(symbol, forceRefresh = false) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/fundamental/fetch`,
                {
                    symbols: [symbol],
                    force_refresh: forceRefresh
                },
                {
                    timeout: 15000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response || !response.data || !response.data.success || !response.data.data?.[0]) {
                return null;
            }

            return this._transformData(symbol, response.data.data[0]);

        } catch (error) {
            return null;
        }
    }

    /**
     * Transform TradingView API response to StockFundamental model format
     * Uses decoupled mapper for field transformation
     * @private
     */
    _transformData(symbol, data) {
        try {
            // Use mapper to convert Python core fields to scoring format
            const mappedMetrics = fundamentalMapper.mapPythonFundamentals(data);

            // Enrich with calculated metrics (volatility, stability)
            const enrichedMetrics = fundamentalMapper.enrichFundamentals(mappedMetrics);

            const transformed = {
                symbol: symbol.toUpperCase(),
                source: this.name,
                priority: this.priority,
                metrics: enrichedMetrics,
                lastUpdated: new Date(),
                dataQuality: this._assessDataQuality(data)
            };

            return transformed;

        } catch (error) {
            return null;
        }
    }

    /**
     * Assess data quality based on availability of key fields
     * @private
     */
    _assessDataQuality(data) {
        const criticalFields = [
            'dividend_yield_recent',
            'dividend_payout_ratio_ttm',
            'return_on_equity',
            'debt_to_equity',
            'current_ratio'
        ];

        const availableFields = criticalFields.filter(field =>
            data[field] !== null &&
            data[field] !== undefined &&
            data[field] !== ''
        );

        const score = (availableFields.length / criticalFields.length) * 100;

        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }

    /**
     * Check if PSX Engine is available
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            const response = await axios.get(`${this.baseUrl}/health`, {
                timeout: 5000
            });
            return response.status === 200 && response.data?.status === 'healthy';
        } catch (error) {
            console.error('[TradingViewApiSource] Health check failed:', error.message);
            return false;
        }
    }

    /**
     * Get available fields from PSX Engine
     * @returns {Promise<Array>}
     */
    async getAvailableFields() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/fundamental/fields`, {
                timeout: 5000
            });
            return response.data?.fields || [];
        } catch (error) {
            console.error('[TradingViewApiSource] Error fetching fields:', error.message);
            return [];
        }
    }
}

export default TradingViewApiSource;
