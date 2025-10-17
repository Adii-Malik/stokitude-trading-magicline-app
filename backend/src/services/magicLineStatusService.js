import Symbol from '../models/Symbol.js';
import Stock from '../models/Stock.js';
import marketHoursService from './marketHoursService.js';

class MagicLineStatusService {
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

  // Start checking Magic Line statuses at specified interval
  start(intervalMinutes = 15) {
    if (this.isRunning) {
      console.log('⚠️ Magic Line status service is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`\n🎯 Starting Magic Line Status Service`);
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
    console.log('🛑 Magic Line status service stopped');
  }

  // Check and update Magic Line symbol statuses
  async checkStatuses() {
    const startTime = Date.now();
    const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });

    try {
      // Check if market is open
      const status = marketHoursService.isMarketOpen();
      
      if (!status.isOpen) {
        this.skipCount++;
        if (this.skipCount >= this.MAX_SKIPS) {
          console.log(`\n⏸️ [${currentTime} PKT] Magic Line - Market is ${status.status.toUpperCase()}`);
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
      
      console.log(`\n🎯 [${currentTime} PKT] Checking Magic Line statuses...`);
      console.log(`   ✅ Market is OPEN - Reading from Stock model`);

      // Get all active Magic Line symbols
      const magicLineSymbols = await Symbol.find({ isActive: true });
      
      if (magicLineSymbols.length === 0) {
        console.log('ℹ️ No active Magic Line symbols to check');
        this.lastCheckTime = Date.now();
        return {
          checked: 0,
          updated: 0
        };
      }

      console.log(`📊 Found ${magicLineSymbols.length} active Magic Line symbols`);

      let statusChanges = 0;
      const now = new Date();

      // Check each symbol
      for (const symbolInfo of magicLineSymbols) {
        try {
          // Read price from Stock model (centralized)
          const stock = await Stock.findOne({ symbol: symbolInfo.symbol });
          
          if (!stock || !stock.currentPrice) {
            console.log(`  ⚠️ ${symbolInfo.symbol}: No price in Stock model`);
            continue;
          }

          const currentPrice = stock.currentPrice;
          const magicLine = symbolInfo.magicLine;
          const previousStatus = symbolInfo.status;
          
          // Determine new status
          let newStatus = 'pending';
          if (currentPrice >= magicLine) {
            newStatus = 'met';
          }

          // Update if status changed
          if (newStatus !== previousStatus) {
            symbolInfo.status = newStatus;
            symbolInfo.lastUpdated = now;
            await symbolInfo.save();
            
            statusChanges++;
            console.log(`  🎯 ${symbolInfo.symbol}: ${previousStatus} → ${newStatus} (Price: Rs. ${currentPrice}, Magic Line: Rs. ${magicLine})`);
            
            // Notify handlers
            this.notifyHandlers({
              type: 'statusUpdate',
              data: {
                symbol: symbolInfo.symbol,
                status: newStatus,
                currentPrice,
                magicLine
              }
            });
          }
        } catch (error) {
          console.error(`  ✗ Error checking ${symbolInfo.symbol}:`, error.message);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Magic Line status check complete in ${duration}s`);
      console.log(`   📊 Checked: ${magicLineSymbols.length} symbols`);
      console.log(`   🔄 Status changes: ${statusChanges}`);

      this.lastCheckTime = Date.now();

      return {
        checked: magicLineSymbols.length,
        statusChanges
      };
    } catch (error) {
      console.error('❌ Error in Magic Line status service:', error);
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
const magicLineStatusService = new MagicLineStatusService();
export default magicLineStatusService;

