/**
 * Signal Generation Job Handler
 * 
 * Generates trading signals for all active strategies
 */

import axios from 'axios';
import TradingStrategy from '../../models/TradingStrategy.js';
import config from '../../config/config.js';

export default async function signalGenerationJob(context) {
  const { logger, config: jobConfig } = context;
  
  logger.info('Starting signal generation...', { config: jobConfig });

  try {
    // Get active strategies
    const query = jobConfig.onlyActiveStrategies !== false 
      ? { isActive: true } 
      : {};

    const activeStrategies = await TradingStrategy.find(query)
      .select('name pythonStrategy pythonConfig userId')
      .lean();

    if (activeStrategies.length === 0) {
      logger.warn('No active strategies found');
      return {
        success: true,
        message: 'No active strategies to process',
        metadata: {
          strategiesCount: 0,
          signalsGenerated: 0
        }
      };
    }

    logger.info(`Found ${activeStrategies.length} active strategy(ies)`);

    let totalSignalsGenerated = 0;
    const errors = [];
    const results = [];

    // Generate signals for each strategy
    for (const strategy of activeStrategies) {
      logger.info(`Processing strategy: ${strategy.name}`, {
        pythonStrategy: strategy.pythonStrategy
      });

      try {
        // Call Python Core: POST /api/signals/generate
        const response = await axios.post(
          `${config.pythonCore.baseUrl}${config.pythonCore.endpoints.signals}`,
          {
            strategy: strategy.pythonStrategy,
            config: strategy.pythonConfig,
            save_to_db: jobConfig.saveToDatabase !== false,
            user_id: strategy.userId.toString(),
            strategy_id: strategy._id.toString()
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 300000 // 5 minutes
          }
        );

        if (response.data.success) {
          const count = response.data.total_signals || 0;
          totalSignalsGenerated += count;
          
          results.push({
            strategy: strategy.name,
            signals: count,
            success: true
          });

          logger.info(`Strategy completed: ${strategy.name}`, {
            signalsGenerated: count
          });
        }

      } catch (error) {
        errors.push({
          strategy: strategy.name,
          error: error.message
        });

        results.push({
          strategy: strategy.name,
          signals: 0,
          success: false,
          error: error.message
        });

        logger.error(`Strategy failed: ${strategy.name}`, {
          error: error.message
        });
      }
    }

    logger.info('Signal generation completed', {
      strategies: activeStrategies.length,
      totalSignals: totalSignalsGenerated,
      errors: errors.length
    });

    return {
      success: errors.length === 0 || totalSignalsGenerated > 0,
      message: `Generated ${totalSignalsGenerated} signals from ${activeStrategies.length} strategies`,
      metadata: {
        strategiesProcessed: activeStrategies.length,
        signalsGenerated: totalSignalsGenerated,
        errors: errors.length,
        results
      }
    };

  } catch (error) {
    logger.error('Signal generation job failed', {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: error.message,
      metadata: {
        errorCode: error.code || 'SIGNAL_GENERATION_ERROR'
      }
    };
  }
}

