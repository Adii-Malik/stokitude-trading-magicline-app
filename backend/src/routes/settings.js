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
    
    // Handle polling enabled/disabled toggle
    if (typeof updates.pricePolling?.enabled !== 'undefined') {
      if (updates.pricePolling.enabled) {
        const interval = settings.pricePolling.intervalMinutes;
        console.log(`✅ Enabling centralized price service with ${interval} minute interval`);
        centralizedPriceService.stop();
        centralizedPriceService.start(interval);
      } else {
        console.log('🛑 Disabling centralized price service');
        centralizedPriceService.stop();
      }
    }
    // If interval changed and service is enabled, restart with new interval
    else if (updates.pricePolling?.intervalMinutes && settings.pricePolling.enabled) {
      const newInterval = updates.pricePolling.intervalMinutes;
      console.log(`🔄 Restarting price service: ${newInterval} min interval`);
      
      centralizedPriceService.stop();
      centralizedPriceService.start(newInterval);
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
    // Check if already fetching
    const status = centralizedPriceService.getStatus();
    if (status.isFetching) {
      return res.json({
        success: false,
        message: 'Price fetch already in progress',
        data: {
          status: 'already_fetching',
          timestamp: new Date()
        }
      });
    }
    
    const marketStatus = marketHoursService.isMarketOpen();
    
    // Respond immediately - don't wait for prices to fetch
    res.json({
      success: true,
      message: 'Price refresh started',
      data: {
        status: 'in_progress',
        marketStatus,
        timestamp: new Date()
      }
    });
    
    // Trigger price fetch asynchronously (timestamp will be saved by checkPrices itself)
    centralizedPriceService.checkPrices(true)
      .catch((error) => {
        console.error('❌ Manual price refresh error:', error.message);
      });
    
  } catch (error) {
    console.error('❌ Error starting price refresh:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to start price refresh',
      error: error.message
    });
  }
});

// GET /api/settings/last-update - Get last price update timestamp (All authenticated users)
router.get('/last-update', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    res.json({
      success: true,
      data: {
        lastUpdate: settings.pricePolling.lastPriceUpdate
      }
    });
  } catch (error) {
    console.error('Error fetching last update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch last update',
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
        lastPriceUpdate: settings.pricePolling.lastPriceUpdate,
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

