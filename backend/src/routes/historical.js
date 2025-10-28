import express from 'express';
import Stock from '../models/Stock.js';
import PsxDaily from '../models/PsxDaily.js';
import PsxWeekly from '../models/PsxWeekly.js';
import PsxMonthly from '../models/PsxMonthly.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import historicalDataScraper from '../services/historicalDataScraper.js';
import dataAggregationService from '../services/dataAggregationService.js';

const router = express.Router();

// Apply authentication and admin check to all routes
router.use(authenticate, requireAdmin);

// POST /api/historical/scrape - Scrape historical data for symbols
router.post('/scrape', async (req, res) => {
    try {
        const { symbols, startDate, endDate } = req.body;

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Symbols array is required and must not be empty'
            });
        }

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        // Start scraping in background
        res.json({
            success: true,
            message: 'Scraping started',
            data: {
                symbolsCount: symbols.length,
                startDate,
                endDate
            }
        });

        // Background job - don't await
        (async () => {
            for (const symbol of symbols) {
                try {
                    console.log(`📥 Starting scrape for ${symbol}...`);

                    // Get or create stock record
                    let stock = await Stock.findOne({ symbol });
                    if (!stock) {
                        stock = await Stock.create({ symbol, companyName: symbol });
                    }

                    // Update status
                    stock.scrapeStatus = 'in_progress';
                    stock.scrapeProgress = { total: 0, completed: 0, failed: 0 };
                    await stock.save();

                    // Scrape date range
                    const results = await historicalDataScraper.scrapeDateRange(
                        symbol,
                        startDate,
                        endDate
                    );

                    // Save to database
                    for (const data of results.success) {
                        await PsxDaily.findOneAndUpdate(
                            { symbol: data.symbol, date: data.date },
                            {
                                stockId: stock._id,
                                ...data
                            },
                            { upsert: true, new: true }
                        );
                    }

                    // Aggregate to weekly/monthly
                    await dataAggregationService.aggregateAll(symbol);

                    // Update status
                    stock.scrapeStatus = 'completed';
                    stock.historicalDataStatus = 'available';
                    stock.lastScrapedDate = new Date();
                    stock.scrapeProgress = {
                        total: results.total,
                        completed: results.success.length,
                        failed: results.failed.length
                    };
                    await stock.save();

                    console.log(`✅ Scrape completed for ${symbol}: ${results.success.length}/${results.total} records`);
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
        let dateField;

        if (timeframe === 'weekly') {
            Model = PsxWeekly;
            dateField = 'weekStart';
        } else if (timeframe === 'monthly') {
            Model = PsxMonthly;
            dateField = 'monthStart';
        } else {
            Model = PsxDaily;
            dateField = 'date';
        }

        // Build query with date filters
        const query = { symbol };
        if (startDate || endDate) {
            query[dateField] = {};
            if (startDate) {
                query[dateField].$gte = new Date(startDate);
            }
            if (endDate) {
                query[dateField].$lte = new Date(endDate);
            }
        }

        const data = await Model.find(query)
            .sort({ [dateField]: -1 })
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

export default router;

