/**
 * Historical Data Job Handler (Deprecated)
 * 
 * Updates historical data from stockanalysis.com.pk
 * NOTE: Use TradingView jobs instead for better reliability
 */

import Stock from '../../models/Stock.js';
import PsxDaily from '../../models/PsxDaily.js';
import PsxWeekly from '../../models/PsxWeekly.js';
import PsxMonthly from '../../models/PsxMonthly.js';
import stockAnalysisScraper from '../../services/stockAnalysisScraper.js';
import dayjs from 'dayjs';

export default async function historicalDataJob(context) {
  const { logger, config } = context;
  
  const period = config.period || '3M';
  const updateType = config.updateType || 'today_only';
  
  logger.info('Starting historical data update...', { period, updateType });

  try {
    // Get stocks with historical data enabled
    const stocks = await Stock.find({
      historicalDataStatus: 'available'
    }).select('symbol');

    if (stocks.length === 0) {
      logger.warn('No stocks with historical data enabled');
      return {
        success: true,
        message: 'No stocks configured for historical data',
        metadata: { symbolCount: 0 }
      };
    }

    logger.info(`Processing ${stocks.length} symbols...`);

    // Get today's date
    const today = dayjs();
    const dayOfWeek = today.day();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      logger.info(`Today is ${today.format('dddd')} - skipping (weekend)`);
      return {
        success: true,
        message: 'Skipped - weekend',
        metadata: {
          skipped: true,
          reason: 'weekend'
        }
      };
    }

    const todayStr = today.format('YYYY-MM-DD');
    let successCount = 0;
    let failCount = 0;
    let totalRecords = 0;

    // Update each symbol
    for (const stock of stocks) {
      logger.info(`Processing ${stock.symbol}...`);

      try {
        // Fetch historical data
        const results = await stockAnalysisScraper.fetchAllTimeframes(stock.symbol, period);

        let saved = 0;

        // Save daily data
        if (results.daily.success.length > 0) {
          const dataToSave = updateType === 'today_only'
            ? results.daily.success.filter(data => dayjs(data.date).format('YYYY-MM-DD') === todayStr)
            : results.daily.success;

          if (dataToSave.length > 0) {
            const ops = dataToSave.map(data => ({
              updateOne: {
                filter: { symbol: data.symbol, date: data.date },
                update: { $set: { stockId: stock._id, ...data } },
                upsert: true
              }
            }));
            await PsxDaily.bulkWrite(ops);
            saved += dataToSave.length;
          }
        }

        // Save weekly data (if full period mode)
        if (updateType === 'full_period' && results.weekly.success.length > 0) {
          const ops = results.weekly.success.map(data => ({
            updateOne: {
              filter: { symbol: data.symbol, weekStart: data.weekStart },
              update: { $set: { stockId: stock._id, ...data } },
              upsert: true
            }
          }));
          await PsxWeekly.bulkWrite(ops);
          saved += results.weekly.success.length;
        }

        // Save monthly data (if full period mode)
        if (updateType === 'full_period' && results.monthly.success.length > 0) {
          const ops = results.monthly.success.map(data => ({
            updateOne: {
              filter: { symbol: data.symbol, monthStart: data.monthStart },
              update: { $set: { stockId: stock._id, ...data } },
              upsert: true
            }
          }));
          await PsxMonthly.bulkWrite(ops);
          saved += results.monthly.success.length;
        }

        if (saved > 0) {
          successCount++;
          totalRecords += saved;
          logger.info(`Completed ${stock.symbol}`, { recordsSaved: saved });
        } else {
          failCount++;
          logger.warn(`No data saved for ${stock.symbol}`);
        }

      } catch (error) {
        failCount++;
        logger.error(`Failed to process ${stock.symbol}`, { error: error.message });
      }
    }

    logger.info('Historical data update completed', {
      success: successCount,
      failed: failCount,
      total: stocks.length,
      recordsSaved: totalRecords
    });

    return {
      success: true,
      message: `Updated ${successCount} symbols successfully`,
      metadata: {
        symbolsProcessed: stocks.length,
        symbolsUpdated: successCount,
        symbolsFailed: failCount,
        recordsSaved: totalRecords,
        updateType,
        period
      }
    };

  } catch (error) {
    logger.error('Historical data job failed', {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: error.message,
      metadata: {
        errorCode: error.code || 'HISTORICAL_DATA_ERROR'
      }
    };
  }
}

