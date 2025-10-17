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
    
    res.json({
      success: true,
      data: {
        plans,
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

// Get trade plan by ID
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
    
    res.json({
      success: true,
      data: plan
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

// Get statistics
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
      currentPrice,
      analysis
    } = req.body;
    
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
    if (currentPrice !== undefined) plan.currentPrice = currentPrice ? parseFloat(currentPrice) : null;
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
    const { status, currentPrice } = req.body;
    
    const plan = await TradePlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Trade plan not found'
      });
    }
    
    // Update current price
    if (currentPrice) {
      plan.currentPrice = parseFloat(currentPrice);
    }
    
    // Update status
    if (status) {
      plan.status = status;
      
      // If closed or SL hit, mark as inactive
      if (status === 'closed' || status === 'sl_hit' || status === 'cancelled') {
        plan.isActive = false;
        plan.closedAt = new Date();
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

// Get market status
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

// Manual price check - Check all active plans (All authenticated users)
// Note: This is now automatic during market hours, but kept for manual override if needed
router.post('/check-prices', authenticate, async (req, res) => {
  try {
    // Get all active trade plans
    const activePlans = await TradePlan.find({ isActive: true, status: 'active' });
    
    if (activePlans.length === 0) {
      return res.json({
        success: true,
        message: 'No active trade plans to check',
        data: {
          checked: 0,
          updates: { buyHits: 0, tpHits: 0, slHits: 0 }
        }
      });
    }
    
    // Get unique symbols
    const symbols = [...new Set(activePlans.map(plan => plan.symbol))];
    
    // Import PSX scraper
    const { default: psxScraper } = await import('../services/psxScraper.js');
    
    // Fetch current prices for all symbols
    const priceResults = {};
    const errors = [];
    
    for (const symbol of symbols) {
      try {
        const stockData = await psxScraper.getStockPrice(symbol);
        priceResults[symbol] = stockData.price;
      } catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error.message);
        errors.push({ symbol, error: error.message });
      }
    }
    
    // Track updates
    let buyHits = 0;
    let tpHits = 0;
    let slHits = 0;
    let plansUpdated = 0;
    
    // Check each trade plan
    for (const plan of activePlans) {
      const currentPrice = priceResults[plan.symbol];
      
      if (!currentPrice) {
        continue; // Skip if price not available
      }
      
      let planModified = false;
      const now = new Date();
      
      // Update current price
      plan.currentPrice = currentPrice;
      
      // Check buy levels (if price is within range)
      for (const buyLevel of plan.buyLevels) {
        if (!buyLevel.isHit && currentPrice >= buyLevel.priceFrom && currentPrice <= buyLevel.priceTo) {
          buyLevel.isHit = true;
          buyLevel.hitDate = now;
          buyHits++;
          planModified = true;
        }
      }
      
      // Check target prices (if current price >= target)
      for (const target of plan.targetPrices) {
        if (!target.isHit && currentPrice >= target.price) {
          target.isHit = true;
          target.hitDate = now;
          tpHits++;
          planModified = true;
        }
      }
      
      // Check stop loss (if current price <= stop loss)
      if (plan.stopLoss && !plan.stopLoss.isHit && currentPrice <= plan.stopLoss.price) {
        plan.stopLoss.isHit = true;
        plan.stopLoss.hitDate = now;
        plan.status = 'sl_hit';
        plan.isActive = false; // Move to historical
        plan.exitDate = now;
        slHits++;
        planModified = true;
      }
      
      // Save if modified
      if (planModified) {
        await plan.save();
        plansUpdated++;
      }
    }
    
    res.json({
      success: true,
      message: `Checked ${activePlans.length} trade plans`,
      data: {
        checked: activePlans.length,
        updated: plansUpdated,
        updates: { buyHits, tpHits, slHits },
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error checking prices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check prices',
      error: error.message
    });
  }
});

export default router;
