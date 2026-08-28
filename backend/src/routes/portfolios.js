/**
 * Portfolio Routes
 * REST API endpoints for portfolio management
 * Supports CRUD, transactions, holdings, dashboard, sharing
 */
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { authenticate } from '../middleware/auth.js';
import portfolioService from '../services/portfolioService.js';
import performanceService from '../services/portfolio/performanceService.js';
import allocationEngineService from '../services/allocationEngineService.js';
import FundamentalsAggregator from '../services/portfolio/fundamentalsSources/FundamentalsAggregator.js';
import CalculatorRegistry from '../services/portfolio/calculators/CalculatorRegistry.js';
import StockFundamental from '../models/StockFundamental.js';
import PortfolioPolicy from '../models/PortfolioPolicy.js';
import SIPPlan from '../models/SIPPlan.js';
import Recommendation from '../models/Recommendation.js';
import Transaction from '../models/Transaction.js';

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

// All routes require authentication
router.use(authenticate);


// ===== Portfolio CRUD =====

/**
 * GET /api/portfolios
 * Get all portfolios accessible by user (with dashboard summary)
 */
router.get('/', async (req, res) => {
    try {
        // One batched pass, not a dashboard per portfolio. The cards read three
        // numbers; the dashboard computed tax years, filer status and disposals
        // for each of them, six sequential queries at a time.
        const summaries = await portfolioService.summaries(req.user._id);

        res.json({
            success: true,
            count: summaries.length,
            data: summaries
        });
    } catch (error) {
        console.error('Error fetching portfolios:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/portfolios
 * Create new portfolio
 */
router.post('/', async (req, res) => {
    try {
        const {
            name, description, calculationMethod, currency, color, tags,
            commissionSlabs, charges, taxRatePct
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Portfolio name is required'
            });
        }

        const userId = req.user._id;
        const portfolio = await portfolioService.createPortfolio(userId, {
            name,
            description,
            calculationMethod,
            currency,

            // Fee settings are configured on the create form, so they have to
            // survive it - omitting them here silently discarded the slabs.
            commissionSlabs,
            charges,
            taxRatePct,
            color,
            tags
        });

        res.status(201).json({
            success: true,
            message: 'Portfolio created successfully',
            data: portfolio
        });
    } catch (error) {
        console.error('Error creating portfolio:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/:id
 * Get portfolio details
 */
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user._id;
        const portfolio = await portfolioService.getPortfolio(req.params.id, userId);

        res.json({
            success: true,
            data: portfolio
        });
    } catch (error) {
        const status = error.message.includes('Access denied') ? 403 :
            error.message.includes('not found') ? 404 : 500;

        res.status(status).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PUT /api/portfolios/:id
 * Update portfolio
 */
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user._id;
        const updates = req.body;
        const portfolio = await portfolioService.updatePortfolio(
            req.params.id,
            userId,
            updates
        );

        res.json({
            success: true,
            message: 'Portfolio updated successfully',
            data: portfolio
        });
    } catch (error) {
        const status = error.message.includes('permission') ? 403 : 500;

        res.status(status).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/portfolios/:id
 * Soft delete portfolio (set isActive = false)
 */
router.delete('/:id', async (req, res) => {
    try {
        const portfolio = await portfolioService.updatePortfolio(
            req.params.id,
            req.user._id,
            { isActive: false }
        );

        res.json({
            success: true,
            message: 'Portfolio deleted successfully',
            data: portfolio
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ===== Portfolio Sharing =====

/**
 * POST /api/portfolios/:id/share
 * Share portfolio with another user
 */
router.post('/:id/share', async (req, res) => {
    try {
        const { userId, role } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const portfolio = await portfolioService.sharePortfolio(
            req.params.id,
            req.user._id,
            userId,
            role || 'viewer'
        );

        res.json({
            success: true,
            message: 'Portfolio shared successfully',
            data: portfolio
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/portfolios/:id/share/:userId
 * Unshare portfolio
 */
router.delete('/:id/share/:userId', async (req, res) => {
    try {
        const portfolio = await portfolioService.unsharePortfolio(
            req.params.id,
            req.user._id,
            req.params.userId
        );

        res.json({
            success: true,
            message: 'Portfolio unshared successfully',
            data: portfolio
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ===== Transactions =====

/**
 * GET /api/portfolios/:id/transactions
 * Get transactions for portfolio
 */
router.get('/:id/transactions', async (req, res) => {
    try {
        const { symbol, type, from, to, limit } = req.query;

        const transactions = await portfolioService.getTransactions(
            req.params.id,
            req.user._id,
            { symbol, type, from, to, limit: parseInt(limit) || 200 }
        );

        // `total` tells the client whether it is looking at everything - a
        // capped list with no indication silently hides the rest of the ledger.
        const total = await Transaction.countDocuments({ portfolioId: req.params.id });

        res.json({
            success: true,
            count: transactions.length,
            total,
            data: transactions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/:id/symbols/:symbol
 * One symbol's position, result and full ledger
 */
router.get('/:id/symbols/:symbol', async (req, res) => {
    try {
        const data = await portfolioService.symbolDetail(req.params.id, req.user._id, req.params.symbol);
        res.json({ success: true, data });
    } catch (error) {
        const status = error.code === 'NOT_FOUND' ? 404
            : error.message.includes('Access denied') ? 403 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/portfolios/:id/transactions
 * Add transaction
 */
router.post('/:id/transactions', async (req, res) => {
    try {
        const userId = req.user._id;
        const transaction = await portfolioService.addTransaction(
            req.params.id,
            userId,
            req.body
        );

        res.status(201).json({
            success: true,
            message: 'Transaction added successfully',
            data: transaction
        });
    } catch (error) {
        const isValidation = ['INSUFFICIENT_SHARES', 'DUPLICATE_TRANSACTION'].includes(error.code);
        res.status(isValidation ? 400 : 500).json({
            success: false,
            code: error.code,
            held: error.held,
            message: error.message
        });
    }
});

/**
 * PUT /api/portfolios/:portfolioId/transactions/:transactionId
 * Update transaction
 */
router.put('/:portfolioId/transactions/:transactionId', async (req, res) => {
    try {
        const transaction = await portfolioService.updateTransaction(
            req.params.transactionId,
            req.user._id,
            req.body
        );

        res.json({
            success: true,
            message: 'Transaction updated successfully',
            data: transaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/portfolios/:portfolioId/transactions/:transactionId
 * Delete transaction
 */
router.delete('/:portfolioId/transactions/:transactionId', async (req, res) => {
    try {
        await portfolioService.deleteTransaction(req.params.transactionId, req.user._id);

        res.json({
            success: true,
            message: 'Transaction deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/** Read one CSV row into a transaction. Returns { transaction } or { error }. */
export function parseTransactionRow(row) {
    // Case-insensitive, and strips the BOM spreadsheets prepend.
    const lower = {};
    for (const [key, value] of Object.entries(row)) {
        lower[key.replace(/^\uFEFF/, '').trim().toLowerCase()] = value;
    }
    const field = (...names) => {
        for (const name of names) {
            const value = lower[name];
            if (value !== undefined && String(value).trim() !== '') return String(value).trim();
        }
        return '';
    };
    const number = (...names) => {
        const raw = field(...names);
        return raw === '' ? NaN : parseFloat(raw.replace(/,/g, ''));
    };

    const type = field('type').toUpperCase();
    const symbol = field('symbol').toUpperCase();
    const executedAt = field('executedat', 'date');

    if (!type || !executedAt) return { error: 'type and executedAt are required' };

    const when = new Date(executedAt);
    if (isNaN(when.getTime())) return { error: `Unrecognised date "${executedAt}"` };

    const transaction = { type, executedAt: when, notes: field('notes') };

    const exchange = field('exchange').toUpperCase();
    if (exchange) transaction.exchange = exchange;

    if (['BUY', 'SELL'].includes(type)) {
        if (!symbol) return { error: 'symbol is required for BUY/SELL' };

        const quantity = number('quantity');
        const price = number('price');
        if (isNaN(quantity) || isNaN(price)) {
            return { error: 'Valid quantity and price are required for BUY/SELL' };
        }

        transaction.symbol = symbol;
        transaction.quantity = quantity;
        transaction.price = price;
        transaction.fees = number('fees') || 0;
        transaction.otherCharges = number('othercharges') || 0;
    } else if (type === 'DIV') {
        if (!symbol) return { error: 'symbol is required for DIV' };

        const dividendCash = number('dividendcash', 'amount');
        if (isNaN(dividendCash)) return { error: 'Valid dividendCash is required for DIV' };

        transaction.symbol = symbol;
        transaction.dividendCash = dividendCash;
        transaction.dividendType = 'CASH';
    } else if (['DEPOSIT', 'WITHDRAW'].includes(type)) {
        const cashAmount = number('cashamount', 'amount');
        if (isNaN(cashAmount)) return { error: `Valid cashAmount is required for ${type}` };

        transaction.cashAmount = cashAmount;
    } else if (['SPLIT', 'BONUS'].includes(type)) {
        if (!symbol) return { error: `symbol is required for ${type}` };

        const ratio = field('ratio');
        if (!ratio) return { error: `ratio is required for ${type} (e.g. "2:1" or "20%")` };

        transaction.symbol = symbol;
        transaction.ratio = ratio;
    } else {
        return { error: `Unknown type "${type}". Use BUY, SELL, DIV, DEPOSIT, WITHDRAW, SPLIT or BONUS` };
    }

    return { transaction };
}

/**
 * POST /api/portfolios/:id/transactions/upload/csv
 * Bulk upload transactions from CSV
 */
router.post('/:id/transactions/upload/csv', upload.single('file'), async (req, res) => {
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
                        const parsed = parseTransactionRow(row);
                        if (parsed.error) {
                            errors.push({ line: lineNumber, error: parsed.error, data: row });
                            return;
                        }
                        results.push(parsed.transaction);
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

        // Tag every row of this upload so a batch can be traced or rolled back
        const importBatchId = new mongoose.Types.ObjectId();

        // Oldest first: a SELL is validated against shares held at that moment,
        // so replaying a newest-first export would reject every one of them.
        results.sort((a, b) => new Date(a.executedAt) - new Date(b.executedAt));

        // Validated in memory rather than per row: a file of a few hundred rows
        // was several thousand round trips, which outran the client timeout.
        const bulk = await portfolioService.importTransactions(
            req.params.id, req.user._id, results, importBatchId
        );
        const { inserted, skipped } = bulk;
        errors.push(...bulk.errors);

        // One rebuild per symbol, rather than one per row.
        if (inserted > 0) {
            await portfolioService.rebuildPositions(req.params.id, req.user._id);
        }

        res.json({
            success: true,
            message: skipped > 0
                ? `Imported ${inserted} transaction(s), skipped ${skipped} already present`
                : 'Transactions uploaded successfully',
            data: {
                total: results.length,
                inserted,
                skipped,
                importBatchId,
                errors: errors.length > 0 ? errors : undefined
            }
        });
    } catch (error) {
        console.error('Error uploading transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload transactions',
            error: error.message
        });
    }
});

// ===== Holdings & Dashboard =====

/**
 * GET /api/portfolios/:id/holdings
 * Get current holdings
 */
router.get('/:id/holdings', async (req, res) => {
    try {
        const userId = req.user._id;
        const holdings = await portfolioService.getHoldings(req.params.id, userId, {
            includeClosed: req.query.includeClosed === 'true'
        });

        res.json({
            success: true,
            count: holdings.length,
            data: holdings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/:id/dashboard
 * Get portfolio dashboard (summary + holdings)
 */
router.get('/:id/dashboard', async (req, res) => {
    try {
        const userId = req.user._id;
        const dashboard = await portfolioService.getDashboard(req.params.id, userId);

        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/:id/performance
 * Daily value series, benchmark comparison, XIRR and drawdown.
 */
router.get('/:id/performance', async (req, res) => {
    try {
        await portfolioService.getPortfolio(req.params.id, req.user._id);
        const data = await performanceService.performance(req.params.id, {
            from: req.query.from,
            benchmark: req.query.benchmark || 'KSE100'
        });

        res.json({ success: true, data });
    } catch (error) {
        const status = error.message.includes('Access denied') ? 403 :
            error.message.includes('not found') ? 404 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/portfolios/:id/rebuild
 * Rebuild all positions (admin/debugging)
 */
router.post('/:id/rebuild', async (req, res) => {
    try {
        const userId = req.user._id;
        const results = await portfolioService.rebuildPositions(req.params.id, userId);

        const success = results.filter(r => r.status === 'success').length;
        const errors = results.filter(r => r.status === 'error').length;

        res.json({
            success: true,
            message: `Rebuilt ${success} positions, ${errors} errors`,
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/:id/transactions/export
 * Download transactions as CSV. Columns match the import format.
 */
router.get('/:id/transactions/export', async (req, res) => {
    try {
        const portfolio = await portfolioService.getPortfolio(req.params.id, req.user._id);
        const transactions = await portfolioService.getTransactions(req.params.id, req.user._id);

        const columns = ['symbol', 'exchange', 'type', 'quantity', 'price', 'fees', 'otherCharges', 'dividendCash', 'cashAmount', 'ratio', 'executedAt', 'notes'];
        const escape = (v) => {
            if (v === null || v === undefined) return '';
            const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const rows = transactions.map(tx => columns.map(c => escape(tx[c])).join(','));
        const csv = [columns.join(','), ...rows].join('\n');
        const filename = `${portfolio.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-transactions.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ===== Fundamentals =====

/**
 * GET /api/portfolios/fundamentals/:symbol
 * Get fundamental data for a symbol
 */
router.get('/fundamentals/:symbol', async (req, res) => {
    try {
        const { forceRefresh } = req.query;
        const fundamental = await FundamentalsAggregator.getFundamentals(
            req.params.symbol,
            forceRefresh === 'true'
        );

        res.json({
            success: true,
            data: fundamental
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/portfolios/fundamentals/batch-refresh
 * Batch refresh fundamentals (admin only)
 */
router.post('/fundamentals/batch-refresh', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { symbols } = req.body;

        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({
                success: false,
                message: 'Symbols array is required'
            });
        }

        const results = await FundamentalsAggregator.refreshAll(symbols);

        res.json({
            success: true,
            message: `Refreshed ${symbols.length} symbols`,
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PUT /api/portfolios/fundamentals/:symbol
 * Manually update fundamental data (admin only)
 */
router.put('/fundamentals/:symbol', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const symbol = req.params.symbol.toUpperCase();
        const updates = {
            ...req.body,
            symbol,
            manualOverride: true,
            lastUpdated: new Date(),
            dataSource: 'MANUAL'
        };

        const fundamental = await StockFundamental.findOneAndUpdate(
            { symbol },
            updates,
            { upsert: true, new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Fundamental data updated successfully',
            data: fundamental
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/fundamentals/stale/list
 * Get list of stale symbols
 */
router.get('/fundamentals/stale/list', async (req, res) => {
    try {
        const { maxAgeHours } = req.query;
        const staleSymbols = await FundamentalsAggregator.getStaleSymbols(
            parseInt(maxAgeHours) || 24
        );

        res.json({
            success: true,
            count: staleSymbols.length,
            data: staleSymbols
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ===== System Info =====

/**
 * GET /api/portfolios/calculators/available
 * Get available P/L calculation methods
 */
router.get('/calculators/available', async (req, res) => {
    try {
        const calculators = CalculatorRegistry.getAll();

        res.json({
            success: true,
            data: calculators
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ===== Allocation Engine Routes =====

/**
 * GET /api/portfolios/:id/policy
 * Get allocation policy
 */
router.get('/:id/policy', async (req, res) => {
    try {
        const policy = await PortfolioPolicy.findOne({ portfolioId: req.params.id });

        res.json({
            success: true,
            data: policy
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PUT /api/portfolios/:id/policy
 * Create or update allocation policy
 */
router.put('/:id/policy', async (req, res) => {
    try {
        const policy = await PortfolioPolicy.findOneAndUpdate(
            { portfolioId: req.params.id },
            { ...req.body, portfolioId: req.params.id },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({
            success: true,
            data: policy
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/portfolios/:id/policy
 * Delete allocation policy
 */
router.delete('/:id/policy', async (req, res) => {
    try {
        await PortfolioPolicy.findOneAndDelete({ portfolioId: req.params.id });

        // Also delete associated recommendations
        await Recommendation.deleteMany({ portfolioId: req.params.id });

        res.json({
            success: true,
            message: 'Policy and recommendations deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/:id/sip-plan
 * Get SIP plan
 */
router.get('/:id/sip-plan', async (req, res) => {
    try {
        const plan = await SIPPlan.findOne({ portfolioId: req.params.id });

        res.json({
            success: true,
            data: plan
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PUT /api/portfolios/:id/sip-plan
 * Create or update SIP plan
 */
router.put('/:id/sip-plan', async (req, res) => {
    try {
        const plan = await SIPPlan.findOneAndUpdate(
            { portfolioId: req.params.id },
            { ...req.body, portfolioId: req.params.id },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({
            success: true,
            data: plan
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/portfolios/:id/sip-plan
 * Delete SIP plan
 */
router.delete('/:id/sip-plan', async (req, res) => {
    try {
        await SIPPlan.findOneAndDelete({ portfolioId: req.params.id });

        res.json({
            success: true,
            message: 'SIP plan deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/portfolios/:id/recommendations/generate
 * Generate SIP allocation recommendation
 */
router.post('/:id/recommendations/generate', async (req, res) => {
    try {
        const { forMonth, autoApprove } = req.body;

        if (!forMonth) {
            return res.status(400).json({
                success: false,
                message: 'forMonth (YYYY-MM) is required'
            });
        }

        const userId = req.user._id;
        const recommendation = await allocationEngineService.generateRecommendation(
            req.params.id,
            forMonth,
            { autoApprove, userId }
        );

        res.json({
            success: true,
            data: recommendation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/:id/recommendations
 * Get all recommendations for portfolio
 */
router.get('/:id/recommendations', async (req, res) => {
    try {
        const recommendations = await Recommendation.find({ portfolioId: req.params.id })
            .sort({ forMonth: -1 })
            .limit(12);

        res.json({
            success: true,
            count: recommendations.length,
            data: recommendations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/:id/recommendations/:month
 * Get specific recommendation
 */
router.get('/:id/recommendations/:month', async (req, res) => {
    try {
        const recommendation = await Recommendation.findOne({
            portfolioId: req.params.id,
            forMonth: req.params.month
        });

        res.json({
            success: true,
            data: recommendation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PATCH /api/portfolios/:id/recommendations/:month/approve
 * Approve recommendation
 */
router.patch('/:id/recommendations/:month/approve', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const recommendation = await Recommendation.findOneAndUpdate(
            { portfolioId: req.params.id, forMonth: req.params.month },
            {
                status: 'APPROVED',
                approvedBy: userId,
                approvedAt: new Date()
            },
            { new: true }
        );

        if (!recommendation) {
            return res.status(404).json({
                success: false,
                message: 'Recommendation not found'
            });
        }

        res.json({
            success: true,
            data: recommendation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PATCH /api/portfolios/:id/recommendations/:month/execute
 * Mark recommendation as executed and create transactions
 */
router.patch('/:id/recommendations/:month/execute', authenticate, async (req, res) => {
    try {
        const recommendation = await Recommendation.findOne({
            portfolioId: req.params.id,
            forMonth: req.params.month
        });

        if (!recommendation) {
            return res.status(404).json({
                success: false,
                message: 'Recommendation not found'
            });
        }

        // Create BUY transactions for each allocation. Concurrent, not serial:
        // each create is a round trip, and updatePosition below costs six more
        // per symbol. Awaited one at a time that is seconds of dead waiting.
        // create() rather than insertMany() because the pre('save') hook carries
        // the type validation, and insertMany does not run it.
        const executionDate = new Date();
        const transactions = await Promise.all(
            recommendation.allocations.map(alloc => Transaction.create({
                portfolioId: req.params.id,
                symbol: alloc.symbol,
                type: 'BUY',
                quantity: alloc.estShares,
                price: alloc.estPrice,
                fees: 0, // User can edit later if needed
                executedAt: executionDate,
                notes: `SIP ${recommendation.forMonth} - Auto-created from recommendation`,
                createdBy: req.user._id
            }))
        );

        // One symbol failing to rebuild must not lose the others.
        const symbolsToUpdate = [...new Set(recommendation.allocations.map(a => a.symbol))];
        await Promise.all(symbolsToUpdate.map(symbol =>
            portfolioService.updatePosition(req.params.id, symbol)
                .catch(posError => console.error(`Failed to update position for ${symbol}:`, posError.message))
        ));

        // Update recommendation status
        recommendation.status = 'EXECUTED';
        recommendation.executedAt = executionDate;
        await recommendation.save();

        res.json({
            success: true,
            data: recommendation,
            transactions: transactions,
            message: `Created ${transactions.length} BUY transactions and updated positions`
        });
    } catch (error) {
        console.error('❌ Error executing recommendation:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/portfolios/:id/drift
 * Check portfolio drift from target weights
 */
router.get('/:id/drift', async (req, res) => {
    try {
        const drift = await allocationEngineService.checkDrift(req.params.id);

        res.json({
            success: true,
            data: drift
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
