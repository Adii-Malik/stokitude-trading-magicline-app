/**
 * TradingView Job Handler
 * 
 * Triggers TradingView Core Engine to update OHLCV data
 */

import axios from 'axios';
import config from '../../config/config.js';

export default async function tradingViewJob(context) {
  const { logger, config: jobConfig } = context;
  
  const timeframes = jobConfig.timeframes || ['daily'];
  const coreEngineUrl = `${config.pythonCore.baseUrl}${config.pythonCore.endpoints.tradingviewUpdate}`;
  const timeout = config.dataSources.tradingview.timeout;

  logger.info('Triggering TradingView Core Engine update...', { 
    timeframes,
    url: coreEngineUrl 
  });

  try {
    const response = await axios.post(
      coreEngineUrl,
      { timeframes },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout
      }
    );

    if (response.data && response.data.success) {
      const data = response.data.data || {};

      logger.info('TradingView update completed', {
        symbolsProcessed: data.symbolsProcessed,
        recordsUpdated: data.recordsUpdated,
        duration: data.duration
      });

      return {
        success: true,
        message: `Updated ${timeframes.join(', ')} timeframes successfully`,
        metadata: {
          timeframes,
          symbolsProcessed: data.symbolsProcessed || 0,
          recordsUpdated: data.recordsUpdated || 0,
          coreDuration: data.duration
        }
      };
    } else {
      throw new Error(response.data?.message || 'Invalid response from TradingView Core Engine');
    }

  } catch (error) {
    let errorMessage = error.message;
    let errorCode = error.code;

    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'TradingView Core Engine is not running (port 5002)';
      errorCode = 'CORE_NOT_RUNNING';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'TradingView update timed out (may still be processing)';
      errorCode = 'TIMEOUT';
    }

    logger.error('TradingView update failed', { 
      error: errorMessage,
      code: errorCode,
      timeframes 
    });

    return {
      success: false,
      message: errorMessage,
      metadata: {
        timeframes,
        errorCode
      }
    };
  }
}

