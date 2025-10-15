import express from 'express';
import db from '../db/database.js';
import config from '../config/config.js';

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

// DELETE /api/symbols - Clear all symbols
router.delete('/', async (req, res) => {
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

// POST /api/symbols/fetch-prices - Manually fetch prices from PSX REST API
router.post('/fetch-prices', async (req, res) => {
  try {
    const symbols = await db.getAllSymbols();
    
    if (symbols.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No symbols loaded. Upload symbols first.'
      });
    }

    console.log(`🔄 Fetching prices for ${symbols.length} symbols from PSX API...`);
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // Fetch prices for each symbol
    for (const symbolInfo of symbols) {
      try {
        const response = await fetch(`${config.psxApiUrl}/ticks/REG/${symbolInfo.symbol}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.price) {
            await db.updatePrice(symbolInfo.symbol, data.data);
            successCount++;
          } else {
            failCount++;
            errors.push(`${symbolInfo.symbol}: No price data`);
          }
        } else {
          failCount++;
          errors.push(`${symbolInfo.symbol}: HTTP ${response.status}`);
        }
      } catch (error) {
        failCount++;
        errors.push(`${symbolInfo.symbol}: ${error.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`✅ Price fetch complete: ${successCount} success, ${failCount} failed`);

    res.json({
      success: true,
      message: `Fetched prices for ${successCount} symbols`,
      data: {
        total: symbols.length,
        success: successCount,
        failed: failCount,
        errors: errors.length > 10 ? errors.slice(0, 10) : errors
      }
    });

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

