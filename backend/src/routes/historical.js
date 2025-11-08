import express from 'express';
import Stock from '../models/Stock.js';
import PsxDaily from '../models/PsxDaily.js';
import PsxWeekly from '../models/PsxWeekly.js';
import PsxMonthly from '../models/PsxMonthly.js';
import tradingViewScheduler from '../services/tradingViewScheduler.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import dataSourceService from '../services/dataSourceService.js';

const router = express.Router();

// Apply authentication and admin check to all routes
router.use(authenticate, requireAdmin);

// POST /api/historical/scrape - Scrape historical data for symbols
router.post('/scrape', async (req, res) => {
    try {
        const { symbols } = req.body;

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Symbols array is required and must not be empty'
            });
        }

        // Start scraping in background
        res.json({
            success: true,
            message: 'Historical data scraping started',
            data: {
                symbolsCount: symbols.length
            }
        });

        // Background job - don't await
        (async () => {
            for (const symbol of symbols) {
                try {
                    console.log(`\n📥 Starting scrape for ${symbol}...`);

                    // Get or create stock record
                    let stock = await Stock.findOne({ symbol });
                    if (!stock) {
                        stock = await Stock.create({ symbol, companyName: symbol });
                    }

                    // Update status
                    stock.scrapeStatus = 'in_progress';
                    stock.scrapeProgress = { total: 0, completed: 0, failed: 0 };
                    await stock.save();

                    // Fetch all timeframes using configured data source
                    const results = await dataSourceService.fetchAllTimeframes(symbol);

                    let totalSaved = 0;

                    // Store the data source used
                    stock.dataSource = results.source;

                    // If using TradingView, data is already populated by core engine
                    // For StockAnalysis, we need to save the data ourselves
                    if (results.source === 'stockanalysis') {
                        // Save daily data (bulk)
                        if (results.daily.success.length > 0) {
                            const dailyOps = results.daily.success.map(data => ({
                                updateOne: {
                                    filter: { symbol: data.symbol, date: data.date },
                                    update: { $set: { stockId: stock._id, ...data } },
                                    upsert: true
                                }
                            }));
                            await PsxDaily.bulkWrite(dailyOps);
                            totalSaved += results.daily.success.length;
                            console.log(`   ✓ Saved ${results.daily.success.length} daily records`);
                        }

                        // Save weekly data (bulk)
                        if (results.weekly.success.length > 0) {
                            const weeklyOps = results.weekly.success.map(data => ({
                                updateOne: {
                                    filter: { symbol: data.symbol, date: data.date },
                                    update: { $set: { stockId: stock._id, ...data } },
                                    upsert: true
                                }
                            }));
                            await PsxWeekly.bulkWrite(weeklyOps);
                            totalSaved += results.weekly.success.length;
                            console.log(`   ✓ Saved ${results.weekly.success.length} weekly records`);
                        }

                        // Save monthly data (bulk)
                        if (results.monthly.success.length > 0) {
                            const monthlyOps = results.monthly.success.map(data => ({
                                updateOne: {
                                    filter: { symbol: data.symbol, date: data.date },
                                    update: { $set: { stockId: stock._id, ...data } },
                                    upsert: true
                                }
                            }));
                            await PsxMonthly.bulkWrite(monthlyOps);
                            totalSaved += results.monthly.success.length;
                            console.log(`   ✓ Saved ${results.monthly.success.length} monthly records`);
                        }
                    } else {
                        // TradingView: data already populated by core engine
                        totalSaved = results.daily.total + results.weekly.total + results.monthly.total;
                        console.log(`   ✓ TradingView populated ${totalSaved} records directly`);
                    }

                    // Update status
                    stock.scrapeStatus = 'completed';
                    stock.historicalDataStatus = 'available';
                    stock.lastScrapedDate = new Date();
                    stock.scrapeProgress = {
                        total: totalSaved,
                        completed: totalSaved,
                        failed: 0
                    };
                    await stock.save();

                    console.log(`✅ Scrape completed for ${symbol}: ${totalSaved} total records saved`);
                } catch (error) {
                    console.error(`❌ Error scraping ${symbol}:`, error.message);

                    const stock = await Stock.findOne({ symbol });
                    if (stock) {
                        stock.scrapeStatus = 'failed';
                        await stock.save();
                    }
                }
            }
        })();
    } catch (error) {
        console.error('Error starting scrape:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start scraping',
            error: error.message
        });
    }
});

// GET /api/historical/:symbol - Get historical data for symbol
router.get('/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { timeframe = 'daily', limit = 100, skip = 0, startDate, endDate } = req.query;

        let Model;

        if (timeframe === 'weekly') {
            Model = PsxWeekly;
        } else if (timeframe === 'monthly') {
            Model = PsxMonthly;
        } else {
            Model = PsxDaily;
        }

        // Build query with date filters
        const query = { symbol };
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                query.date.$gte = new Date(startDate);
            }
            if (endDate) {
                query.date.$lte = new Date(endDate);
            }
        }

        const data = await Model.find(query)
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        const total = await Model.countDocuments(query);

        res.json({
            success: true,
            data: {
                symbol,
                timeframe,
                data,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Error fetching historical data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch historical data',
            error: error.message
        });
    }
});

/**
 * POST /api/historical/trigger-update
 * Manually trigger TradingView update (for testing)
 */
router.post('/trigger-update', authenticate, requireAdmin, async (req, res) => {
    try {
        const { timeframes } = req.body;

        if (!timeframes || !Array.isArray(timeframes)) {
            return res.status(400).json({
                success: false,
                message: 'timeframes array is required (e.g., ["daily"] or ["weekly", "monthly"])'
            });
        }

        const validTimeframes = ['daily', 'weekly', 'monthly'];
        const invalidTimeframes = timeframes.filter(tf => !validTimeframes.includes(tf));

        if (invalidTimeframes.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid timeframes: ${invalidTimeframes.join(', ')}. Valid: ${validTimeframes.join(', ')}`
            });
        }

        console.log(`\n🔧 Manual TradingView update triggered by admin: ${timeframes.join(', ')}`);

        const success = await tradingViewScheduler.manualTrigger(timeframes);

        if (success) {
            res.json({
                success: true,
                message: `TradingView update triggered for: ${timeframes.join(', ')}`,
                timeframes
            });
        } else {
            res.status(503).json({
                success: false,
                message: 'TradingView update failed. Check server logs for details.'
            });
        }
    } catch (error) {
        console.error('Error triggering TradingView update:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger TradingView update',
            error: error.message
        });
    }
});

/**
 * GET /api/historical/scheduler-status
 * Get TradingView scheduler status
 */
router.get('/scheduler-status', authenticate, requireAdmin, async (req, res) => {
    try {
        const status = tradingViewScheduler.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting scheduler status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get scheduler status',
            error: error.message
        });
    }
});

export default router;

