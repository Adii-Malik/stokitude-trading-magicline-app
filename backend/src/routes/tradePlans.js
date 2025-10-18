import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import TradePlan from '../models/TradePlan.js';
import Stock from '../models/Stock.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import marketHoursService from '../services/marketHoursService.js';

const router = express.Router();

// Configure multer for CSV upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Get all trade plans (with filters)
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status = '', 
      symbol = '', 
      isActive = '',
      tradeType = '',
      outcome = '',
      timeFilter = '',
      sortOrder = 'newest'
    } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Filter by symbol
    if (symbol) {
      query.symbol = { $regex: symbol, $options: 'i' };
    }
    
    // Filter by active/historical
    if (isActive !== '') {
      query.isActive = isActive === 'true';
    }
    
    // Filter by trade type
    if (tradeType) {
      query.tradeType = tradeType;
    }
    
    // Filter by outcome (success = TP hit, failed = SL hit, closed = manually closed)
    if (outcome === 'success') {
      query['targetPrices.isHit'] = true;
    } else if (outcome === 'failed') {
      query['stopLoss.isHit'] = true;
      query['targetPrices.isHit'] = { $ne: true }; // No TPs hit
    } else if (outcome === 'closed') {
      query.status = 'closed';
    }
    
    // Filter by time period
    if (timeFilter) {
      const now = new Date();
      let startDate;
      
      switch (timeFilter) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case '3months':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }
    
    // Determine sort order
    const sortField = 'createdAt';
    const sortDirection = sortOrder === 'oldest' ? 1 : -1;
    
    const total = await TradePlan.countDocuments(query);
    const plans = await TradePlan.find(query)
      .populate('createdBy', 'username')
      .sort({ [sortField]: sortDirection })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // 🔥 ENRICH: Add current prices from Stock model (centralized storage)
    const symbols = [...new Set(plans.map(p => p.symbol))];
    const stocks = await Stock.find({ symbol: { $in: symbols } });
    const stockMap = {};
    stocks.forEach(s => {
      stockMap[s.symbol] = s;
    });
    
    // Add currentPrice to each plan
    const enrichedPlans = plans.map(plan => {
      const planObj = plan.toObject();
      const stock = stockMap[plan.symbol];
      planObj.currentPrice = stock?.currentPrice || null;
      planObj.priceChange = stock?.priceChange || null;
      planObj.priceChangePercent = stock?.priceChangePercent || null;
      planObj.lastUpdated = stock?.lastUpdated || null;
      return planObj;
    });
    
    res.json({
      success: true,
      data: {
        plans: enrichedPlans,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching trade plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trade plans',
      error: error.message
    });
  }
});

// Get statistics (MUST be before /:id)
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const totalPlans = await TradePlan.countDocuments();
    const activePlans = await TradePlan.countDocuments({ isActive: true });
    const closedPlans = await TradePlan.countDocuments({ isActive: false });
    
    // Count target hits
    const tpHits = await TradePlan.countDocuments({ 'targetPrices.isHit': true });
    const slHit = await TradePlan.countDocuments({ 'stopLoss.isHit': true });
    
    res.json({
      success: true,
      data: {
        totalPlans,
        activePlans,
        closedPlans,
        tpHits,
        slHit
      }
    });
  } catch (error) {
    console.error('Error fetching trade plan stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// Get market status (MUST be before /:id)
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

// Get trade plan by ID (MUST be after all specific routes)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const plan = await TradePlan.findById(req.params.id)
      .populate('createdBy', 'username');
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Trade plan not found'
      });
    }
    
    // 🔥 ENRICH: Add current price from Stock model (centralized storage)
    const stock = await Stock.findOne({ symbol: plan.symbol });
    const enrichedPlan = plan.toObject();
    enrichedPlan.currentPrice = stock?.currentPrice || null;
    enrichedPlan.priceChange = stock?.priceChange || null;
    enrichedPlan.priceChangePercent = stock?.priceChangePercent || null;
    enrichedPlan.lastUpdated = stock?.lastUpdated || null;
    
    res.json({
      success: true,
      data: enrichedPlan
    });
  } catch (error) {
    console.error('Error fetching trade plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trade plan',
      error: error.message
    });
  }
});

// Create a new trade plan (Admin only)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { 
      symbol,
      tradeType = 'buy',
      setupQuality = 'good',
      buyLevels,
      targetPrices,
      stopLoss,
      analysis
    } = req.body;
    
    // Validate required fields
    if (!symbol || !buyLevels || buyLevels.length === 0 || !targetPrices || targetPrices.length === 0 || !stopLoss) {
      return res.status(400).json({
        success: false,
        message: 'Symbol, Buy Levels, Target Prices, and Stop Loss are required'
      });
    }
    
    // Get company name from Stock database
    const stock = await Stock.findOne({ symbol: symbol.toUpperCase() });
    
    // Calculate short-term TP range
    const tpPrices = targetPrices.map(tp => tp.price);
    const shortTermTPRange = {
      from: Math.min(...tpPrices),
      to: Math.max(...tpPrices)
    };
    
    const plan = new TradePlan({
      symbol: symbol.toUpperCase(),
      companyName: stock?.companyName || null,
      tradeType,
      setupQuality,
      buyLevels: buyLevels.map((bl, index) => ({
        level: index + 1,
        priceFrom: parseFloat(bl.priceFrom),
        priceTo: parseFloat(bl.priceTo),
        isHit: false
      })),
      targetPrices: targetPrices.map((tp, index) => ({
        level: index + 1,
        price: parseFloat(tp.price),
        isHit: false
      })),
      shortTermTPRange,
      stopLoss: {
        price: parseFloat(stopLoss),
        isHit: false
      },
      analysis: analysis?.trim() || null,
      createdBy: req.user._id
    });
    
    await plan.save();
    
    res.status(201).json({
      success: true,
      message: 'Trade plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error creating trade plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create trade plan',
      error: error.message
    });
  }
});

// Update a trade plan (Admin only)
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const plan = await TradePlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Trade plan not found'
      });
    }
    
    const {
      symbol,
      tradeType,
      setupQuality,
      buyLevels,
      targetPrices,
      stopLoss,
      analysis
    } = req.body;
    // Note: currentPrice is no longer stored in TradePlan (read from Stock model)
    
    // Update fields if provided
    if (symbol) {
      plan.symbol = symbol.toUpperCase();
      const stock = await Stock.findOne({ symbol: symbol.toUpperCase() });
      plan.companyName = stock?.companyName || null;
    }
    if (tradeType) plan.tradeType = tradeType;
    if (setupQuality) plan.setupQuality = setupQuality;
    if (buyLevels) {
      plan.buyLevels = buyLevels.map((bl, index) => ({
        level: index + 1,
        priceFrom: parseFloat(bl.priceFrom),
        priceTo: parseFloat(bl.priceTo),
        isHit: bl.isHit || false,
        hitDate: bl.hitDate || null
      }));
    }
    if (targetPrices) {
      plan.targetPrices = targetPrices.map((tp, index) => ({
        level: index + 1,
        price: parseFloat(tp.price),
        isHit: tp.isHit || false,
        hitDate: tp.hitDate || null
      }));
      
      // Recalculate short-term TP range
      const tpPrices = targetPrices.map(tp => parseFloat(tp.price));
      plan.shortTermTPRange = {
        from: Math.min(...tpPrices),
        to: Math.max(...tpPrices)
      };
    }
    if (stopLoss !== undefined) {
      plan.stopLoss = {
        price: parseFloat(typeof stopLoss === 'object' ? stopLoss.price : stopLoss),
        isHit: stopLoss.isHit || false,
        hitDate: stopLoss.hitDate || null
      };
    }
    if (analysis !== undefined) plan.analysis = analysis?.trim() || null;
    
    await plan.save();
    
    res.json({
      success: true,
      message: 'Trade plan updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error updating trade plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update trade plan',
      error: error.message
    });
  }
});

// Update trade plan status (Admin only)
router.put('/:id/status', adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    // Note: currentPrice is no longer stored in TradePlan (read from Stock model)
    
    const plan = await TradePlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Trade plan not found'
      });
    }
    
    // Update status
    if (status) {
      plan.status = status;
      
      // If closed or SL hit, mark as inactive and set exitDate
      if (status === 'closed' || status === 'sl_hit' || status === 'cancelled') {
        plan.isActive = false;
        plan.exitDate = new Date();
      }
    }
    
    await plan.save();
    
    res.json({
      success: true,
      message: 'Trade plan status updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error updating trade plan status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update trade plan status',
      error: error.message
    });
  }
});

// Clear all trade plans (Admin only) - Must come before /:id route
router.delete('/clear-all', adminOnly, async (req, res) => {
  try {
    const result = await TradePlan.deleteMany({});
    
    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} trade plans`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Error clearing all trade plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear trade plans',
      error: error.message
    });
  }
});

// Delete a trade plan (Admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const plan = await TradePlan.findByIdAndDelete(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Trade plan not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Trade plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting trade plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete trade plan',
      error: error.message
    });
  }
});

// Bulk upload trade plans from CSV (Admin only)
router.post('/upload/csv', adminOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const results = [];
    const errors = [];
    let lineNumber = 1;
    
    // Parse CSV
    const stream = Readable.from(req.file.buffer.toString());
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          lineNumber++;
          
          try {
            const symbol = row.Symbol?.trim()?.toUpperCase();
            const tradeType = row.TradeType?.trim()?.toLowerCase() || 'buy';
            const setupQuality = row.SetupQuality?.trim()?.toLowerCase() || 'good';
            
            // Parse buy levels
            const buyLevels = [];
            for (let i = 1; i <= 3; i++) {
              const from = parseFloat(row[`Buy${i}_From`]);
              const to = parseFloat(row[`Buy${i}_To`]);
              if (!isNaN(from) && !isNaN(to)) {
                buyLevels.push({ level: i, priceFrom: from, priceTo: to, isHit: false });
              }
            }
            
            // Parse target prices
            const targetPrices = [];
            for (let i = 1; i <= 3; i++) {
              const price = parseFloat(row[`TP${i}`]);
              if (!isNaN(price)) {
                targetPrices.push({ level: i, price, isHit: false });
              }
            }
            
            const stopLoss = parseFloat(row.StopLoss);
            
            // Validate
            if (!symbol || buyLevels.length === 0 || targetPrices.length === 0 || isNaN(stopLoss)) {
              errors.push({
                line: lineNumber,
                error: 'Missing or invalid required fields',
                data: row
              });
              return;
            }
            
            // Calculate short-term TP range
            const tpPrices = targetPrices.map(tp => tp.price);
            const shortTermTPRange = {
              from: Math.min(...tpPrices),
              to: Math.max(...tpPrices)
            };
            
            results.push({
              symbol,
              companyName: row.CompanyName?.trim() || null,
              tradeType,
              setupQuality,
              buyLevels,
              targetPrices,
              shortTermTPRange,
              stopLoss: {
                price: stopLoss,
                isHit: false
              },
              analysis: row.Analysis?.trim() || null
            });
          } catch (err) {
            errors.push({
              line: lineNumber,
              error: err.message,
              data: row
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data found in CSV',
        errors
      });
    }
    
    // Auto-fill company names from Stock database
    const symbols = results.map(r => r.symbol);
    const stocks = await Stock.find({ symbol: { $in: symbols } });
    const stockMap = {};
    stocks.forEach(s => {
      stockMap[s.symbol] = s.companyName;
    });
    
    // Create trade plans with creator
    const plans = results.map(r => ({
      ...r,
      companyName: r.companyName || stockMap[r.symbol] || null,
      createdBy: req.user._id
    }));
    
    const insertedPlans = await TradePlan.insertMany(plans);
    
    res.json({
      success: true,
      message: 'Trade plans uploaded successfully',
      data: {
        total: results.length,
        inserted: insertedPlans.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error uploading trade plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload trade plans',
      error: error.message
    });
  }
});

// Note: Price checking is now handled automatically by centralized event architecture:
// - centralizedPriceService fetches prices every 15 minutes (during market hours)
// - tradePlanHandler listens to price updates and checks buy levels/targets/SL automatically
// - No manual price checking endpoint needed

// ============================================
// TEST API - For Manual Testing Only
// ============================================

// POST /api/trade-plans/test/mock-hit
// Simulate hitting buy levels, TPs, or SL for testing
router.post('/test/mock-hit', adminOnly, async (req, res) => {
  try {
    const { planId, action, level } = req.body;
    
    if (!planId || !action) {
      return res.status(400).json({
        success: false,
        message: 'planId and action are required'
      });
    }

    const plan = await TradePlan.findById(planId);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Trade plan not found'
      });
    }

    const now = new Date();
    let updated = false;
    let message = '';

    switch (action) {
      case 'hitBuyLevel':
        if (!level) {
          return res.status(400).json({
            success: false,
            message: 'level is required for hitBuyLevel action (1, 2, or 3)'
          });
        }
        const buyLevel = plan.buyLevels.find(bl => bl.level === parseInt(level));
        if (buyLevel) {
          buyLevel.isHit = true;
          buyLevel.hitDate = now;
          updated = true;
          message = `Buy Level ${level} marked as HIT`;
        } else {
          return res.status(404).json({
            success: false,
            message: `Buy Level ${level} not found`
          });
        }
        break;

      case 'hitTP':
        if (!level) {
          return res.status(400).json({
            success: false,
            message: 'level is required for hitTP action (1, 2, or 3)'
          });
        }
        const tp = plan.targetPrices.find(t => t.level === parseInt(level));
        if (tp) {
          // Check if any buy level is hit first
          const anyBuyLevelHit = plan.buyLevels.some(bl => bl.isHit);
          if (!anyBuyLevelHit) {
            return res.status(400).json({
              success: false,
              message: 'Cannot hit TP without hitting a buy level first'
            });
          }
          tp.isHit = true;
          tp.hitDate = now;
          updated = true;
          message = `TP${level} marked as HIT`;

          // Check if all TPs are hit
          const allTPsHit = plan.targetPrices.every(t => t.isHit);
          if (allTPsHit) {
            plan.status = 'tp_hit';
            plan.isActive = false;
            plan.exitDate = now;
            message += ' - ALL TARGETS HIT! Moved to Historical';
          }
        } else {
          return res.status(404).json({
            success: false,
            message: `TP${level} not found`
          });
        }
        break;

      case 'hitSL':
        if (plan.stopLoss) {
          plan.stopLoss.isHit = true;
          plan.stopLoss.hitDate = now;
          plan.status = 'sl_hit';
          plan.isActive = false;
          plan.exitDate = now;
          updated = true;
          message = 'Stop Loss HIT! Moved to Historical';
        } else {
          return res.status(404).json({
            success: false,
            message: 'Stop Loss not found'
          });
        }
        break;

      case 'reset':
        // Reset all hits for testing
        plan.buyLevels.forEach(bl => {
          bl.isHit = false;
          bl.hitDate = null;
        });
        plan.targetPrices.forEach(tp => {
          tp.isHit = false;
          tp.hitDate = null;
        });
        if (plan.stopLoss) {
          plan.stopLoss.isHit = false;
          plan.stopLoss.hitDate = null;
        }
        plan.status = 'active';
        plan.isActive = true;
        plan.exitDate = null;
        updated = true;
        message = 'All hits reset - Call is now Active';
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use: hitBuyLevel, hitTP, hitSL, or reset'
        });
    }

    if (updated) {
      await plan.save();
    }

    res.json({
      success: true,
      message,
      data: {
        symbol: plan.symbol,
        status: plan.status,
        isActive: plan.isActive,
        buyLevels: plan.buyLevels.map(bl => ({
          level: bl.level,
          range: `${bl.priceFrom} - ${bl.priceTo}`,
          isHit: bl.isHit
        })),
        targetPrices: plan.targetPrices.map(tp => ({
          level: tp.level,
          price: tp.price,
          isHit: tp.isHit
        })),
        stopLoss: plan.stopLoss ? {
          price: plan.stopLoss.price,
          isHit: plan.stopLoss.isHit
        } : null
      }
    });
  } catch (error) {
    console.error('Error in mock-hit test API:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mock hit',
      error: error.message
    });
  }
});

export default router;
