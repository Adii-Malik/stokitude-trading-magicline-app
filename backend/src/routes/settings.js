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
    
    // Get current service status
    const priceServiceStatus = centralizedPriceService.getStatus();
    const magicLineStatus = magicLineStatusService.getStatus();
    const tradePlanStatus = tradePlanStatusService.getStatus();
    const marketStatus = marketHoursService.isMarketOpen();
    
    res.json({
      success: true,
      data: {
        settings: settings.toObject(),
        serviceStatus: {
          priceService: priceServiceStatus,
          magicLineService: magicLineStatus,
          tradePlanService: tradePlanStatus,
          marketStatus
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
    
    // If interval changed, restart services
    if (updates.pricePolling?.intervalMinutes) {
      const newInterval = updates.pricePolling.intervalMinutes;
      console.log(`🔄 Restarting services with new interval: ${newInterval} minutes`);
      
      // Stop current services
      centralizedPriceService.stop();
      magicLineStatusService.stop();
      tradePlanStatusService.stop();
      
      // Start with new interval
      centralizedPriceService.start(newInterval);
      magicLineStatusService.start(newInterval);
      tradePlanStatusService.start(newInterval);
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
// Centralized approach: Trigger price fetch, handlers react automatically
router.post('/refresh-prices', adminOnly, async (req, res) => {
  try {
    console.log('🔄 Manual price refresh triggered by admin:', req.user?.username);
    
    // Check market status (for info only)
    const marketStatus = marketHoursService.isMarketOpen();
    console.log('   Market status:', marketStatus.isOpen ? 'OPEN' : 'CLOSED');
    
    // Trigger centralized price fetch
    // This will automatically notify all handlers (Magic Line, Trade Plans)
    console.log('   📊 Fetching prices from PSX...');
    const priceResult = await centralizedPriceService.checkPrices();
    
    if (priceResult.skipped) {
      // Market is closed and no prices fetched
      return res.json({
        success: true,
        skipped: true,
        message: `Market is ${priceResult.status} - ${priceResult.message}`,
        data: {
          marketStatus,
          timestamp: new Date()
        }
      });
    }
    
    // Update last manual refresh time
    await Settings.updateSettings({
      pricePolling: {
        lastManualRefresh: new Date()
      }
    });
    
    console.log('   ✅ Manual refresh complete! Handlers notified automatically.');
    
    res.json({
      success: true,
      message: 'Prices refreshed successfully',
      data: {
        priceResult,
        marketStatus,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Error refreshing prices:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh prices',
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

