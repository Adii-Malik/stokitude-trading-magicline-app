/**
 * TradingView Job Handler
 * 
 * Triggers TradingView Core Engine to update OHLCV data
 */

import axios from 'axios';
import config from '../../config/config.js';
import { stampPricesFromBars } from '../../services/priceFromBars.js';

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
      const summary = response.data.summary || {};

      logger.info('TradingView update completed', summary);

      /**
       * Fetching bars nobody reads the price from would be half a job. The
       * poller that used to write currentPrice is off, so the close that just
       * arrived is the price the portfolio values against - every holding, both
       * P&L calculators, the ledger and the allocation engine read it.
       *
       * This job used to check the journal's and the shortlist's levels too,
       * because it was the job that produced the price they read. It no longer
       * is: they read the live feed on their own fifteen-minute clock, and
       * leaving a duplicate call here would have watched a stop once a day at
       * five o'clock. What is left is one responsibility - the warehouse - and
       * that is the whole job.
       */
      const prices = await stampPricesFromBars();
      logger.info('Prices taken from the last close', prices);

      return {
        success: true,
        message: `Updated ${timeframes.join(', ')} timeframes, ${prices.moved} price(s) moved`,
        metadata: { ...summary, ...prices }
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

