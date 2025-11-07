import config from '../config/config.js';
import tradingViewScraper from './tradingViewScraper.js';
import stockAnalysisScraper from './stockAnalysisScraper.js';

/**
 * Unified Data Source Service
 * Routes requests to appropriate data source based on configuration
 */

class DataSourceService {
    constructor() {
        this.primarySource = config.dataSources.primary;
    }

    /**
     * Get primary data source
     * @returns {string} - 'tradingview' or 'stockanalysis'
     */
    getPrimarySource() {
        return this.primarySource;
    }

    /**
     * Set primary data source
     * @param {string} source - 'tradingview' or 'stockanalysis'
     */
    setPrimarySource(source) {
        if (source !== 'tradingview' && source !== 'stockanalysis') {
            throw new Error('Invalid data source. Must be "tradingview" or "stockanalysis"');
        }
        this.primarySource = source;
    }

    /**
     * Fetch all timeframes for a symbol using primary source
     * Falls back to secondary source if primary fails
     * @param {string} symbol - Stock symbol
     * @returns {Promise<Object>} - { daily, weekly, monthly, source }
     */
    async fetchAllTimeframes(symbol) {
        console.log(`\n📊 Fetching data for ${symbol} using primary source: ${this.primarySource}`);

        let result;
        let usedSource = this.primarySource;

        try {
            // Try primary source
            if (this.primarySource === 'tradingview' && config.dataSources.tradingview.enabled) {
                result = await tradingViewScraper.fetchAllTimeframes(symbol);
            } else if (this.primarySource === 'stockanalysis' && config.dataSources.stockanalysis.enabled) {
                result = await stockAnalysisScraper.fetchAllTimeframes(symbol);
            } else {
                throw new Error(`Primary source ${this.primarySource} is not enabled`);
            }

            // Check if primary source returned data
            const hasData = result.daily.success.length > 0 ||
                result.weekly.success.length > 0 ||
                result.monthly.success.length > 0;

            if (!hasData) {
                throw new Error('Primary source returned no data');
            }

            console.log(`✅ Successfully fetched data from ${usedSource}`);
        } catch (primaryError) {
            console.warn(`⚠️ Primary source (${this.primarySource}) failed: ${primaryError.message}`);
            console.log(`🔄 Attempting fallback to secondary source...`);

            // Try fallback source
            try {
                if (this.primarySource === 'tradingview' && config.dataSources.stockanalysis.enabled) {
                    result = await stockAnalysisScraper.fetchAllTimeframes(symbol);
                    usedSource = 'stockanalysis';
                } else if (this.primarySource === 'stockanalysis' && config.dataSources.tradingview.enabled) {
                    result = await tradingViewScraper.fetchAllTimeframes(symbol);
                    usedSource = 'tradingview';
                } else {
                    throw primaryError; // No fallback available
                }

                console.log(`✅ Successfully fetched data from fallback source: ${usedSource}`);
            } catch (fallbackError) {
                console.error(`❌ Fallback source also failed: ${fallbackError.message}`);
                throw new Error(`All data sources failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
            }
        }

        return {
            ...result,
            source: usedSource
        };
    }

    /**
     * Get configuration for all data sources
     * @returns {Object}
     */
    getSourcesConfig() {
        return {
            primary: this.primarySource,
            tradingview: {
                enabled: config.dataSources.tradingview.enabled,
                apiUrl: config.dataSources.tradingview.apiUrl
            },
            stockanalysis: {
                enabled: config.dataSources.stockanalysis.enabled,
                range: config.dataSources.stockanalysis.range
            }
        };
    }

    /**
     * Check health of all data sources
     * @returns {Promise<Object>}
     */
    async checkSourcesHealth() {
        const health = {
            primary: this.primarySource,
            tradingview: {
                enabled: config.dataSources.tradingview.enabled,
                healthy: false
            },
            stockanalysis: {
                enabled: config.dataSources.stockanalysis.enabled,
                healthy: false
            }
        };

        // Check TradingView
        if (config.dataSources.tradingview.enabled) {
            try {
                health.tradingview.healthy = await tradingViewScraper.checkHealth();
            } catch (error) {
                health.tradingview.healthy = false;
            }
        }

        // Check StockAnalysis (assume healthy if enabled, as it's a scraper)
        if (config.dataSources.stockanalysis.enabled) {
            health.stockanalysis.healthy = true;
        }

        return health;
    }
}

export default new DataSourceService();

