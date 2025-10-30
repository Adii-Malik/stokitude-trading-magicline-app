import express from 'express';
import BacktestResult from '../models/BacktestResult.js';
import TradingStrategy from '../models/TradingStrategy.js';
import pythonService from '../services/pythonStrategyService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/backtest/run
 * Trigger a new backtest
 */
router.post('/run', authenticate, async (req, res) => {
  try {
    const {
      strategyId,
      symbol,
      startDate,
      endDate,
      initialCapital,
      positionSizing,
      positionSizeValue,
      commission,
      slippage
    } = req.body;

    // Validate required fields
    if (!strategyId || !symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: strategyId, symbol, startDate, endDate'
      });
    }

    // Get strategy
    const strategy = await TradingStrategy.findOne({
      _id: strategyId,
      userId: req.user.userId
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    // Create backtest result record
    const backtestResult = new BacktestResult({
      userId: req.user.userId,
      strategyId: strategy._id,
      symbol: symbol.toUpperCase(),
      dateRange: {
        from: new Date(startDate),
        to: new Date(endDate)
      },
      config: {
        initial_capital: initialCapital || 100000,
        position_sizing: positionSizing || 'percentage',
        position_size_value: positionSizeValue || 50,
        commission: commission || 0.15,
        slippage: slippage || 0.1
      },
      status: 'running'
    });

    await backtestResult.save();

    // Prepare Python service request
    const pythonRequest = {
      symbol: symbol.toUpperCase(),
      strategy: strategy.pythonStrategy,
      config: strategy.pythonConfig,
      start_date: startDate,
      end_date: endDate,
      initial_capital: initialCapital || 100000,
      position_sizing: positionSizing || 'percentage',
      position_size_value: positionSizeValue || 50,
      commission: commission || 0.15,
      slippage: slippage || 0.1
    };

    // Call Python service asynchronously
    pythonService.runBacktest(pythonRequest)
      .then(async (result) => {
        if (result.success) {
          await backtestResult.markCompleted(result.performance, result.trades);

          // Update strategy performance
          await strategy.updatePerformance(result.performance);
        } else {
          await backtestResult.markFailed(result.error || 'Unknown error');
        }
      })
      .catch(async (error) => {
        console.error('Backtest error:', error);
        await backtestResult.markFailed(error.message);
      });

    // Return immediately with backtest ID
    res.status(202).json({
      success: true,
      message: 'Backtest started',
      backtestId: backtestResult._id,
      status: 'running'
    });

  } catch (error) {
    console.error('Error starting backtest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start backtest',
      error: error.message
    });
  }
});

/**
 * GET /api/backtest/:id
 * Get backtest result by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const backtest = await BacktestResult.getByIdForUser(req.params.id, req.user.userId);

    if (!backtest) {
      return res.status(404).json({
        success: false,
        message: 'Backtest not found'
      });
    }

    res.json({
      success: true,
      backtest
    });
  } catch (error) {
    console.error('Error fetching backtest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backtest',
      error: error.message
    });
  }
});

/**
 * GET /api/backtest/:id/status
 * Get backtest status
 */
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const backtest = await BacktestResult.findOne({
      _id: req.params.id,
      userId: req.user.userId
    }).select('status error completedAt');

    if (!backtest) {
      return res.status(404).json({
        success: false,
        message: 'Backtest not found'
      });
    }

    res.json({
      success: true,
      status: backtest.status,
      error: backtest.error,
      completedAt: backtest.completedAt
    });
  } catch (error) {
    console.error('Error fetching backtest status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backtest status',
      error: error.message
    });
  }
});

/**
 * GET /api/backtest/history
 * Get user's backtest history
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const backtests = await BacktestResult.getUserHistory(req.user.userId, limit);

    res.json({
      success: true,
      backtests
    });
  } catch (error) {
    console.error('Error fetching backtest history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backtest history',
      error: error.message
    });
  }
});

/**
 * DELETE /api/backtest/:id
 * Delete a backtest result
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const backtest = await BacktestResult.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!backtest) {
      return res.status(404).json({
        success: false,
        message: 'Backtest not found'
      });
    }

    res.json({
      success: true,
      message: 'Backtest deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting backtest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete backtest',
      error: error.message
    });
  }
});

export default router;
