/**
 * PSX Scraper Source
 * Scrapes fundamental data from Pakistan Stock Exchange website
 * Primary automated source for company information
 */
import BaseFundamentalsSource from './BaseFundamentalsSource.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default class PSXScraperSource extends BaseFundamentalsSource {
    constructor() {
        super();
        this.baseUrl = 'https://dps.psx.com.pk';
    }

    getName() {
        return 'PSX_SCRAPER';
    }

    getPriority() {
        return 50; // Medium priority
    }

    isEnabled() {
        return process.env.ENABLE_PSX_FUNDAMENTALS_SCRAPER !== 'false';
    }

    async getFundamentals(symbol) {
        if (!this.isEnabled()) {
            return {};
        }

        try {
            console.log(`   Fetching PSX fundamentals for ${symbol}...`);

            // Try company profile page
            const url = `${this.baseUrl}/company/${symbol}`;
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);

            const fundamentals = {
                dividendTTM: this._parseDividend($),
                sector: this._parseSector($),
                industry: this._parseIndustry($),
                marketCap: this._parseMarketCap($),
                dataSource: 'PSX'
            };

            // Filter out null values
            const filtered = Object.fromEntries(
                Object.entries(fundamentals).filter(([_, v]) => v !== null && v !== undefined)
            );

            if (Object.keys(filtered).length > 1) { // More than just dataSource
                console.log(`   ✓ ${symbol}: Found ${Object.keys(filtered).length - 1} PSX metrics`);
            } else {
                console.log(`   ⚠ ${symbol}: No PSX data available`);
            }

            return filtered;

        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`   ⚠ ${symbol}: Not found on PSX`);
            } else {
                console.error(`   ❌ ${symbol}: PSX scrape error -`, error.message);
            }
            return {};
        }
    }

    _parseDividend($) {
        try {
            // Look for dividend information in common locations
            const divText = $('.dividend-info, .dividend-amount, [class*="dividend"]')
                .first()
                .text()
                .trim();

            if (divText) {
                const match = divText.match(/[\d.]+/);
                if (match) {
                    return parseFloat(match[0]);
                }
            }
        } catch (error) {
            // Parsing failed
        }
        return null;
    }

    _parseSector($) {
        try {
            const sectorText = $('.sector-name, .company-sector, [class*="sector"]')
                .first()
                .text()
                .trim();

            return sectorText || null;
        } catch (error) {
            return null;
        }
    }

    _parseIndustry($) {
        try {
            const industryText = $('.industry-name, .company-industry, [class*="industry"]')
                .first()
                .text()
                .trim();

            return industryText || null;
        } catch (error) {
            return null;
        }
    }

    _parseMarketCap($) {
        try {
            const capText = $('.market-cap, .marketcap, [class*="marketcap"]')
                .first()
                .text()
                .trim();

            if (capText) {
                // Remove non-numeric except decimals
                const cleaned = capText.replace(/[^0-9.]/g, '');
                const value = parseFloat(cleaned);

                // Convert to millions if needed (check for 'B' for billions)
                if (capText.includes('B') || capText.includes('billion')) {
                    return value * 1000; // Convert to millions
                }

                return value || null;
            }
        } catch (error) {
            return null;
        }
        return null;
    }
}
