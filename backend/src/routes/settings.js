import express from 'express';
import Settings from '../models/Settings.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import centralizedPriceService from '../services/centralizedPriceService.js';
import marketHoursService from '../services/marketHoursService.js';

const router = express.Router();

// GET /api/settings - Get current system settings (Admin only)
router.get('/', adminOnly, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const priceServiceStatus = centralizedPriceService.getStatus();
    const marketStatus = marketHoursService.getMarketStatus();

    res.json({
      success: true,
      data: {
        settings: settings.toObject(),
        status: {
          priceService: {
            running: priceServiceStatus.isRunning,
            fetching: priceServiceStatus.isFetching,
            lastCheck: priceServiceStatus.lastCheckTime,
            lastCheckAgo: priceServiceStatus.lastCheckAgo
          },
          market: marketStatus
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


// GET /api/settings/last-update - Get last price update timestamp (Authenticated users only)
router.get('/last-update', authenticate, async (req, res) => {
  try {
    // lastPriceUpdate removed - not needed anymore
    res.json({
      success: true,
      data: {
        lastUpdate: null
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

// GET /api/settings/market-status - Get market status (Authenticated users only)
router.get('/market-status', authenticate, async (req, res) => {
  try {
    const status = marketHoursService.getMarketStatus();
    const minutesUntilOpen = marketHoursService.getMinutesUntilOpen();
    const minutesUntilClose = marketHoursService.getMinutesUntilClose();

    res.json({
      success: true,
      data: {
        ...status,
        minutesUntilOpen,
        minutesUntilClose
      }
    });
  } catch (error) {
    console.error('Error getting market status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get market status',
      error: error.message
    });
  }
});

export default router;

