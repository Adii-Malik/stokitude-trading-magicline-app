import TradePlan from '../models/TradePlan.js';
import Stock from '../models/Stock.js';
import notificationService from '../services/notificationService.js';

/**
 * Trade Plan Handler
 * Listens to price updates and checks buy levels, targets, and stop loss
 * This is triggered whenever centralizedPriceService updates prices
 */
class TradePlanHandler {
  constructor() {
    this.handlers = [];
  }

  // Register Socket.IO or other handlers
  onUpdate(handler) {
    this.handlers.push(handler);
  }

  notifyHandlers(data) {
    this.handlers.forEach(handler => handler(data));
  }

  // Check all active Trade Plans against current prices
  async checkTradePlans() {
    const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
    
    try {
      console.log(`\n📈 [${currentTime} PKT] Checking Trade Plan statuses...`);
      
      // Get all active trade plans
      const activePlans = await TradePlan.find({ isActive: true, status: 'active' });
      
      if (activePlans.length === 0) {
        console.log('   ℹ️ No active trade plans');
        return { checked: 0, updated: 0 };
      }

      let checked = 0;
      let updated = 0;

      // Check each plan
      for (const plan of activePlans) {
        checked++;
        
        // Get current price from Stock model
        const stock = await Stock.findOne({ symbol: plan.symbol });
        
        if (!stock || !stock.currentPrice) {
          console.log(`   ⚠️ ${plan.symbol}: No price data available`);
          continue;
        }

        const currentPrice = stock.currentPrice;
        let planUpdated = false;
        const updates = [];

        // Check Buy Levels (entry points)
        for (const level of plan.buyLevels) {
          if (!level.isHit && currentPrice >= level.minPrice && currentPrice <= level.maxPrice) {
            level.isHit = true;
            level.hitDate = new Date();
            planUpdated = true;
            updates.push(`Buy Level ${level.level} HIT`);
            console.log(`   ✅ ${plan.symbol}: Buy Level ${level.level} HIT at ${currentPrice}`);
            
            // Send notification
            notificationService.notifyTradePlanBuyLevel(plan, level)
              .catch(err => console.error('Failed to send notification:', err));
          }
        }

        // Check if any buy level has been hit (required before checking targets/SL)
        const anyBuyLevelHit = plan.buyLevels.some(l => l.isHit);

        if (anyBuyLevelHit) {
          // Check Target Prices
          for (const target of plan.targetPrices) {
            if (!target.isHit) {
              let targetHit = false;

              // For BUY: price must reach or exceed target
              if (plan.tradeType === 'buy' && currentPrice >= target.price) {
                targetHit = true;
              }
              // For SHORT: price must reach or go below target
              else if (plan.tradeType === 'short' && currentPrice <= target.price) {
                targetHit = true;
              }

              if (targetHit) {
                target.isHit = true;
                target.hitDate = new Date();
                planUpdated = true;
                updates.push(`Target ${target.level} HIT`);
                console.log(`   🎯 ${plan.symbol}: Target ${target.level} HIT at ${currentPrice}`);
                
                // Send notification
                notificationService.notifyTradePlanTarget(plan, target)
                  .catch(err => console.error('Failed to send notification:', err));
              }
            }
          }

          // Check Stop Loss
          if (!plan.stopLoss.isHit) {
            let slHit = false;

            // For BUY: SL triggers if price drops below
            if (plan.tradeType === 'buy' && currentPrice <= plan.stopLoss.price) {
              slHit = true;
            }
            // For SHORT: SL triggers if price rises above
            else if (plan.tradeType === 'short' && currentPrice >= plan.stopLoss.price) {
              slHit = true;
            }

            if (slHit) {
              plan.stopLoss.isHit = true;
              plan.stopLoss.hitDate = new Date();
              plan.isActive = false;
              plan.exitDate = new Date();
              planUpdated = true;
              updates.push(`Stop Loss HIT - Call CLOSED`);
              console.log(`   ❌ ${plan.symbol}: Stop Loss HIT at ${currentPrice} - Call closed`);
              
              // Send notification
              notificationService.notifyTradePlanStopLoss(plan, plan.stopLoss)
                .catch(err => console.error('Failed to send notification:', err));
            }
          }

          // Auto-close if all targets hit
          if (plan.isActive) {
            const allTargetsHit = plan.targetPrices.every(t => t.isHit);
            if (allTargetsHit) {
              plan.isActive = false;
              plan.exitDate = new Date();
              planUpdated = true;
              updates.push(`All Targets HIT - Call COMPLETED`);
              console.log(`   ✅ ${plan.symbol}: All targets HIT - Call completed`);
            }
          }
        }

        // Save if updated
        if (planUpdated) {
          await plan.save();
          updated++;

          // Notify handlers (Socket.IO)
          this.notifyHandlers({
            type: 'tradePlanUpdate',
            data: {
              planId: plan._id,
              symbol: plan.symbol,
              companyName: plan.companyName,
              currentPrice,
              updates,
              buyLevels: plan.buyLevels,
              targetPrices: plan.targetPrices,
              stopLoss: plan.stopLoss,
              isActive: plan.isActive,
              timestamp: new Date()
            }
          });
        }
      }

      console.log(`   ✅ Checked: ${checked}, Updated: ${updated}`);
      
      return { checked, updated };
    } catch (error) {
      console.error('❌ Error checking trade plans:', error);
      return { error: error.message };
    }
  }
}

// Export singleton instance
const tradePlanHandler = new TradePlanHandler();
export default tradePlanHandler;

