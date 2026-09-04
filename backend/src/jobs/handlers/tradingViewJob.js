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
       * Fetching bars and not stamping the close would be half a job. This is
       * the only writer of Stock.currentPrice, and it is PSX-only, because
       * PsxDaily is what the engine fills.
       *
       * That column is no longer what the app values against. It was, and being
       * the sole owner of every price is how it came to misprice the whole US
       * book at zero and hold NRL at 499.74 for three weeks: one nightly writer,
       * one market, no way to tell a stale number from a live one. Valuation
       * reads quotesFor now, which asks the scanner first. What is stamped here
       * is the fallback underneath it - the last known close for when the feed
       * cannot be reached, and the reason a PSX screen still has numbers on it
       * when TradingView is down.
       *
       * The level checks left for the same reason. They hung here because this
       * was the job that produced the price they read; it no longer is, and
       * leaving them would have watched a stop once a day at five o'clock.
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

