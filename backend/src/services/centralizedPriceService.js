import Stock from '../models/Stock.js';
import MagicLine from '../models/MagicLine.js';
import TradePlan from '../models/TradePlan.js';
import psxScraper from './psxScraper.js';
import marketHoursService from './marketHoursService.js';

class CentralizedPriceService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.lastCheckTime = null;
    this.handlers = [];
    this.skipCount = 0;
    this.MAX_SKIPS = 4; // Log status every 4 skips
    this.isFetching = false; // Lock to prevent concurrent fetches
  }

  // Register handlers for Socket.IO broadcasting
  onUpdate(handler) {
    this.handlers.push(handler);
  }

  notifyHandlers(data) {
    this.handlers.forEach(handler => handler(data));
  }

  // Start polling at specified interval
  start(intervalMinutes = 15) {
    if (this.isRunning) {
      console.log('⚠️ Centralized price service is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`\n🚀 Starting Centralized Price Polling Service`);
    console.log(`   Interval: Every ${intervalMinutes} minutes`);
    console.log(`   Market Hours: Mon-Thu 9:15 AM - 3:30 PM PKT, Fri 9:15 AM - 12:00 PM & 2:30 PM - 4:30 PM PKT`);

    // Run immediately on start
    this.checkPrices();

    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.checkPrices();
    }, intervalMs);
  }

  // Stop polling
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Centralized price service stopped');
  }

  // Main price checking logic
  // @param {boolean} skipMarketCheck - If true, fetch prices regardless of market hours (for manual refresh)
  async checkPrices(skipMarketCheck = false) {
    const startTime = Date.now();
    const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });

    try {
      // Check if already fetching (prevent concurrent requests)
      if (this.isFetching) {
        console.log(`\n⚠️ [${currentTime} PKT] Price fetch already in progress, skipping...`);
        return {
          skipped: true,
          reason: 'already_fetching',
          message: 'Price fetch already in progress'
        };
      }
      
      // Check if market is open (unless skipped for manual refresh)
      const status = marketHoursService.isMarketOpen();
      
      if (!skipMarketCheck && !status.isOpen) {
        this.skipCount++;
        if (this.skipCount >= this.MAX_SKIPS) {
          console.log(`\n⏸️ [${currentTime} PKT] Market is ${status.status.toUpperCase()}`);
          console.log(`   ${status.message}`);
          console.log(`   Skipping price check (checked ${this.skipCount} times while closed)`);
          this.skipCount = 0;
        }
        
        return {
          skipped: true,
          reason: 'market_closed',
          status: status.status,
          message: status.message
        };
      }
      
      // Set lock - prevent concurrent fetches
      this.isFetching = true;
      
      // Reset skip counter when market is open
      this.skipCount = 0;
      
      if (skipMarketCheck) {
        console.log(`\n💪 [${currentTime} PKT] MANUAL REFRESH - Fetching prices (market check bypassed)`);
      } else {
        console.log(`\n💰 [${currentTime} PKT] Fetching centralized stock prices...`);
        console.log(`   ✅ Market is OPEN - Updating price database`);
      }

      // 🎯 SMART STRATEGY: Only fetch prices for symbols actively in use
      // Get symbols from active trade plans
      const tradePlanSymbols = await TradePlan.find({ isActive: true }).distinct('symbol');
      
      // Get symbols from active magic line entries
      const magicLineSymbols = await MagicLine.find({ isActive: true }).distinct('symbol');
      
      // Combine and deduplicate
      const activeSymbols = [...new Set([...tradePlanSymbols, ...magicLineSymbols])];
      
      if (activeSymbols.length === 0) {
        console.log('⚠️ No active symbols found');
        console.log('   No active trade plans or magic line symbols to update');
        this.lastCheckTime = Date.now();
        return {
          checked: 0,
          updated: 0,
          message: 'No active symbols to update'
        };
      }
      
      console.log(`📊 Active symbols breakdown:`);
      console.log(`   📈 Trade Plans: ${tradePlanSymbols.length} symbols`);
      console.log(`   🎯 Magic Lines: ${magicLineSymbols.length} symbols`);
      console.log(`   ✨ Total Unique: ${activeSymbols.length} symbols`);

      console.log(`🌐 Fetching prices using BULK market-watch scraper (1 call for all symbols)...`);

      // 🚀 NEW: Use bulk scraper - fetch ALL prices in ONE call
      const priceResults = {};
      const errors = [];
      let successCount = 0;
      let failedCount = 0;
      
      try {
        // Fetch all prices using the new bulk method
        const bulkResult = await psxScraper.getStockPricesForSymbols(activeSymbols);
        
        // Process successful results
        for (const stockData of bulkResult.success) {
          priceResults[stockData.symbol] = stockData; // ✅ Store full data, not just price
          successCount++;
          
          // Log for small batches or first few stocks
          if (activeSymbols.length <= 10 || successCount <= 5) {
            console.log(`  ✓ ${stockData.symbol}: Rs. ${stockData.price}`);
          }
        }
        
        // Track symbols not found
        for (const symbol of bulkResult.notFound) {
          errors.push({ symbol, error: 'Symbol not found in market-watch' });
          failedCount++;
        }
        
      } catch (error) {
        // Fallback to old method if bulk scraper fails
        console.error(`⚠️ Bulk scraper failed, falling back to one-by-one method: ${error.message}`);
        
        for (const symbol of activeSymbols) {
          try {
            const stockData = await psxScraper.getStockPrice(symbol);
            
            if (stockData && stockData.price) {
              priceResults[symbol] = stockData; // ✅ Store full data, not just price
              successCount++;
              
              if (activeSymbols.length <= 10 || successCount <= 5) {
                console.log(`  ✓ ${symbol}: Rs. ${stockData.price}`);
              }
            }
          } catch (err) {
            console.error(`  ✗ ${symbol}: Failed - ${err.message}`);
            errors.push({ symbol, error: err.message });
            failedCount++;
          }
        }
      }

      // Update Stock model (central price storage)
      let stocksUpdated = 0;
      const now = new Date();

      for (const symbol of activeSymbols) {
        const stockData = priceResults[symbol];
        if (!stockData) continue;

        try {
          const stock = await Stock.findOne({ symbol });
          
          if (stock) {
            const newPrice = stockData.price;
            
            // ✅ Use data from PSX scraper (don't calculate, use what PSX provides)
            stock.previousPrice = stockData.previousClose || stock.previousPrice;
            stock.currentPrice = newPrice;
            stock.priceChange = stockData.change || null;  // ✅ From scraper
            stock.priceChangePercent = stockData.changePercent || null;  // ✅ From scraper (today's change)
            // ✅ Save additional trading data
            stock.high = stockData.high || null;
            stock.low = stockData.low || null;
            stock.open = stockData.open || null;
            stock.volume = stockData.volume || null;
            stock.lastUpdated = now;
            
            await stock.save();
            stocksUpdated++;
          } else {
            // Stock doesn't exist in database - this shouldn't happen for active symbols
            console.warn(`  ⚠️ ${symbol} not found in Stock database`);
          }
        } catch (error) {
          console.error(`  ✗ Error updating ${symbol} in Stock:`, error.message);
          errors.push({ symbol, error: error.message });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Centralized price update complete in ${duration}s`);
      console.log(`   📊 Active Symbols Checked: ${activeSymbols.length}`);
      console.log(`   🔄 Database Records Updated: ${stocksUpdated}`);
      console.log(`   ✅ Successfully Fetched: ${successCount}`);
      if (failedCount > 0) console.log(`   ❌ Failed: ${failedCount}`);
      console.log(`   ⚡ Method: Bulk market-watch scraper (1 HTTP call)`);

      this.lastCheckTime = Date.now();

      // Notify handlers (for Socket.IO broadcasting)
      this.notifyHandlers({
        type: 'priceUpdate',
        data: {
          checked: activeSymbols.length,
          updated: stocksUpdated,
          timestamp: now,
          errors
        }
      });

      return {
        checked: activeSymbols.length,
        updated: stocksUpdated,
        errors
      };
    } catch (error) {
      console.error('❌ Error in centralized price service:', error);
      return {
        error: error.message
      };
    } finally {
      // Release lock - allow next fetch
      this.isFetching = false;
    }
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      isFetching: this.isFetching,
      lastCheckTime: this.lastCheckTime,
      lastCheckAgo: this.lastCheckTime ? Date.now() - this.lastCheckTime : null
    };
  }
}

// Export singleton instance
const centralizedPriceService = new CentralizedPriceService();
export default centralizedPriceService;

