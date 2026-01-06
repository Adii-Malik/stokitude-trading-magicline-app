/**
 * Fundamentals Aggregator
 * Combines data from multiple sources with caching and fallback logic
 * Sources checked in priority order: Manual > TradingView API > PSX Scraper > Stock Analysis > Cached
 */
import ManualOverrideSource from './ManualOverrideSource.js';
import PSXScraperSource from './PSXScraperSource.js';
import StockAnalysisSource from './StockAnalysisSource.js';
import TradingViewApiSource from './TradingViewApiSource.js';
import StockFundamental from '../../../models/StockFundamental.js';
import Stock from '../../../models/Stock.js';

class FundamentalsAggregator {
    constructor() {
        // Priority order: Manual (100) > TradingView API (60) > PSX Scraper (50) > Stock Analysis (30)
        this.sources = [
            new ManualOverrideSource(),
            new TradingViewApiSource(),
            new PSXScraperSource(),
            new StockAnalysisSource()
        ];

        // Sort by priority (highest first)
        this.sources.sort((a, b) => b.getPriority() - a.getPriority());
    }

    /**
     * Get fundamentals for a symbol
     * Tries sources in priority order, merges results, caches in DB
     * @param {String} symbol - Stock symbol
     * @param {Boolean} forceRefresh - Skip cache and fetch fresh data
     * @returns {Object} - Fundamental data
     */
    async getFundamentals(symbol, forceRefresh = false) {
        symbol = symbol.toUpperCase().trim();

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cached = await StockFundamental.findOne({ symbol });
            if (cached && cached.isFresh(2160)) { // 90 days
                return cached;
            }
        }

        // Aggregate from sources
        const aggregated = {};
        const sourcesUsed = [];

        for (const source of this.sources) {
            if (source.isEnabled()) {
                try {
                    const sourceData = await source.getFundamentals(symbol);
                    const filtered = this._filterNonNull(sourceData);

                    if (Object.keys(filtered).length > 0) {
                        sourcesUsed.push({
                            source: source.getName(),
                            lastFetched: new Date(),
                            fieldsProvided: Object.keys(filtered)
                        });

                        // Merge data (earlier sources override later ones)
                        Object.assign(aggregated, filtered);
                    }
                } catch (error) {
                    // Silent fail, try next source
                }
            }
        }

        // Calculate dividend yield if we have TTM and current price
        if (aggregated.dividendTTM && !aggregated.dividendYield) {
            const stock = await Stock.findOne({ symbol });
            if (stock && stock.currentPrice > 0) {
                aggregated.dividendYield = (aggregated.dividendTTM / stock.currentPrice) * 100;
            }
        }

        // Determine data quality
        aggregated.dataQuality = this._assessDataQuality(aggregated);

        // Save to cache
        const fundamental = await StockFundamental.findOneAndUpdate(
            { symbol },
            {
                ...aggregated,
                symbol,
                lastUpdated: new Date(),
                sourcesUsed,
                dataSource: sourcesUsed.length > 1 ? 'COMPOSITE' : (sourcesUsed[0]?.source || 'UNKNOWN')
            },
            { upsert: true, new: true, runValidators: true }
        );

        return fundamental;
    }

    /**
     * Batch refresh fundamentals for multiple symbols
     * Used by nightly job
     * @param {Array<String>} symbols
     * @returns {Array} - Results for each symbol
     */
    async refreshAll(symbols) {
        const results = [];
        for (const symbol of symbols) {
            try {
                const fundamental = await this.getFundamentals(symbol, true);
                results.push({
                    symbol,
                    status: 'success',
                    dataQuality: fundamental.dataQuality,
                    fieldsCount: Object.keys(fundamental.toObject()).length
                });
            } catch (error) {
                results.push({
                    symbol,
                    status: 'error',
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Get stale symbols that need refresh
     * @param {Number} maxAgeHours - Max age for fundamental data
     * @returns {Array<String>}
     */
    async getStaleSymbols(maxAgeHours = 168) { // 7 days (weekly)
        // Get all active stock symbols
        const activeSymbols = await Stock.find({
            currentPrice: { $ne: null }
        }).distinct('symbol');

        // Find fundamentals that are stale
        const staleFundamentals = await StockFundamental.findStale(maxAgeHours);
        const staleSymbols = staleFundamentals.map(f => f.symbol);

        // Symbols that don't have fundamentals at all
        const missingSymbols = activeSymbols.filter(
            s => !staleSymbols.includes(s)
        );

        const allStale = [...new Set([...staleSymbols, ...missingSymbols])];

        return allStale;
    }

    /**
     * Helper: Filter null/undefined values
     * @private
     */
    _filterNonNull(obj) {
        return Object.fromEntries(
            Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined)
        );
    }

    /**
     * Helper: Assess data quality based on completeness
     * @private
     */
    _assessDataQuality(data) {
        const criticalFields = ['dividendTTM', 'sector', 'payoutRatio', 'epsGrowthYoY'];
        const criticalCount = criticalFields.filter(f => data[f] !== null && data[f] !== undefined).length;

        const totalFields = Object.keys(data).length;

        if (criticalCount >= 3 && totalFields >= 8) {
            return 'HIGH';
        } else if (criticalCount >= 2 || totalFields >= 5) {
            return 'MEDIUM';
        } else if (totalFields >= 2) {
            return 'LOW';
        }
        return 'UNKNOWN';
    }

    /**
     * Helper: Get age in hours
     * @private
     */
    _getAgeHours(lastUpdated) {
        if (!lastUpdated) return Infinity;
        const now = new Date();
        const diff = (now - new Date(lastUpdated)) / (1000 * 60 * 60);
        return Math.round(diff * 10) / 10;
    }
}

// Export singleton instance
export default new FundamentalsAggregator();
