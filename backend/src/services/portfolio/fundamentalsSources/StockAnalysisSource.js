/**
 * Stock Analysis Scraper Source
 * Scrapes financial ratios and growth metrics from financial analysis websites
 * Secondary source for detailed fundamental data
 */
import BaseFundamentalsSource from './BaseFundamentalsSource.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default class StockAnalysisSource extends BaseFundamentalsSource {
    constructor() {
        super();
        // Using Business Recorder as it's a reliable Pakistan-focused source
        this.baseUrl = 'https://www.brecorder.com';
    }

    getName() {
        return 'STOCK_ANALYSIS';
    }

    getPriority() {
        return 30; // Lower priority than PSX
    }

    isEnabled() {
        return process.env.ENABLE_STOCK_ANALYSIS_SCRAPER === 'true';
    }

    async getFundamentals(symbol) {
        if (!this.isEnabled()) {
            return {};
        }

        try {
            console.log(`   Fetching Stock Analysis data for ${symbol}...`);

            // Try market data page
            const url = `${this.baseUrl}/market-data/psx-stocks/${symbol}/company-profile`;
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);

            const fundamentals = {
                payoutRatio: this._parsePayoutRatio($),
                epsGrowthYoY: this._parseEPSGrowth($),
                dividendGrowth3Y: this._parseDividendGrowth($),
                debtToEquity: this._parseDebtToEquity($),
                currentRatio: this._parseCurrentRatio($),
                roe: this._parseROE($),
                dataSource: 'STOCK_ANALYSIS'
            };

            // Filter out null values
            const filtered = Object.fromEntries(
                Object.entries(fundamentals).filter(([_, v]) => v !== null && v !== undefined)
            );

            if (Object.keys(filtered).length > 1) {
                console.log(`   ✓ ${symbol}: Found ${Object.keys(filtered).length - 1} analysis metrics`);
            } else {
                console.log(`   ⚠ ${symbol}: No analysis data available`);
            }

            return filtered;

        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`   ⚠ ${symbol}: Not found in stock analysis`);
            } else {
                console.error(`   ❌ ${symbol}: Analysis scrape error -`, error.message);
            }
            return {};
        }
    }

    _parsePayoutRatio($) {
        // Parse payout ratio from financial tables
        // Implementation depends on actual HTML structure
        return this._parseFinancialMetric($, 'payout', 'dividend payout');
    }

    _parseEPSGrowth($) {
        return this._parseFinancialMetric($, 'eps growth', 'earnings growth');
    }

    _parseDividendGrowth($) {
        return this._parseFinancialMetric($, 'dividend growth', 'div growth');
    }

    _parseDebtToEquity($) {
        return this._parseFinancialMetric($, 'debt to equity', 'd/e ratio', 'debt equity');
    }

    _parseCurrentRatio($) {
        return this._parseFinancialMetric($, 'current ratio', 'liquidity ratio');
    }

    _parseROE($) {
        return this._parseFinancialMetric($, 'return on equity', 'roe');
    }

    _parseFinancialMetric($, ...keywords) {
        try {
            // Search for metric in tables
            $('table tr, .financial-metric, .ratio-item').each((i, elem) => {
                const text = $(elem).text().toLowerCase();

                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        // Extract number from the row
                        const match = text.match(/[\d.]+%?/);
                        if (match) {
                            let value = parseFloat(match[0].replace('%', ''));

                            // If percentage sign was present, return as-is, otherwise might need conversion
                            if (match[0].includes('%')) {
                                return value;
                            }
                            return value;
                        }
                    }
                }
            });
        } catch (error) {
            // Parsing failed
        }
        return null;
    }
}
