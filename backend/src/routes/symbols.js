import express from 'express';
import db from '../db/database.js';
import pricePollingService from '../services/pricePollingService.js';
import { adminOnly } from '../middleware/auth.js';

const router = express.Router();

// GET /api/symbols - Get all symbols with their magic lines and current prices
router.get('/', async (req, res) => {
  try {
    const data = await db.getFullData();
    const stats = await db.getStats();

    res.json({
      success: true,
      data: {
        symbols: data,
        stats: stats
      }
    });
  } catch (error) {
    console.error('❌ Error fetching symbols:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching symbols',
      error: error.message
    });
  }
});

// GET /api/symbols/:symbol - Get specific symbol data
router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const symbolInfo = await db.getSymbol(symbol);
    const priceData = await db.getPrice(symbol);

    if (!symbolInfo) {
      return res.status(404).json({
        success: false,
        message: `Symbol ${symbol} not found`
      });
    }

    const currentPrice = priceData?.price || null;
    const isMet = currentPrice !== null && currentPrice >= symbolInfo.magicLine;

    res.json({
      success: true,
      data: {
        symbol: symbolInfo.symbol,
        magicLine: symbolInfo.magicLine,
        currentPrice: currentPrice,
        priceData: priceData,
        isMet: isMet,
        addedAt: symbolInfo.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Error fetching symbol:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching symbol',
      error: error.message
    });
  }
});

// DELETE /api/symbols - Clear all symbols (Admin only)
router.delete('/', adminOnly, async (req, res) => {
  try {
    await db.clearSymbols();
    console.log('🗑️ All symbols cleared');

    res.json({
      success: true,
      message: 'All symbols cleared'
    });
  } catch (error) {
    console.error('❌ Error clearing symbols:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing symbols',
      error: error.message
    });
  }
});

// GET /api/symbols/stats - Get statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await db.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
});

// POST /api/symbols/fetch-prices - Fetch closing prices from PSX (on-demand)
router.post('/fetch-prices', async (req, res) => {
  try {
    const symbols = await db.getAllSymbols();
    
    if (symbols.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No symbols loaded. Upload symbols first.'
      });
    }

    console.log(`\n📊 Smart fetch triggered for ${symbols.length} symbols...`);
    console.log(`⏰ Request at: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })} PKT`);
    
    // Smart fetch with caching
    const fetchResult = await pricePollingService.fetchAllPrices();
    
    // Get current data from database
    const data = await db.getFullData();
    
    // Count successes and failures
    let successCount = 0;
    let failCount = 0;
    
    data.forEach(item => {
      if (item.currentPrice !== null && item.currentPrice !== undefined) {
        successCount++;
      } else {
        failCount++;
      }
    });

    const response = {
      success: fetchResult.success,
      cached: fetchResult.cached,
      message: fetchResult.message,
      data: {
        total: symbols.length,
        success: successCount,
        failed: failCount,
        source: 'PSX Official (dps.psx.com.pk)',
        lastFetchTime: fetchResult.lastFetchTime,
        nextFetchIn: fetchResult.nextFetchIn, // seconds
        symbols: data
      }
    };

    if (fetchResult.cached) {
      const minutesAgo = Math.floor((Date.now() - fetchResult.lastFetchTime) / 60000);
      const minutesUntilNext = Math.ceil(fetchResult.nextFetchIn / 60);
      console.log(`💾 Returned cached data (${minutesAgo} min ago, next fetch in ${minutesUntilNext} min)\n`);
    } else {
      console.log(`✅ Fresh data fetched: ${successCount} success, ${failCount} failed\n`);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching prices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prices',
      error: error.message
    });
  }
});

export default router;

