import psxScraper from './psxScraper.js';
import TradePlan from '../models/TradePlan.js';
import marketHoursService from './marketHoursService.js';

class TradePlanPollingService {
  constructor() {
    this.pollingInterval = 15 * 60 * 1000; // 15 minutes
    this.isPolling = false;
    this.pollingTimer = null;
    this.messageHandlers = [];
    this.lastCheckTime = null;
    this.skipCount = 0; // Track how many times we skipped due to market closed
  }

  /**
   * Start polling for trade plan price checks
   * @param {number} interval - Polling interval in milliseconds (default: 15 minutes)
   */
  start(interval = 15 * 60 * 1000) {
    if (this.isPolling) {
      console.log('🔄 Trade plan polling already running...');
      return;
    }

    this.pollingInterval = interval;
    this.isPolling = true;

    console.log(`✅ Starting Trade Plan Auto-Checker`);
    console.log(`⏰ Checking prices every ${interval / 60000} minutes`);

    // Start polling immediately
    this.checkAllTradePlans();

    // Then poll at regular intervals
    this.pollingTimer = setInterval(() => {
      this.checkAllTradePlans();
    }, this.pollingInterval);
  }

  /**
   * Stop polling
   */
  stop() {
    if (!this.isPolling) {
      return;
    }

    console.log('⏹️ Stopping trade plan polling service...');
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.isPolling = false;
  }

  /**
   * Check all active trade plans and update prices/hits
   */
  async checkAllTradePlans() {
    try {
      const startTime = Date.now();
      const currentTime = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour12: false });
      
      // Check if market is open
      if (!marketHoursService.isMarketOpen()) {
        this.skipCount++;
        const status = marketHoursService.getMarketStatus();
        
        // Log every 4th skip (every hour if checking every 15 min)
        if (this.skipCount % 4 === 1) {
          console.log(`\n⏸️  [${currentTime} PKT] Market is ${status.status}`);
          console.log(`   ${status.message}`);
          if (status.nextOpen) {
            console.log(`   Next opening: ${status.nextOpen} PKT`);
          }
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
      
      console.log(`\n🎯 [${currentTime} PKT] Checking active trade plans...`);
      console.log(`   ✅ Market is OPEN - Fetching live prices`);

      // Get all active trade plans
      const activePlans = await TradePlan.find({ isActive: true, status: 'active' });
      
      if (activePlans.length === 0) {
        console.log('ℹ️ No active trade plans to check');
        this.lastCheckTime = Date.now();
        return {
          checked: 0,
          updated: 0,
          updates: { buyHits: 0, tpHits: 0, slHits: 0 }
        };
      }

      console.log(`📊 Found ${activePlans.length} active trade plans`);

      // Get unique symbols
      const symbols = [...new Set(activePlans.map(plan => plan.symbol))];
      console.log(`🔍 Fetching prices for ${symbols.length} unique symbols...`);

      // Fetch current prices for all symbols
      const priceResults = {};
      const errors = [];
      
      for (const symbol of symbols) {
        try {
          const stockData = await psxScraper.getStockPrice(symbol);
          priceResults[symbol] = stockData.price;
          console.log(`  ✓ ${symbol}: Rs. ${stockData.price}`);
        } catch (error) {
          console.error(`  ✗ ${symbol}: ${error.message}`);
          errors.push({ symbol, error: error.message });
        }
      }

      // Track updates
      let buyHits = 0;
      let tpHits = 0;
      let slHits = 0;
      let plansUpdated = 0;
      const notifications = [];

      // Check each trade plan
      for (const plan of activePlans) {
        const currentPrice = priceResults[plan.symbol];
        
        if (!currentPrice) {
          continue; // Skip if price not available
        }

        let planModified = false;
        const now = new Date();
        
        // Update current price
        const priceChanged = plan.currentPrice !== currentPrice;
        plan.currentPrice = currentPrice;
        if (priceChanged) {
          planModified = true;
        }

        // Check buy levels (if price is within range)
        for (const buyLevel of plan.buyLevels) {
          if (!buyLevel.isHit && currentPrice >= buyLevel.priceFrom && currentPrice <= buyLevel.priceTo) {
            buyLevel.isHit = true;
            buyLevel.hitDate = now;
            buyHits++;
            planModified = true;
            notifications.push({
              type: 'buyHit',
              symbol: plan.symbol,
              level: buyLevel.level,
              price: currentPrice
            });
            console.log(`  🎯 ${plan.symbol} - Buy Level ${buyLevel.level} HIT at Rs. ${currentPrice}`);
          }
        }

        // Check target prices (if current price >= target)
        for (const target of plan.targetPrices) {
          if (!target.isHit && currentPrice >= target.price) {
            target.isHit = true;
            target.hitDate = now;
            tpHits++;
            planModified = true;
            notifications.push({
              type: 'tpHit',
              symbol: plan.symbol,
              level: target.level,
              price: currentPrice,
              targetPrice: target.price
            });
            console.log(`  🎉 ${plan.symbol} - TP${target.level} HIT! Price: Rs. ${currentPrice} (Target: Rs. ${target.price})`);
          }
        }

        // Check stop loss (if current price <= stop loss)
        if (plan.stopLoss && !plan.stopLoss.isHit && currentPrice <= plan.stopLoss.price) {
          plan.stopLoss.isHit = true;
          plan.stopLoss.hitDate = now;
          plan.status = 'sl_hit';
          plan.isActive = false; // Move to historical
          plan.exitDate = now;
          slHits++;
          planModified = true;
          notifications.push({
            type: 'slHit',
            symbol: plan.symbol,
            price: currentPrice,
            stopLoss: plan.stopLoss.price
          });
          console.log(`  🔴 ${plan.symbol} - STOP LOSS HIT! Price: Rs. ${currentPrice} (SL: Rs. ${plan.stopLoss.price})`);
        }

        // Save if modified
        if (planModified) {
          await plan.save();
          plansUpdated++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Trade plan check complete in ${duration}s`);
      console.log(`   📊 Checked: ${activePlans.length} plans`);
      console.log(`   🔄 Updated: ${plansUpdated} plans`);
      if (buyHits > 0) console.log(`   🎯 Buy Hits: ${buyHits}`);
      if (tpHits > 0) console.log(`   🎉 Target Hits: ${tpHits}`);
      if (slHits > 0) console.log(`   🔴 Stop Loss Hits: ${slHits}`);
      if (errors.length > 0) console.log(`   ⚠️ Errors: ${errors.length}`);

      this.lastCheckTime = Date.now();

      // Notify handlers (for Socket.IO broadcasting)
      if (notifications.length > 0) {
        this.notifyHandlers({
          type: 'tradePlanUpdate',
          data: {
            checked: activePlans.length,
            updated: plansUpdated,
            updates: { buyHits, tpHits, slHits },
            notifications
          }
        });
      }

      return {
        checked: activePlans.length,
        updated: plansUpdated,
        updates: { buyHits, tpHits, slHits },
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('❌ Error in trade plan polling cycle:', error);
      throw error;
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
   * Get service status
   */
  getStatus() {
    return {
      isPolling: this.isPolling,
      pollingInterval: this.pollingInterval,
      pollingIntervalMinutes: this.pollingInterval / 60000,
      lastCheckTime: this.lastCheckTime,
      lastCheckAgo: this.lastCheckTime ? Date.now() - this.lastCheckTime : null
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
   * Manual trigger (for testing or immediate check)
   */
  async triggerCheck() {
    console.log('🔄 Manual trigger: Checking trade plans now...');
    return await this.checkAllTradePlans();
  }
}

// Export singleton instance
export default new TradePlanPollingService();

