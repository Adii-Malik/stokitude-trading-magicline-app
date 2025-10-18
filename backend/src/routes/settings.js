import express from 'express';
import Settings from '../models/Settings.js';
import { adminOnly } from '../middleware/auth.js';
import centralizedPriceService from '../services/centralizedPriceService.js';
import magicLineHandler from '../handlers/magicLineHandler.js';
import tradePlanHandler from '../handlers/tradePlanHandler.js';
import marketHoursService from '../services/marketHoursService.js';

const router = express.Router();

// GET /api/settings - Get current system settings (Admin only)
router.get('/', adminOnly, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    // Get current service status (only ONE service now!)
    const priceServiceStatus = centralizedPriceService.getStatus();
    const marketStatus = marketHoursService.isMarketOpen();
    
    res.json({
      success: true,
      data: {
        settings: settings.toObject(),
        serviceStatus: {
          priceService: priceServiceStatus,
          marketStatus
        },
        architecture: {
          note: 'Centralized event-driven architecture',
          service: 'centralizedPriceService (fetches prices)',
          handlers: ['magicLineHandler (listens)', 'tradePlanHandler (listens)']
        }
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
});

// PUT /api/settings - Update system settings (Admin only)
router.put('/', adminOnly, async (req, res) => {
  try {
    const updates = req.body;
    
    // Validate interval if provided
    if (updates.pricePolling?.intervalMinutes) {
      const interval = updates.pricePolling.intervalMinutes;
      if (interval < 5 || interval > 60) {
        return res.status(400).json({
          success: false,
          message: 'Interval must be between 5 and 60 minutes'
        });
      }
    }
    
    const settings = await Settings.updateSettings(updates);
    
    // If interval changed, restart the centralized price service
    if (updates.pricePolling?.intervalMinutes) {
      const newInterval = updates.pricePolling.intervalMinutes;
      console.log(`🔄 Restarting centralized price service with new interval: ${newInterval} minutes`);
      
      // Stop and restart the ONE service (handlers will be notified automatically)
      centralizedPriceService.stop();
      centralizedPriceService.start(newInterval);
      
      console.log('   ✅ Service restarted, handlers will be notified on next price update');
    }
    
    // If market hours changed, update marketHoursService
    if (updates.marketHours) {
      console.log('🕒 Market hours configuration updated');
      marketHoursService.updateConfig(updates.marketHours);
    }
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
});

// POST /api/settings/refresh-prices - Manual price refresh (Admin only)
// Non-blocking approach: Start refresh immediately, notify via Socket.IO when complete
router.post('/refresh-prices', adminOnly, async (req, res) => {
  try {
    console.log('🔄 Manual price refresh triggered by admin:', req.user?.username);
    
    // Check if already fetching
    const status = centralizedPriceService.getStatus();
    if (status.isFetching) {
      console.log('   ⚠️ Price fetch already in progress');
      return res.json({
        success: false,
        message: 'Price fetch already in progress',
        data: {
          status: 'already_fetching',
          timestamp: new Date()
        }
      });
    }
    
    // Check market status (for info only)
    const marketStatus = marketHoursService.isMarketOpen();
    console.log('   Market status:', marketStatus.isOpen ? 'OPEN' : 'CLOSED');
    
    // Respond immediately - don't wait for prices to fetch
    res.json({
      success: true,
      message: 'Price refresh started',
      data: {
        status: 'in_progress',
        marketStatus,
        timestamp: new Date(),
        note: 'Prices are being fetched in background. You will be notified when complete.'
      }
    });
    
    // Trigger price fetch asynchronously (non-blocking)
    console.log('   📊 Starting background price fetch...');
    
    // Run in background - don't await
    centralizedPriceService.checkPrices(true)
      .then(async (priceResult) => {
        // Update last manual refresh time
        await Settings.updateSettings({
          pricePolling: {
            lastManualRefresh: new Date()
          }
        });
        
        console.log('   ✅ Manual refresh complete! Handlers notified via Socket.IO');
      })
      .catch((error) => {
        console.error('❌ Error in background price refresh:', error);
      });
    
  } catch (error) {
    console.error('❌ Error starting price refresh:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to start price refresh',
      error: error.message
    });
  }
});

// GET /api/settings/status - Get system status (Admin only)
router.get('/status', adminOnly, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const marketStatus = marketHoursService.isMarketOpen();
    
    const priceServiceStatus = centralizedPriceService.getStatus();
    
    res.json({
      success: true,
      data: {
        currentInterval: settings.pricePolling.intervalMinutes,
        pollingEnabled: settings.pricePolling.enabled,
        lastManualRefresh: settings.pricePolling.lastManualRefresh,
        marketStatus,
        services: {
          priceService: {
            running: priceServiceStatus.isRunning,
            lastCheck: priceServiceStatus.lastCheckTime,
            lastCheckAgo: priceServiceStatus.lastCheckAgo,
            description: 'Fetches prices from PSX, updates Stock model, notifies handlers'
          }
        },
        handlers: {
          magicLine: {
            description: 'Listens to price updates, checks magic line hits',
            triggeredBy: 'centralizedPriceService'
          },
          tradePlans: {
            description: 'Listens to price updates, checks buy levels/targets/SL',
            triggeredBy: 'centralizedPriceService'
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch status',
      error: error.message
    });
  }
});

export default router;

