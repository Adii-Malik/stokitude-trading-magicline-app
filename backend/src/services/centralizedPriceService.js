/**
 * Centralized Price Service
 * 
 * Core business logic for fetching PSX stock prices.
 * NOTE: Scheduling (start/stop/intervals) is now managed by Job Management System.
 * This service only contains the price-fetching logic (checkPrices method).
 */

import Stock from '../models/Stock.js';
import Position from '../models/Position.js';
import JournalEntry from '../models/JournalEntry.js';
import psxScraper from './psxScraper.js';

let serviceMonitor = null;
// Lazy load to avoid circular dependency.
// Monitoring is best-effort: if it cannot load, fall back to a no-op so that
// logging can never interrupt the price pipeline.
const NOOP_MONITOR = { log: async () => { } };
const getServiceMonitor = async () => {
  if (!serviceMonitor) {
    try {
      serviceMonitor = (await import('./serviceMonitor.js')).default;
    } catch (error) {
      console.error('⚠️ Service monitor unavailable:', error.message);
      return NOOP_MONITOR;
    }
  }
  return serviceMonitor;
};

class CentralizedPriceService {
  constructor() {
    this.lastCheckTime = null;
    this.handlers = [];
    this.isFetching = false; // Lock to prevent concurrent fetches
  }

  // Register handlers for Socket.IO broadcasting
  onUpdate(handler) {
    this.handlers.push(handler);
  }

  notifyHandlers(data) {
    this.handlers.forEach(handler => handler(data));
  }

  // Main price checking logic
  // @param {boolean} manual - True when a person asked for it rather than a schedule
  async checkPrices(manual = false) {
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

      // Set lock - prevent concurrent fetches
      this.isFetching = true;

      console.log(`\n💰 [${currentTime} PKT] ${manual ? 'Manual' : 'Automatic'} price fetch initiated`);

      // Get symbols worth a price: held positions, and the levels the journal is
      // watching. Journal symbols matter because a planned trade is usually on
      // something not yet owned, and without a fresh price its entry zone and
      // stop would never be checked.
      const positionSymbols = await Position.find({ netShares: { $gt: 0 } }).distinct('symbol');
      const journalSymbols = await JournalEntry.find({ state: { $in: ['planned', 'open'] } }).distinct('symbol');
      // Filter out null/undefined/empty symbols and ensure they're strings
      const activeSymbols = [...new Set([...positionSymbols, ...journalSymbols])]
        .filter(symbol => symbol && typeof symbol === 'string' && symbol.trim().length > 0);

      if (activeSymbols.length === 0) {
        console.log('⚠️ No active symbols to update');
        this.lastCheckTime = Date.now();
        return {
          checked: 0,
          updated: 0,
          message: 'No active symbols'
        };
      }

      console.log(`📊 Fetching ${activeSymbols.length} active symbols from PSX...`);

      // 🚀 NEW: Use bulk scraper - fetch ALL prices in ONE call
      const priceResults = {};
      const errors = [];
      let successCount = 0;
      let failedCount = 0;

      try {
        // Fetch all prices using bulk method
        const bulkResult = await psxScraper.getStockPricesForSymbols(activeSymbols);

        // Process successful results
        for (const stockData of bulkResult.success) {
          priceResults[stockData.symbol] = stockData;
          successCount++;
        }

        // Track symbols not found
        for (const symbol of bulkResult.notFound) {
          errors.push({ symbol, error: 'Symbol not found' });
          failedCount++;
        }

      } catch (error) {
        console.error(`⚠️ Bulk scraper error: ${error.message}`);

        // Fallback to one-by-one method
        for (const symbol of activeSymbols) {
          try {
            const stockData = await psxScraper.getStockPrice(symbol);
            if (stockData && stockData.price) {
              priceResults[symbol] = stockData;
              successCount++;
            }
          } catch (err) {
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
            // It does happen: the journal accepts any symbol you can type, and a
            // level on a name never held has no Stock row. Dropping the price we
            // just fetched would leave that level permanently unwatched.
            await Stock.create({
              symbol,
              companyName: stockData.companyName || symbol,
              currentPrice: stockData.price,
              previousPrice: stockData.previousClose || null,
              priceChange: stockData.change || null,
              priceChangePercent: stockData.changePercent || null,
              high: stockData.high || null,
              low: stockData.low || null,
              open: stockData.open || null,
              volume: stockData.volume || null,
              lastUpdated: now
            });
            stocksUpdated++;
            console.log(`  + ${symbol} added to Stock`);
          }
        } catch (error) {
          console.error(`  ✗ Error updating ${symbol} in Stock:`, error.message);
          errors.push({ symbol, error: error.message });
        }
      }

      const duration = Date.now() - startTime;
      const durationSec = (duration / 1000).toFixed(2);
      console.log(`✅ Price update complete: ${successCount}/${activeSymbols.length} symbols updated in ${durationSec}s${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);

      this.lastCheckTime = Date.now();

      // Log to service monitor
      const monitor = await getServiceMonitor();
      await monitor.log(
        'pricePolling',
        failedCount === activeSymbols.length ? 'error' : (failedCount > 0 ? 'warning' : 'success'),
        `Updated ${successCount}/${activeSymbols.length} symbols`,
        {
          checked: activeSymbols.length,
          updated: stocksUpdated,
          failed: failedCount,
          errors: errors.slice(0, 5) // Log first 5 errors only
        },
        duration
      );

      // Notify handlers (for Socket.IO broadcasting)
      this.notifyHandlers({
        type: 'priceUpdate',
        data: {
          checked: activeSymbols.length,
          updated: stocksUpdated,
          updatedSymbols: activeSymbols, // Include symbols for portfolio handler
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

      // Log error to service monitor
      const monitor = await getServiceMonitor();
      await monitor.log('pricePolling', 'error', error.message, { stack: error.stack });

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
      isFetching: this.isFetching,
      lastCheckTime: this.lastCheckTime,
      lastCheckAgo: this.lastCheckTime ? Date.now() - this.lastCheckTime : null
    };
  }
}

// Export singleton instance
const centralizedPriceService = new CentralizedPriceService();
export default centralizedPriceService;

