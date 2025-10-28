import axios from 'axios';

/**
 * StockAnalysis.com API Scraper
 * Fetches historical OHLCV data with adjusted close prices
 * Source: https://stockanalysis.com
 */

const BASE_URL = 'https://stockanalysis.com/api/symbol/a';
const RANGE = '10Y'; // 10 years of data

/**
 * Fetch historical data for a symbol
 * @param {string} symbol - Stock symbol (e.g., 'MARI')
 * @param {string} period - 'Daily', 'Weekly', or 'Monthly'
 * @returns {Promise<Object>} - { success: array, failed: array, total: number }
 */
async function fetchHistoricalData(symbol, period = 'Daily') {
    const url = `${BASE_URL}/PSX-${symbol}/history?range=${RANGE}&period=${period}`;
    
    try {
        console.log(`📥 Fetching ${period} data for ${symbol} from StockAnalysis.com...`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 30000
        });

        if (response.data && response.data.status === 200 && Array.isArray(response.data.data)) {
            const data = response.data.data;
            
            // Transform to our schema
            const transformed = data.map(row => {
                const dateField = period === 'Daily' ? 'date' : 
                                period === 'Weekly' ? 'weekStart' : 'monthStart';
                
                return {
                    symbol: symbol.toUpperCase(),
                    [dateField]: new Date(row.t),
                    open: parseFloat(row.o),
                    high: parseFloat(row.h),
                    low: parseFloat(row.l),
                    close: parseFloat(row.c),
                    adjClose: row.a ? parseFloat(row.a) : parseFloat(row.c),
                    volume: parseInt(row.v)
                };
            });

            console.log(`✅ Fetched ${transformed.length} ${period.toLowerCase()} records for ${symbol}`);
            
            return {
                success: transformed,
                failed: [],
                total: transformed.length
            };
        } else {
            throw new Error('Invalid response format from StockAnalysis.com');
        }
    } catch (error) {
        console.error(`❌ Error fetching ${period} data for ${symbol}:`, error.message);
        
        return {
            success: [],
            failed: [{ symbol, period, error: error.message }],
            total: 0
        };
    }
}

/**
 * Fetch all timeframes for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - { daily, weekly, monthly }
 */
async function fetchAllTimeframes(symbol) {
    console.log(`\n📊 Fetching all timeframes for ${symbol}...`);
    
    const [daily, weekly, monthly] = await Promise.all([
        fetchHistoricalData(symbol, 'Daily'),
        fetchHistoricalData(symbol, 'Weekly'),
        fetchHistoricalData(symbol, 'Monthly')
    ]);

    const totalRecords = daily.success.length + weekly.success.length + monthly.success.length;
    console.log(`✅ Total records fetched for ${symbol}: ${totalRecords}`);

    return { daily, weekly, monthly };
}

/**
 * Check if symbol exists on StockAnalysis.com
 * @param {string} symbol - Stock symbol
 * @returns {Promise<boolean>}
 */
async function symbolExists(symbol) {
    try {
        const url = `${BASE_URL}/PSX-${symbol}/history?range=1D&period=Daily`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        return response.data && response.data.status === 200;
    } catch (error) {
        return false;
    }
}

export default {
    fetchHistoricalData,
    fetchAllTimeframes,
    symbolExists
};

