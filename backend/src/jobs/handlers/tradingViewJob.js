/**
 * TradingView Job Handler
 * 
 * Triggers TradingView Core Engine to update OHLCV data
 */

import axios from 'axios';
import config from '../../config/config.js';
import { stampPricesFromBars } from '../../services/priceFromBars.js';
import journalLevelHandler from '../../handlers/journalLevelHandler.js';
import { checkWatchlistLevels } from '../../services/watchlistLevels.js';

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

      // Fetching bars nobody reads the price from would be half a job. The
      // poller that used to write currentPrice is off, so the close that just
      // arrived is the price the portfolio should value against.
      const prices = await stampPricesFromBars();
      logger.info('Prices taken from the last close', prices);

      /**
       * And a price nobody compares against a level is two thirds of a job.
       *
       * checkLevels has been written, tested and unreachable: its only callers
       * were the price poller, which is disabled, and centralizedPriceService,
       * which nothing calls. So no stop and no target has ever raised a hand.
       * This is the missing call, and it belongs here because this is the job
       * that produces the price it reads.
       *
       * Failing it must not fail the sync. The bars are the valuable part and
       * they are already written by this point; a level that could not be
       * checked is checked again tomorrow.
       */
      let levels = null;
      try {
        levels = await journalLevelHandler.checkLevels();
        logger.info('Journal levels checked against the new close', levels);
      } catch (levelError) {
        logger.warn('Journal level check failed, prices are still stored', { error: levelError.message });
      }

      // The same close, against the levels you named while deciding whether to
      // trade at all. Separate from the journal's because the two answer
      // different questions and one failing must not silence the other.
      let watchlist = null;
      try {
        watchlist = await checkWatchlistLevels();
        logger.info('Shortlist levels checked against the new close', watchlist);
      } catch (levelError) {
        logger.warn('Shortlist level check failed, prices are still stored', { error: levelError.message });
      }

      return {
        success: true,
        message: `Updated ${timeframes.join(', ')} timeframes, ${prices.moved} price(s) moved`,
        metadata: { ...summary, ...prices, levels, watchlist }
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

