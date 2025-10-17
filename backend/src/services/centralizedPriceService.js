import Stock from '../models/Stock.js';
import Symbol from '../models/Symbol.js';
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
  async checkPrices() {
    const startTime = Date.now();
    const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });

    try {
      // Check if market is open
      const status = marketHoursService.isMarketOpen();
      
      if (!status.isOpen) {
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
      
      // Reset skip counter when market is open
      this.skipCount = 0;
      
      console.log(`\n💰 [${currentTime} PKT] Fetching centralized stock prices...`);
      console.log(`   ✅ Market is OPEN - Updating price database`);

      // Get all unique symbols that need price updates
      const [magicLineSymbols, tradePlanSymbols] = await Promise.all([
        Symbol.find({ isActive: true }).distinct('symbol'),
        TradePlan.find({ isActive: true }).distinct('symbol')
      ]);

      const allSymbols = [...new Set([...magicLineSymbols, ...tradePlanSymbols])];
      
      if (allSymbols.length === 0) {
        console.log('ℹ️ No active symbols to check');
        this.lastCheckTime = Date.now();
        return {
          checked: 0,
          updated: 0
        };
      }

      console.log(`📊 Found ${allSymbols.length} unique symbols to update`);

      // Fetch prices from PSX
      const priceResults = {};
      const errors = [];
      
      for (const symbol of allSymbols) {
        try {
          const stockData = await psxScraper.getStockPrice(symbol);
          priceResults[symbol] = stockData.price;
          console.log(`  ✓ ${symbol}: Rs. ${stockData.price}`);
        } catch (error) {
          console.error(`  ✗ ${symbol}: ${error.message}`);
          errors.push({ symbol, error: error.message });
        }
      }

      // Update Stock model (central price storage)
      let stocksUpdated = 0;
      const now = new Date();

      for (const symbol of allSymbols) {
        const newPrice = priceResults[symbol];
        if (!newPrice) continue;

        try {
          const stock = await Stock.findOne({ symbol });
          
          if (stock) {
            // Calculate price change
            const previousPrice = stock.currentPrice || newPrice;
            const priceChange = newPrice - previousPrice;
            const priceChangePercent = previousPrice !== 0 
              ? ((priceChange / previousPrice) * 100) 
              : 0;

            // Update stock with new price
            stock.previousPrice = stock.currentPrice || newPrice;
            stock.currentPrice = newPrice;
            stock.priceChange = priceChange;
            stock.priceChangePercent = priceChangePercent;
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
      console.log(`   📊 Checked: ${allSymbols.length} symbols`);
      console.log(`   🔄 Updated: ${stocksUpdated} stocks`);
      if (errors.length > 0) console.log(`   ⚠️ Errors: ${errors.length}`);

      this.lastCheckTime = Date.now();

      // Notify handlers (for Socket.IO broadcasting)
      this.notifyHandlers({
        type: 'priceUpdate',
        data: {
          checked: allSymbols.length,
          updated: stocksUpdated,
          timestamp: now,
          errors
        }
      });

      return {
        checked: allSymbols.length,
        updated: stocksUpdated,
        errors
      };
    } catch (error) {
      console.error('❌ Error in centralized price service:', error);
      return {
        error: error.message
      };
    }
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheckTime: this.lastCheckTime,
      lastCheckAgo: this.lastCheckTime ? Date.now() - this.lastCheckTime : null
    };
  }
}

// Export singleton instance
const centralizedPriceService = new CentralizedPriceService();
export default centralizedPriceService;

