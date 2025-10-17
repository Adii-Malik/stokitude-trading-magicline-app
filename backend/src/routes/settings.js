import express from 'express';
import Settings from '../models/Settings.js';
import { adminOnly } from '../middleware/auth.js';
import centralizedPriceService from '../services/centralizedPriceService.js';
import magicLineStatusService from '../services/magicLineStatusService.js';
import tradePlanStatusService from '../services/tradePlanStatusService.js';
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
router.post('/refresh-prices', adminOnly, async (req, res) => {
  try {
    console.log('🔄 Manual price refresh triggered by admin');
    
    // Check if market is open
    const marketStatus = marketHoursService.isMarketOpen();
    
    if (!marketStatus.isOpen) {
      return res.json({
        success: true,
        skipped: true,
        message: `Market is ${marketStatus.status} - ${marketStatus.message}`,
        data: {
          marketStatus
        }
      });
    }
    
    // Trigger centralized price fetch
    const priceResult = await centralizedPriceService.checkPrices();
    
    // Trigger status checks
    await Promise.all([
      magicLineStatusService.checkStatuses(),
      tradePlanStatusService.checkStatuses()
    ]);
    
    // Update last manual refresh time
    await Settings.updateSettings({
      pricePolling: {
        lastManualRefresh: new Date()
      }
    });
    
    res.json({
      success: true,
      message: 'Prices refreshed successfully',
      data: {
        priceResult,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error refreshing prices:', error);
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
    const magicLineStatus = magicLineStatusService.getStatus();
    const tradePlanStatus = tradePlanStatusService.getStatus();
    
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
            lastCheckAgo: priceServiceStatus.lastCheckAgo
          },
          magicLineService: {
            running: magicLineStatus.isRunning,
            lastCheck: magicLineStatus.lastCheckTime,
            lastCheckAgo: magicLineStatus.lastCheckAgo
          },
          tradePlanService: {
            running: tradePlanStatus.isRunning,
            lastCheck: tradePlanStatus.lastCheckTime,
            lastCheckAgo: tradePlanStatus.lastCheckAgo
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

