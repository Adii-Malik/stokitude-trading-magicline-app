/**
 * Price Polling Job Handler
 * 
 * Wraps the existing centralizedPriceService logic
 */

import Stock from '../../models/Stock.js';
import psxScraper from '../../services/psxScraper.js';
import marketHoursService from '../../services/marketHoursService.js';
import journalLevelHandler from '../../handlers/journalLevelHandler.js';

export default async function pricePollingJob(context) {
  const { logger, config } = context;

  const startTime = Date.now();

  logger.info('Starting price fetch...', { config });

  try {
    // Check market hours (unless skipMarketCheck is enabled)
    if (!config.skipMarketCheck) {
      const marketStatus = marketHoursService.getMarketStatus();

      if (!marketStatus.isOpen) {
        logger.info(`Market is ${marketStatus.status}, skipping price fetch`, {
          marketStatus: marketStatus.status,
          nextOpen: marketStatus.nextOpen
        });

        return {
          success: true,
          message: `Market closed (${marketStatus.status})`,
          metadata: {
            skipped: true,
            reason: 'market_closed',
            marketStatus: marketStatus.status
          }
        };
      }
    }

    // Every stock still listed. A delisted one has no price left to poll.
    const stocks = await Stock.find({ delisted: { $ne: true } }).select('symbol lastUpdated');

    if (stocks.length === 0) {
      logger.warn('No stocks found in database');
      return {
        success: true,
        message: 'No stocks to fetch',
        metadata: { symbolCount: 0 }
      };
    }

    // Apply maxSymbols limit if configured
    let symbolsToFetch = stocks;
    if (config.maxSymbols > 0) {
      symbolsToFetch = stocks.slice(0, config.maxSymbols);
      logger.info(`Limiting to ${config.maxSymbols} symbols for this run`);
    }

    logger.info(`Fetching prices for ${symbolsToFetch.length} symbols...`);

    // Fetch prices in batches
    const batchSize = config.batchSize || 50;
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
      const batch = symbolsToFetch.slice(i, i + batchSize);
      const symbols = batch.map(s => s.symbol);

      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(symbolsToFetch.length / batchSize)}`, {
        symbols: symbols.length,
        range: `${i + 1}-${Math.min(i + batchSize, symbolsToFetch.length)}`
      });

      try {
        // Fetch prices from PSX using bulk method
        const { success: prices, notFound } = await psxScraper.getStockPricesForSymbols(symbols);

        // Update stocks in database
        for (const priceData of prices) {
          try {
            await Stock.findOneAndUpdate(
              { symbol: priceData.symbol },
              {
                currentPrice: priceData.price,
                change: priceData.change,
                changePercent: priceData.changePercent,
                lastUpdated: new Date()
              }
            );

            results.push({
              symbol: priceData.symbol,
              price: priceData.price,
              change: priceData.change
            });

            successCount++;
          } catch (error) {
            logger.error(`Failed to update ${priceData.symbol}`, { error: error.message });
            failCount++;
          }
        }

        // Count not found as failures
        if (notFound && notFound.length > 0) {
          failCount += notFound.length;
          logger.warn(`${notFound.length} symbols not found in market data`);
        }

        // Small delay between batches
        if (i + batchSize < symbolsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

      } catch (error) {
        logger.error(`Batch processing failed`, {
          batch: Math.floor(i / batchSize) + 1,
          error: error.message,
          stack: error.stack
        });
        failCount += batch.length;
      }
    }

    // Check the levels recorded on journal entries against the new prices.
    try {
      const { checked, updated } = await journalLevelHandler.checkLevels();
      logger.info('Journal levels checked', { checked, updated });
    } catch (error) {
      logger.warn('Failed to check journal levels', { error: error.message });
    }

    const duration = Date.now() - startTime;

    logger.info('Price fetch completed', {
      success: successCount,
      failed: failCount,
      total: symbolsToFetch.length,
      durationMs: duration
    });

    return {
      success: true,
      message: `Fetched ${successCount} prices successfully`,
      metadata: {
        symbolsProcessed: symbolsToFetch.length,
        pricesUpdated: successCount,
        failed: failCount,
        samples: results.slice(0, 5), // First 5 results as sample
        duration: `${(duration / 1000).toFixed(2)}s`
      }
    };

  } catch (error) {
    logger.error('Price polling job failed', {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: error.message,
      metadata: {
        errorCode: error.code || 'PRICE_FETCH_ERROR'
      }
    };
  }
}

