import express from 'express';
import TradingStrategy from '../models/TradingStrategy.js';
import pythonService from '../services/pythonStrategyService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/strategies
 * Get all strategies for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const strategies = await TradingStrategy.getUserStrategies(req.user.userId);
    res.json({
      success: true,
      strategies
    });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch strategies',
      error: error.message
    });
  }
});

/**
 * GET /api/strategies/available
 * Get available strategies from Python service
 */
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const result = await pythonService.listStrategies();
    res.json(result);
  } catch (error) {
    console.error('Error fetching available strategies:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch available strategies',
      error: error.details
    });
  }
});

/**
 * GET /api/strategies/:id
 * Get a specific strategy by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const strategy = await TradingStrategy.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    res.json({
      success: true,
      strategy
    });
  } catch (error) {
    console.error('Error fetching strategy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch strategy',
      error: error.message
    });
  }
});

/**
 * POST /api/strategies
 * Create a new strategy
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, pythonStrategy, pythonConfig, isActive } = req.body;

    // Validate required fields
    if (!name || !pythonStrategy || !pythonConfig) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, pythonStrategy, pythonConfig'
      });
    }

    // Verify strategy exists in Python service
    try {
      await pythonService.getStrategy(pythonStrategy);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Invalid Python strategy: ${pythonStrategy}`,
        error: error.message
      });
    }

    // Create strategy
    const strategy = new TradingStrategy({
      userId: req.user.userId,
      name,
      description,
      pythonStrategy,
      pythonConfig,
      isActive: isActive || false
    });

    await strategy.save();

    res.status(201).json({
      success: true,
      message: 'Strategy created successfully',
      strategy
    });
  } catch (error) {
    console.error('Error creating strategy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create strategy',
      error: error.message
    });
  }
});

/**
 * PUT /api/strategies/:id
 * Update a strategy
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, pythonConfig, isActive } = req.body;

    const strategy = await TradingStrategy.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    // Update fields
    if (name) strategy.name = name;
    if (description !== undefined) strategy.description = description;
    if (pythonConfig) strategy.pythonConfig = pythonConfig;
    if (isActive !== undefined) strategy.isActive = isActive;

    await strategy.save();

    res.json({
      success: true,
      message: 'Strategy updated successfully',
      strategy
    });
  } catch (error) {
    console.error('Error updating strategy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update strategy',
      error: error.message
    });
  }
});

/**
 * DELETE /api/strategies/:id
 * Delete a strategy
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const strategy = await TradingStrategy.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    res.json({
      success: true,
      message: 'Strategy deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting strategy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete strategy',
      error: error.message
    });
  }
});

/**
 * POST /api/strategies/:id/activate
 * Activate a strategy for live trading
 */
router.post('/:id/activate', authenticateToken, async (req, res) => {
  try {
    const strategy = await TradingStrategy.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    strategy.isActive = true;
    await strategy.save();

    res.json({
      success: true,
      message: 'Strategy activated successfully',
      strategy
    });
  } catch (error) {
    console.error('Error activating strategy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate strategy',
      error: error.message
    });
  }
});

/**
 * POST /api/strategies/:id/deactivate
 * Deactivate a strategy
 */
router.post('/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    const strategy = await TradingStrategy.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    strategy.isActive = false;
    await strategy.save();

    res.json({
      success: true,
      message: 'Strategy deactivated successfully',
      strategy
    });
  } catch (error) {
    console.error('Error deactivating strategy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate strategy',
      error: error.message
    });
  }
});

export default router;
