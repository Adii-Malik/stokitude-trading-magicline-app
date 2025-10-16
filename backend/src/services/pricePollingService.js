import psxScraper from './psxScraper.js';
import db from '../db/database.js';
import config from '../config/config.js';
import marketHoursService from './marketHoursService.js';

class PricePollingService {
  constructor() {
    this.pollingInterval = 60000; // 60 seconds default (15 min for market hours)
    this.isPolling = false;
    this.pollingTimer = null;
    this.failureCount = new Map();
    this.maxFailures = 3;
    this.messageHandlers = [];
    this.skipCount = 0; // Track how many times we skipped due to market closed
    
    // Smart caching to prevent excessive scraping
    this.lastFetchTime = null;
    this.isFetching = false; // Mutex lock
    this.cacheDuration = config.cacheDuration; // 30 minutes default
  }

  /**
   * Start polling for price updates
   * @param {number} interval - Polling interval in milliseconds (default: 60000)
   */
  start(interval = 60000) {
    if (this.isPolling) {
      console.log('🔄 Price polling already running...');
      return;
    }

    this.pollingInterval = interval;
    this.isPolling = true;

    console.log(`✅ Starting on-demand price fetch service`);
    console.log(`📊 Data Source: PSX Official (dps.psx.com.pk) - Closing Prices`);

    // Start polling immediately
    this.poll();

    // Then poll at regular intervals
    this.pollingTimer = setInterval(() => {
      this.poll();
    }, this.pollingInterval);
  }

  /**
   * Stop polling
   */
  stop() {
    if (!this.isPolling) {
      return;
    }

    console.log('⏹️ Stopping price polling service...');
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.isPolling = false;
  }

  /**
   * Perform one polling cycle
   */
  async poll() {
    try {
      const currentTime = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour12: false });
      
      // Check if market is open
      if (!marketHoursService.isMarketOpen()) {
        this.skipCount++;
        const status = marketHoursService.getMarketStatus();
        
        // Log every 4th skip (every hour if checking every 15 min)
        if (this.skipCount % 4 === 1) {
          console.log(`\n⏸️  [${currentTime} PKT] Magic Line - Market is ${status.status}`);
          console.log(`   ${status.message}`);
          if (status.nextOpen) {
            console.log(`   Next opening: ${status.nextOpen} PKT`);
          }
        }
        
        return;
      }
      
      // Reset skip counter when market is open
      this.skipCount = 0;

      const symbols = await db.getAllSymbols();

      if (symbols.length === 0) {
        console.log('⚠️ No symbols loaded for polling');
        return;
      }

      console.log(`\n📊 [${currentTime} PKT] Magic Line - Polling prices for ${symbols.length} symbols...`);
      console.log(`   ✅ Market is OPEN - Fetching live prices`);

      let successCount = 0;
      let failureCount = 0;
      const batchSize = 5; // Process 5 symbols at a time

      // Process symbols in batches
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (symbolInfo) => {
          try {
            const data = await this.fetchPriceWithFallback(symbolInfo.symbol);
            
            if (data && data.price !== null) {
              await db.updatePrice(symbolInfo.symbol, data);
              this.notifyHandlers({
                type: 'priceUpdate',
                data: {
                  symbol: symbolInfo.symbol,
                  ...data
                }
              });
              
              successCount++;
              this.resetFailureCount(symbolInfo.symbol);
            } else {
              failureCount++;
              this.incrementFailureCount(symbolInfo.symbol);
            }
          } catch (error) {
            console.error(`❌ Error polling ${symbolInfo.symbol}:`, error.message);
            failureCount++;
            this.incrementFailureCount(symbolInfo.symbol);
          }
        }));

        // Small delay between batches
        if (i + batchSize < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Polling complete: ${successCount} success, ${failureCount} failed`);

    } catch (error) {
      console.error('❌ Error in polling cycle:', error);
    }
  }

  /**
   * Fetch price from PSX
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Stock data
   */
  async fetchPriceWithFallback(symbol) {
    try {
      const data = await psxScraper.getStockPrice(symbol);
      if (data && data.price !== null) {
        console.log(`✅ [PSX] ${symbol}: ${data.price}`);
        return data;
      }
      throw new Error(`No price data found for ${symbol}`);
    } catch (error) {
      console.log(`❌ PSX failed for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if fetch is needed based on cache duration
   */
  isFetchNeeded() {
    if (!this.lastFetchTime) {
      return true; // Never fetched before
    }
    
    const timeSinceLastFetch = Date.now() - this.lastFetchTime;
    return timeSinceLastFetch >= this.cacheDuration;
  }

  /**
   * Get time remaining until next fetch is allowed
   */
  getTimeUntilNextFetch() {
    if (!this.lastFetchTime) {
      return 0;
    }
    
    const timeSinceLastFetch = Date.now() - this.lastFetchTime;
    const remaining = this.cacheDuration - timeSinceLastFetch;
    return Math.max(0, Math.ceil(remaining / 1000)); // Return seconds
  }

  /**
   * Smart fetch - checks cache and prevents concurrent fetches
   * @returns {Promise<Object>} Result with success status and data
   */
  async fetchAllPrices() {
    // Check if already fetching (prevent concurrent requests)
    if (this.isFetching) {
      const waitTime = this.getTimeUntilNextFetch();
      console.log('⏳ Fetch already in progress, please wait...');
      return {
        success: false,
        cached: true,
        message: 'Price fetch already in progress. Please wait.',
        lastFetchTime: this.lastFetchTime,
        nextFetchIn: waitTime
      };
    }

    // Check if cache is still valid
    if (!this.isFetchNeeded()) {
      const waitTime = this.getTimeUntilNextFetch();
      const minutesAgo = Math.floor((Date.now() - this.lastFetchTime) / 60000);
      
      console.log(`💾 Using cached data (fetched ${minutesAgo} minutes ago)`);
      console.log(`⏰ Next fetch available in ${Math.ceil(waitTime / 60)} minutes`);
      
      return {
        success: true,
        cached: true,
        message: `Prices were fetched ${minutesAgo} minutes ago. Using cached data.`,
        lastFetchTime: this.lastFetchTime,
        nextFetchIn: waitTime
      };
    }

    // Start fetching
    this.isFetching = true;
    
    try {
      console.log('🔄 Fetching fresh prices from PSX...');
      await this.poll();
      
      // Update last fetch time
      this.lastFetchTime = Date.now();
      
      console.log(`✅ Prices fetched successfully at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })} PKT`);
      console.log(`⏰ Next fetch available in ${this.cacheDuration / 60000} minutes`);
      
      return {
        success: true,
        cached: false,
        message: 'Successfully fetched fresh prices from PSX',
        lastFetchTime: this.lastFetchTime,
        nextFetchIn: this.cacheDuration / 1000
      };
      
    } catch (error) {
      console.error('❌ Error fetching prices:', error);
      throw error;
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Register a message handler (for Socket.IO broadcasting)
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Notify all registered handlers
   */
  notifyHandlers(message) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('❌ Error in message handler:', error);
      }
    });
  }

  /**
   * Failure tracking
   */
  incrementFailureCount(symbol) {
    const current = this.failureCount.get(symbol) || 0;
    this.failureCount.set(symbol, current + 1);

    if (current + 1 >= this.maxFailures) {
      console.log(`⚠️ ${symbol} has failed ${current + 1} times`);
    }
  }

  resetFailureCount(symbol) {
    this.failureCount.delete(symbol);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isPolling: this.isPolling,
      pollingInterval: this.pollingInterval,
      symbolsTracked: this.failureCount.size,
      lastFetchTime: this.lastFetchTime,
      isFetching: this.isFetching,
      cacheDuration: this.cacheDuration,
      cacheValid: !this.isFetchNeeded(),
      nextFetchIn: this.getTimeUntilNextFetch()
    };
  }

  /**
   * Update polling interval
   */
  setPollingInterval(interval) {
    this.pollingInterval = interval;
    
    if (this.isPolling) {
      this.stop();
      this.start(interval);
    }
  }

  /**
   * Clear all caches
   */
  clearCache() {
    psxScraper.clearCache();
    console.log('🗑️ Scraper cache cleared');
  }
}

// Export singleton instance
export default new PricePollingService();

