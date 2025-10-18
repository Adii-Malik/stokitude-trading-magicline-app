import express from 'express';
import db from '../db/database.js';
import centralizedPriceService from '../services/centralizedPriceService.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// GET /api/symbols - Get all symbols with their magic lines and current prices (Auth required)
router.get('/', authenticate, async (req, res) => {
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

// GET /api/symbols/:symbol - Get specific symbol data (Auth required)
router.get('/:symbol', authenticate, async (req, res) => {
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

// GET /api/symbols/stats - Get statistics (Auth required)
router.get('/stats/summary', authenticate, async (req, res) => {
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

// POST /api/symbols/fetch-prices - Fetch closing prices from PSX (on-demand, Auth required)
// This endpoint triggers the centralized price service
router.post('/fetch-prices', authenticate, async (req, res) => {
  try {
    const symbols = await db.getAllSymbols();
    
    if (symbols.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No symbols loaded. Upload symbols first.'
      });
    }

    console.log(`\n📊 Manual fetch triggered via API...`);
    console.log(`⏰ Request at: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })} PKT`);
    
    // Trigger centralized price service
    const fetchResult = await centralizedPriceService.checkPrices();
    
    // Get current data from database (reads from Stock model)
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
      success: !fetchResult.error,
      skipped: fetchResult.skipped || false,
      message: fetchResult.skipped 
        ? `Market is ${fetchResult.status} - ${fetchResult.message}` 
        : `Successfully fetched prices for ${fetchResult.updated || 0} stocks`,
      data: {
        total: symbols.length,
        success: successCount,
        failed: failCount,
        source: 'PSX Official (dps.psx.com.pk) - Centralized',
        lastCheckTime: centralizedPriceService.lastCheckTime,
        symbols: data
      }
    };

    console.log(`✅ Response: ${successCount} success, ${failCount} failed\n`);

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

