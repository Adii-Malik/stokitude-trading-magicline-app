import express from 'express';
import TradingSignal from '../models/TradingSignal.js';
import TradingStrategy from '../models/TradingStrategy.js';
import pythonService from '../services/pythonStrategyService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/signals
 * Get all signals for the authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const signals = await TradingSignal.getRecentSignals(req.user.userId, limit);

    res.json({
      success: true,
      signals
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch signals',
      error: error.message
    });
  }
});

/**
 * GET /api/signals/:id
 * Get a specific signal by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const signal = await TradingSignal.findOne({
      _id: req.params.id,
      userId: req.user.userId
    }).populate('strategyId', 'name pythonStrategy');

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Signal not found'
      });
    }

    res.json({
      success: true,
      signal
    });
  } catch (error) {
    console.error('Error fetching signal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch signal',
      error: error.message
    });
  }
});

/**
 * POST /api/signals/generate
 * Generate a signal for a specific symbol and strategy
 */
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { strategyId, symbol, startDate, endDate } = req.body;

    // Validate required fields
    if (!strategyId || !symbol) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: strategyId, symbol'
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

    // Check if signal already exists for today
    const signalExists = await TradingSignal.signalExistsToday(
      req.user.userId,
      strategyId,
      symbol.toUpperCase()
    );

    if (signalExists) {
      return res.status(400).json({
        success: false,
        message: 'Signal already generated for this symbol today'
      });
    }

    // Prepare Python service request
    const pythonRequest = {
      symbol: symbol.toUpperCase(),
      strategy: strategy.pythonStrategy,
      config: strategy.pythonConfig,
      start_date: startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: endDate || new Date().toISOString().split('T')[0]
    };

    // Call Python service
    const result = await pythonService.generateSignals(pythonRequest);

    if (!result.success || !result.signals || result.signals.length === 0) {
      return res.json({
        success: true,
        message: 'No signals generated',
        signals: []
      });
    }

    // Save signals to database
    const savedSignals = [];
    for (const signalData of result.signals) {
      const signal = new TradingSignal({
        userId: req.user.userId,
        symbol: symbol.toUpperCase(),
        signalType: signalData.type,
        price: signalData.price,
        date: new Date(signalData.date),
        strategyId: strategy._id,
        strategyName: strategy.name,
        indicators: signalData.indicators || {},
        reasoning: signalData.reason || '',
        source: 'python_service'
      });

      await signal.save();
      savedSignals.push(signal);
    }

    // Update strategy's last signal date
    strategy.lastSignalDate = new Date();
    await strategy.save();

    res.json({
      success: true,
      message: `Generated ${savedSignals.length} signal(s)`,
      signals: savedSignals
    });

  } catch (error) {
    console.error('Error generating signal:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to generate signal',
      error: error.details
    });
  }
});

/**
 * POST /api/signals/batch
 * Generate signals for multiple symbols
 */
router.post('/batch', authenticate, async (req, res) => {
  try {
    const { strategyId, symbols } = req.body;

    // Validate required fields
    if (!strategyId || !symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: strategyId, symbols (array)'
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

    // Prepare Python service request
    const pythonRequest = {
      symbols: symbols.map(s => s.toUpperCase()),
      strategy: strategy.pythonStrategy,
      config: strategy.pythonConfig,
      start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0]
    };

    // Call Python service
    const result = await pythonService.batchGenerateSignals(pythonRequest);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate batch signals'
      });
    }

    // Save signals to database
    const savedSignals = [];
    for (const [symbol, symbolResult] of Object.entries(result.results)) {
      if (symbolResult.success && symbolResult.signals) {
        for (const signalData of symbolResult.signals) {
          const signal = new TradingSignal({
            userId: req.user.userId,
            symbol: symbol.toUpperCase(),
            signalType: signalData.type,
            price: signalData.price,
            date: new Date(signalData.date),
            strategyId: strategy._id,
            strategyName: strategy.name,
            indicators: signalData.indicators || {},
            reasoning: signalData.reason || '',
            source: 'python_service'
          });

          await signal.save();
          savedSignals.push(signal);
        }
      }
    }

    // Update strategy's last signal date
    strategy.lastSignalDate = new Date();
    await strategy.save();

    res.json({
      success: true,
      message: `Generated ${savedSignals.length} signal(s) across ${symbols.length} symbol(s)`,
      signals: savedSignals
    });

  } catch (error) {
    console.error('Error generating batch signals:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to generate batch signals',
      error: error.details
    });
  }
});

/**
 * PUT /api/signals/:id/execute
 * Mark a signal as executed
 */
router.put('/:id/execute', authenticate, async (req, res) => {
  try {
    const { executedPrice } = req.body;

    const signal = await TradingSignal.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Signal not found'
      });
    }

    if (signal.isExecuted) {
      return res.status(400).json({
        success: false,
        message: 'Signal already marked as executed'
      });
    }

    await signal.markExecuted(executedPrice);

    res.json({
      success: true,
      message: 'Signal marked as executed',
      signal
    });
  } catch (error) {
    console.error('Error marking signal as executed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark signal as executed',
      error: error.message
    });
  }
});

/**
 * GET /api/signals/pending
 * Get pending (unexecuted) signals
 */
router.get('/pending', authenticate, async (req, res) => {
  try {
    const signals = await TradingSignal.getPendingSignals(req.user.userId);

    res.json({
      success: true,
      signals
    });
  } catch (error) {
    console.error('Error fetching pending signals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending signals',
      error: error.message
    });
  }
});

export default router;
