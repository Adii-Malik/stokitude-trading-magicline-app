import axios from 'axios';
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import PsxDaily from '../models/PsxDaily.js';
import Stock from '../models/Stock.js';

class HistoricalDataScraper {
    constructor() {
        this.baseUrl = 'https://www.ksestocks.com';
        this.minDelay = 2500; // 2.5 seconds between requests to avoid blocking
        this.lastRequestTime = 0;
    }

    /**
     * Rate limiting helper
     */
    async respectRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minDelay) {
            const delay = this.minDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Scrape single date for a symbol from Market Summary (POST request)
     * @param {String} symbol - Stock symbol
     * @param {String} date - Date in YYYY-MM-DD format
     * @returns {Object} - Scraped data or null
     */
    async scrapeDate(symbol, date) {
        try {
            await this.respectRateLimit();

            // Market Summary uses POST request with form data
            const url = `${this.baseUrl}/MarketSummary`;

            const formData = new URLSearchParams();
            formData.append('sdate', date);

            const response = await axios.post(url, formData, {
                timeout: 15000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': `${this.baseUrl}/MarketSummary`
                }
            });

            const $ = cheerio.load(response.data);

            // Find the row for this symbol in the table
            let symbolData = null;

            // Search through all sector tables (DailyQuotations uses similar structure)
            $('table tbody tr, table tr').each((index, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 8) {
                    const rowSymbol = $(cells[0]).text().trim();

                    if (rowSymbol.toUpperCase() === symbol.toUpperCase()) {
                        // DailyQuotations: Symbol, Company, Open, High, Low, Close, Change, Volume
                        const open = parseFloat($(cells[2]).text().trim().replace(/,/g, ''));
                        const high = parseFloat($(cells[3]).text().trim().replace(/,/g, ''));
                        const low = parseFloat($(cells[4]).text().trim().replace(/,/g, ''));
                        const close = parseFloat($(cells[5]).text().trim().replace(/,/g, ''));
                        const volume = parseInt($(cells[7]).text().trim().replace(/,/g, '')) || 0;

                        if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
                            symbolData = {
                                symbol: symbol.toUpperCase(),
                                date: new Date(date),
                                open,
                                high,
                                low,
                                close,
                                volume
                            };
                        }
                        return false; // Stop iteration
                    }
                }
            });

            if (symbolData && this.validateData(symbolData)) {
                console.log(`✅ Found data for ${symbol} on ${date}: O=${symbolData.open}, H=${symbolData.high}, L=${symbolData.low}, C=${symbolData.close}`);
                return symbolData;
            }

            return null;
        } catch (error) {
            if (error.response?.status === 404) {
                console.error(`❌ No data for ${symbol} on ${date} (404)`);
            } else {
                console.error(`❌ Error scraping ${symbol} for ${date}:`, error.message);
            }
            return null;
        }
    }

    /**
     * Scrape date range for a symbol
     */
    async scrapeDateRange(symbol, startDate, endDate, onProgress) {
        const results = {
            success: [],
            failed: [],
            total: 0
        };

        let current = dayjs(startDate);
        const end = dayjs(endDate);

        while (current.isBefore(end) || current.isSame(end)) {
            // Skip weekends
            if (current.day() !== 0 && current.day() !== 6) {
                const dateStr = current.format('YYYY-MM-DD');
                const data = await this.scrapeDate(symbol, dateStr);

                results.total++;

                if (data) {
                    results.success.push(data);
                } else {
                    results.failed.push({ date: dateStr, error: 'Failed to scrape' });
                }

                // Report progress
                if (onProgress) {
                    onProgress({
                        symbol,
                        date: dateStr,
                        completed: results.success.length,
                        failed: results.failed.length,
                        total: results.total
                    });
                }
            }

            current = current.add(1, 'day');
        }

        return results;
    }

    /**
     * Validate scraped OHLCV data
     */
    validateData(data) {
        if (!data || !data.symbol || !data.date) {
            return false;
        }

        const { open, high, low, close, volume } = data;

        // All prices must be positive
        if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
            return false;
        }

        // High must be >= all prices
        if (high < open || high < close) {
            return false;
        }

        // Low must be <= all prices
        if (low > open || low > close) {
            return false;
        }

        // High must be >= Low
        if (high < low) {
            return false;
        }

        // Volume should be non-negative
        if (volume < 0) {
            return false;
        }

        return true;
    }
}

export default new HistoricalDataScraper();
