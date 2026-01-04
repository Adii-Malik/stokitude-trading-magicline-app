/**
 * Portfolio Routes
 * REST API endpoints for portfolio management
 * Supports CRUD, transactions, holdings, dashboard, sharing
 */
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import portfolioService from '../services/portfolioService.js';
import allocationEngineService from '../services/allocationEngineService.js';
import FundamentalsAggregator from '../services/portfolio/fundamentalsSources/FundamentalsAggregator.js';
import CalculatorRegistry from '../services/portfolio/calculators/CalculatorRegistry.js';
import StockFundamental from '../models/StockFundamental.js';
import PortfolioPolicy from '../models/PortfolioPolicy.js';
import SIPPlan from '../models/SIPPlan.js';
import Recommendation from '../models/Recommendation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ===== Portfolio CRUD =====

/**
 * GET /api/portfolios
 * Get all portfolios accessible by user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user._id;
        const portfolios = await portfolioService.getAccessiblePortfolios(userId);

        res.json({
            success: true,
            count: portfolios.length,
            data: portfolios
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
        const { name, description, calculationMethod, currency, color, tags } = req.body;

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
            { symbol, type, from, to, limit: parseInt(limit) || 100 }
        );

        res.json({
            success: true,
            count: transactions.length,
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
        res.status(500).json({
            success: false,
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

// ===== Holdings & Dashboard =====

/**
 * GET /api/portfolios/:id/holdings
 * Get current holdings
 */
router.get('/:id/holdings', async (req, res) => {
    try {
        const userId = req.user._id;
        const holdings = await portfolioService.getHoldings(req.params.id, userId);

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
router.patch('/:id/recommendations/:month/approve', async (req, res) => {
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
 * Mark recommendation as executed
 */
router.patch('/:id/recommendations/:month/execute', async (req, res) => {
    try {
        const recommendation = await Recommendation.findOneAndUpdate(
            { portfolioId: req.params.id, forMonth: req.params.month },
            {
                status: 'EXECUTED',
                executedAt: new Date()
            },
            { new: true }
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
