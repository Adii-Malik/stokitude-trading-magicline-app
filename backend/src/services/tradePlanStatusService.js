import TradePlan from '../models/TradePlan.js';
import Stock from '../models/Stock.js';
import marketHoursService from './marketHoursService.js';

class TradePlanStatusService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.lastCheckTime = null;
    this.handlers = [];
    this.skipCount = 0;
    this.MAX_SKIPS = 4;
  }

  // Register handlers for Socket.IO broadcasting
  onUpdate(handler) {
    this.handlers.push(handler);
  }

  notifyHandlers(data) {
    this.handlers.forEach(handler => handler(data));
  }

  // Start checking Trade Plan statuses at specified interval
  start(intervalMinutes = 15) {
    if (this.isRunning) {
      console.log('⚠️ Trade Plan status service is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`\n📈 Starting Trade Plan Status Service`);
    console.log(`   Interval: Every ${intervalMinutes} minutes`);
    console.log(`   Reads prices from Stock model (centralized)`);

    // Run immediately on start
    this.checkStatuses();

    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.checkStatuses();
    }, intervalMs);
  }

  // Stop service
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Trade Plan status service stopped');
  }

  // Check and update Trade Plan statuses
  async checkStatuses() {
    const startTime = Date.now();
    const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });

    try {
      // Check if market is open
      const status = marketHoursService.isMarketOpen();
      
      if (!status.isOpen) {
        this.skipCount++;
        if (this.skipCount >= this.MAX_SKIPS) {
          console.log(`\n⏸️ [${currentTime} PKT] Trade Plans - Market is ${status.status.toUpperCase()}`);
          console.log(`   ${status.message}`);
          console.log(`   Skipping status check (checked ${this.skipCount} times while closed)`);
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
      
      console.log(`\n📈 [${currentTime} PKT] Checking Trade Plan statuses...`);
      console.log(`   ✅ Market is OPEN - Reading from Stock model`);

      // Get all active trade plans
      const activePlans = await TradePlan.find({ isActive: true });
      
      if (activePlans.length === 0) {
        console.log('ℹ️ No active trade plans to check');
        this.lastCheckTime = Date.now();
        return {
          checked: 0,
          buyHits: 0,
          tpHits: 0,
          slHits: 0
        };
      }

      console.log(`📊 Found ${activePlans.length} active trade plans`);

      let buyHits = 0;
      let tpHits = 0;
      let slHits = 0;
      const now = new Date();

      // Check each plan
      for (const plan of activePlans) {
        try {
          // Read price from Stock model (centralized)
          const stock = await Stock.findOne({ symbol: plan.symbol });
          
          if (!stock || !stock.currentPrice) {
            console.log(`  ⚠️ ${plan.symbol}: No price in Stock model`);
            continue;
          }

          const currentPrice = stock.currentPrice;
          let planModified = false;

          // Note: currentPrice is read from Stock model, not stored in TradePlan

          // Check buy levels
          for (const buyLevel of plan.buyLevels) {
            if (!buyLevel.isHit && currentPrice >= buyLevel.priceFrom && currentPrice <= buyLevel.priceTo) {
              buyLevel.isHit = true;
              buyLevel.hitDate = now;
              buyHits++;
              planModified = true;
              
              console.log(`  💰 ${plan.symbol} - Buy Level ${buyLevel.level} HIT! (Rs. ${buyLevel.priceFrom} - ${buyLevel.priceTo})`);
              
              this.notifyHandlers({
                type: 'buyLevelHit',
                data: {
                  symbol: plan.symbol,
                  level: buyLevel.level,
                  price: currentPrice
                }
              });
            }
          }

          // Check target prices (only if at least one buy level was hit)
          const anyBuyLevelHit = plan.buyLevels.some(bl => bl.isHit);
          if (anyBuyLevelHit) {
            for (const target of plan.targetPrices) {
              if (!target.isHit && currentPrice >= target.price) {
                target.isHit = true;
                target.hitDate = now;
                tpHits++;
                planModified = true;
                
                console.log(`  🎯 ${plan.symbol} - TP${target.level} HIT! (Rs. ${target.price})`);
                
                this.notifyHandlers({
                  type: 'targetHit',
                  data: {
                    symbol: plan.symbol,
                    level: target.level,
                    price: target.price
                  }
                });
              }
            }
          }

          // Check if ALL target prices are hit
          const allTPsHit = plan.targetPrices.length > 0 && plan.targetPrices.every(tp => tp.isHit);
          if (allTPsHit && plan.isActive) {
            plan.status = 'tp_hit';
            plan.isActive = false;
            plan.exitDate = now;
            planModified = true;
            
            console.log(`  ✅ ${plan.symbol} - ALL TARGETS ACHIEVED! Moving to Historical. Price: Rs. ${currentPrice}`);
            
            this.notifyHandlers({
              type: 'tradePlanCompleted',
              data: {
                symbol: plan.symbol,
                outcome: 'success',
                exitPrice: currentPrice
              }
            });
          }

          // Check stop loss
          if (plan.stopLoss && !plan.stopLoss.isHit && currentPrice <= plan.stopLoss.price) {
            plan.stopLoss.isHit = true;
            plan.stopLoss.hitDate = now;
            plan.status = 'sl_hit';
            plan.isActive = false;
            plan.exitDate = now;
            slHits++;
            planModified = true;
            
            console.log(`  ⚠️ ${plan.symbol} - STOP LOSS HIT! (Rs. ${plan.stopLoss.price})`);
            
            this.notifyHandlers({
              type: 'stopLossHit',
              data: {
                symbol: plan.symbol,
                price: plan.stopLoss.price
              }
            });
          }

          // Save if modified
          if (planModified) {
            await plan.save();
          }
        } catch (error) {
          console.error(`  ✗ Error checking ${plan.symbol}:`, error.message);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Trade Plan status check complete in ${duration}s`);
      console.log(`   📊 Checked: ${activePlans.length} plans`);
      console.log(`   💰 Buy Levels Hit: ${buyHits}`);
      console.log(`   🎯 Targets Hit: ${tpHits}`);
      console.log(`   ⚠️ Stop Losses Hit: ${slHits}`);

      this.lastCheckTime = Date.now();

      return {
        checked: activePlans.length,
        buyHits,
        tpHits,
        slHits
      };
    } catch (error) {
      console.error('❌ Error in Trade Plan status service:', error);
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
const tradePlanStatusService = new TradePlanStatusService();
export default tradePlanStatusService;

