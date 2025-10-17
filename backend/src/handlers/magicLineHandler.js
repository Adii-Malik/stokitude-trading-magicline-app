import Symbol from '../models/Symbol.js';
import Stock from '../models/Stock.js';

/**
 * Magic Line Handler
 * Listens to price updates and checks if any magic lines are hit
 * This is triggered whenever centralizedPriceService updates prices
 */
class MagicLineHandler {
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

  // Check all Magic Line symbols against current prices
  async checkMagicLines() {
    const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
    
    try {
      console.log(`\n🎯 [${currentTime} PKT] Checking Magic Line statuses...`);
      
      // Get all active Magic Line symbols
      const magicLineSymbols = await Symbol.find({ isActive: true });
      
      if (magicLineSymbols.length === 0) {
        console.log('   ℹ️ No active magic line symbols');
        return { checked: 0, updated: 0 };
      }

      let checked = 0;
      let updated = 0;

      // Check each symbol
      for (const symbolInfo of magicLineSymbols) {
        checked++;
        
        // Get current price from Stock model
        const stock = await Stock.findOne({ symbol: symbolInfo.symbol });
        
        if (!stock || !stock.currentPrice) {
          console.log(`   ⚠️ ${symbolInfo.symbol}: No price data available`);
          continue;
        }

        const currentPrice = stock.currentPrice;
        const magicLine = symbolInfo.magicLine;
        const previousStatus = symbolInfo.status;

        // Check if price meets or exceeds magic line
        const newStatus = currentPrice >= magicLine ? 'met' : 'pending';

        // Update only if status changed
        if (newStatus !== previousStatus) {
          symbolInfo.status = newStatus;
          await symbolInfo.save();
          updated++;

          const statusEmoji = newStatus === 'met' ? '✅' : '⏳';
          console.log(`   ${statusEmoji} ${symbolInfo.symbol}: ${previousStatus} → ${newStatus} (Price: ${currentPrice}, Magic Line: ${magicLine})`);

          // Notify handlers (Socket.IO)
          this.notifyHandlers({
            type: 'magicLineUpdate',
            data: {
              symbol: symbolInfo.symbol,
              companyName: symbolInfo.companyName,
              status: newStatus,
              previousStatus,
              currentPrice,
              magicLine,
              timestamp: new Date()
            }
          });
        }
      }

      console.log(`   ✅ Checked: ${checked}, Updated: ${updated}`);
      
      return { checked, updated };
    } catch (error) {
      console.error('❌ Error checking magic lines:', error);
      return { error: error.message };
    }
  }
}

// Export singleton instance
const magicLineHandler = new MagicLineHandler();
export default magicLineHandler;

