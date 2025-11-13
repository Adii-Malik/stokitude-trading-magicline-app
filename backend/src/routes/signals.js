import express from 'express';
import TradingSignal from '../models/TradingSignal.js';
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
