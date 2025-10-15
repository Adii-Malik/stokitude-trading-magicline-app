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

      console.log(`✅ Parsed ${symbol} from PSX HTML: ${price}`);
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
   * Fetch multiple stocks at once (more efficient)
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

