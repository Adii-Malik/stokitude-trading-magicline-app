import axios from 'axios';
import * as cheerio from 'cheerio';

class PSXScraper {
  constructor() {
    this.baseUrl = 'https://dps.psx.com.pk';
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests
  }

  /**
   * Get stock price from PSX official website
   * @param {string} symbol - Stock symbol (e.g., 'ABL', 'OGDC')
   * @returns {Promise<Object>} Stock data
   */
  async getStockPrice(symbol) {
    try {
      // Check cache first
      const cached = this.getFromCache(symbol);
      if (cached) {
        console.log(`📦 Cache hit for ${symbol}`);
        return cached;
      }

      // Rate limiting
      await this.respectRateLimit();

      console.log(`🔍 Fetching ${symbol} from PSX official...`);

      // Scrape the stock page directly (we now have correct selectors)
      const scrapedData = await this.scrapeStockPage(symbol);
      
      if (scrapedData) {
        this.saveToCache(symbol, scrapedData);
        return scrapedData;
      }

      throw new Error(`No data found for ${symbol}`);

    } catch (error) {
      console.error(`❌ PSX Scraper error for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Try to fetch from PSX summary API endpoint
   */
  async fetchFromSummaryAPI(symbol) {
    try {
      // PSX has various endpoints, trying market summary
      const response = await axios.get(`${this.baseUrl}/market-summary`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/html, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      // Try to parse JSON response
      if (response.data && typeof response.data === 'object') {
        return this.parseAPIResponse(response.data, symbol);
      }

      // If HTML, parse it
      if (typeof response.data === 'string') {
        return this.parseHTMLResponse(response.data, symbol);
      }

      return null;
    } catch (error) {
      console.log(`⚠️ PSX API fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  /**
   * Scrape stock page directly
   */
  async scrapeStockPage(symbol) {
    try {
      // PSX uses /company/{symbol} URL pattern
      const url = `${this.baseUrl}/company/${symbol}`;

      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        }
      });

      // Parse using the HTML structure
      return this.parseHTMLResponse(response.data, symbol);

    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️ ${symbol} not found on PSX (404)`);
      } else {
        console.log(`⚠️ PSX scraping failed for ${symbol}: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Parse API JSON response
   */
  parseAPIResponse(data, symbol) {
    try {
      // Look for the symbol in various possible data structures
      const symbolData = data.stocks?.find(s => 
        s.symbol?.toLowerCase() === symbol.toLowerCase()
      ) || data[symbol] || data;

      if (symbolData && symbolData.ldcp) {
        return {
          symbol: symbol.toUpperCase(),
          price: parseFloat(symbolData.ldcp),
          change: parseFloat(symbolData.change || 0),
          changePercent: parseFloat(symbolData.changePercent || 0),
          high: parseFloat(symbolData.high || symbolData.ldcp),
          low: parseFloat(symbolData.low || symbolData.ldcp),
          volume: parseInt(symbolData.volume || 0),
          open: parseFloat(symbolData.open || symbolData.ldcp),
          previousClose: parseFloat(symbolData.pclose || symbolData.ldcp),
          lastTradeTime: new Date().toISOString(),
          source: 'psx-api'
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse HTML response from PSX stock page
   */
  parseHTMLResponse(html, symbol) {
    try {
      const $ = cheerio.load(html);
      
      // Extract current price from .quote__close
      const priceText = $('.quote__close').first().text().trim().replace(/Rs\.|,/g, '');
      const price = parseFloat(priceText);
      
      if (!price || isNaN(price) || price <= 0) {
        console.log(`⚠️ Could not parse price from PSX HTML for ${symbol}`);
        return null;
      }

      // Extract change value
      const changeText = $('.change__value').first().text().trim().replace(/,/g, '');
      const change = parseFloat(changeText) || 0;

      // Extract change percent
      const changePercentText = $('.change__percent').first().text().trim().replace(/[()%]/g, '');
      const changePercent = parseFloat(changePercentText) || 0;

      // Extract stats (Open, High, Low, Volume)
      const stats = {
        open: null,
        high: null,
        low: null,
        volume: null
      };

      $('.stats_item').each((i, el) => {
        const label = $(el).find('.stats_label').text().trim().toLowerCase();
        const value = $(el).find('.stats_value').text().trim().replace(/,/g, '');
        
        if (label === 'open') {
          stats.open = parseFloat(value);
        } else if (label === 'high') {
          stats.high = parseFloat(value);
        } else if (label === 'low') {
          stats.low = parseFloat(value);
        } else if (label === 'volume') {
          stats.volume = parseInt(value);
        }
      });

      const data = {
        symbol: symbol.toUpperCase(),
        price: price,
        change: change,
        changePercent: changePercent,
        high: stats.high || price,
        low: stats.low || price,
        volume: stats.volume || 0,
        open: stats.open || price,
        previousClose: price - change,
        lastTradeTime: new Date().toISOString(),
        source: 'psx-html'
      };

      return data;

    } catch (error) {
      console.error(`❌ Error parsing PSX HTML for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Parse stock page HTML with cheerio
   */
  parseStockHTML(html, symbol) {
    const $ = cheerio.load(html);
    
    // This is a generic parser - may need adjustment based on actual PSX HTML structure
    const data = {
      symbol: symbol.toUpperCase(),
      price: null,
      change: null,
      changePercent: null,
      high: null,
      low: null,
      volume: null,
      open: null,
      source: 'psx-scrape'
    };

    // Try to find price in various ways
    $('td, div, span').each((i, el) => {
      const text = $(el).text().trim();
      const prevText = $(el).prev().text().trim().toLowerCase();
      
      // Look for patterns like "Last Price: 123.45"
      if (prevText.includes('last') || prevText.includes('current')) {
        const num = parseFloat(text.replace(/[^\d.]/g, ''));
        if (!isNaN(num) && num > 0) {
          data.price = num;
        }
      }
      
      if (prevText.includes('high')) {
        data.high = parseFloat(text.replace(/[^\d.]/g, ''));
      }
      
      if (prevText.includes('low')) {
        data.low = parseFloat(text.replace(/[^\d.]/g, ''));
      }
      
      if (prevText.includes('volume')) {
        data.volume = parseInt(text.replace(/[^\d]/g, ''));
      }
    });

    return data.price ? data : null;
  }

  /**
   * 🚀 NEW: Fetch ALL stock prices from market-watch page in ONE call
   * Much more efficient than fetching one by one
   * Source: https://dps.psx.com.pk/market-watch
   */
  async getAllStockPrices() {
    try {
      console.log('🌐 Fetching ALL stock prices from market-watch...');
      
      const url = `${this.baseUrl}/market-watch`;
      
      const response = await axios.get(url, {
        timeout: 20000, // 20 seconds (large page)
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        }
      });

      // Parse the HTML table
      const $ = cheerio.load(response.data);
      const stockPrices = new Map();
      
      // Find all rows in the table
      // The table has columns: SYMBOL | SECTOR | LISTED IN | LDCP | OPEN | HIGH | LOW | CURRENT | CHANGE | CHANGE (%) | VOLUME
      $('table tr').each((i, row) => {
        try {
          const cells = $(row).find('td');
          
          if (cells.length >= 8) {
            // Extract symbol (first column, might have link)
            const symbolElement = $(cells[0]).find('a').first();
            const symbol = symbolElement.text().trim().toUpperCase();
            
            if (!symbol || symbol.length === 0) return; // Skip empty rows
            
            // Extract prices from correct columns
            const ldcp = parseFloat($(cells[3]).text().trim().replace(/,/g, '')) || null;
            const open = parseFloat($(cells[4]).text().trim().replace(/,/g, '')) || null;
            const high = parseFloat($(cells[5]).text().trim().replace(/,/g, '')) || null;
            const low = parseFloat($(cells[6]).text().trim().replace(/,/g, '')) || null;
            const current = parseFloat($(cells[7]).text().trim().replace(/,/g, '')) || null;
            const change = parseFloat($(cells[8]).text().trim().replace(/,/g, '')) || null;
            
            // Parse changePercent - try both text and data attributes
            let changePercent = null;
            const changePercentText = $(cells[9]).text().trim().replace(/[%,]/g, '');
            const changePercentData = $(cells[9]).attr('data-value') || $(cells[9]).attr('data-percent');
            
            if (changePercentData) {
              changePercent = parseFloat(changePercentData.replace(/[%,]/g, ''));
            } else if (changePercentText) {
              changePercent = parseFloat(changePercentText);
            }
            
            const volume = parseInt($(cells[10]).text().trim().replace(/,/g, '')) || null;
            
            // Debug log for first few symbols to see what we're getting
            if (stockPrices.size < 3) {
              console.log(`   📝 ${symbol}: current=${current}, change=${change}, changePercent=${changePercent} (text="${$(cells[9]).text().trim()}", data="${changePercentData}")`);
            }
            
            // Current price is what we need
            if (current && current > 0) {
              stockPrices.set(symbol, {
                symbol,
                price: current,
                previousClose: ldcp,
                open,
                high,
                low,
                change,
                changePercent,
                volume,
                lastTradeTime: new Date().toISOString(),
                source: 'psx-market-watch'
              });
            }
          }
        } catch (error) {
          // Skip problematic rows
        }
      });
      
      console.log(`✅ Scraped ${stockPrices.size} stock prices from market-watch`);
      return stockPrices;
      
    } catch (error) {
      console.error('❌ Error scraping market-watch:', error.message);
      throw new Error(`Failed to fetch market-watch data: ${error.message}`);
    }
  }

  /**
   * Fetch prices for specific symbols using bulk market-watch data
   * This is the NEW recommended method - much faster than one-by-one
   */
  async getStockPricesForSymbols(symbols) {
    try {
      // Fetch all prices in one call
      const allPrices = await this.getAllStockPrices();
      
      const results = [];
      const notFound = [];
      
      for (const symbol of symbols) {
        const symbolUpper = symbol.toUpperCase();
        const priceData = allPrices.get(symbolUpper);
        
        if (priceData) {
          results.push(priceData);
        } else {
          notFound.push(symbolUpper);
        }
      }
      
      if (notFound.length > 0) {
        console.log(`⚠️ ${notFound.length} symbols not found in market-watch: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? '...' : ''}`);
      }
      
      return {
        success: results,
        notFound
      };
      
    } catch (error) {
      console.error('❌ Error in getStockPricesForSymbols:', error.message);
      throw error;
    }
  }

  /**
   * Fetch multiple stocks at once (OLD method - kept for backward compatibility)
   * @deprecated Use getStockPricesForSymbols() instead - much faster
   */
  async getMultipleStocks(symbols) {
    const results = [];
    
    for (const symbol of symbols) {
      try {
        const data = await this.getStockPrice(symbol);
        results.push(data);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        results.push({
          symbol: symbol.toUpperCase(),
          error: error.message,
          price: null,
          source: 'psx-error'
        });
      }
    }

    return results;
  }

  /**
   * Rate limiting
   */
  async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Cache management
   */
  getFromCache(symbol) {
    const cached = this.cache.get(symbol.toUpperCase());
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  saveToCache(symbol, data) {
    this.cache.set(symbol.toUpperCase(), {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

export default new PSXScraper();

