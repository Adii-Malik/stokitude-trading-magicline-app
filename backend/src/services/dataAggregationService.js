import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import PsxDaily from '../models/PsxDaily.js';
import PsxWeekly from '../models/PsxWeekly.js';
import PsxMonthly from '../models/PsxMonthly.js';

dayjs.extend(isoWeek);

class DataAggregationService {
    /**
     * Aggregate daily data to weekly OHLCV
     */
    async aggregateToWeekly(symbol) {
        try {
            // Get all daily data for symbol, sorted by date
            const dailyData = await PsxDaily.find({ symbol }).sort({ date: 1 }).lean();

            if (dailyData.length === 0) {
                return { aggregated: 0, updated: 0 };
            }

            // Group by ISO week
            const weekGroups = {};

            for (const day of dailyData) {
                const date = dayjs(day.date);
                const weekStart = date.startOf('isoWeek').toDate();
                const weekKey = weekStart.toISOString();

                if (!weekGroups[weekKey]) {
                    weekGroups[weekKey] = {
                        weekStart,
                        symbol,
                        open: null,
                        high: null,
                        low: null,
                        close: null,
                        volume: 0,
                        days: []
                    };
                }

                weekGroups[weekKey].days.push(day);
            }

            // Calculate OHLC for each week
            let aggregated = 0;
            let updated = 0;

            for (const weekData of Object.values(weekGroups)) {
                if (weekData.days.length === 0) continue;

                // Open = first day's open
                weekData.open = weekData.days[0].open;

                // High = max high of week
                weekData.high = Math.max(...weekData.days.map(d => d.high));

                // Low = min low of week
                weekData.low = Math.min(...weekData.days.map(d => d.low));

                // Close = last day's close
                weekData.close = weekData.days[weekData.days.length - 1].close;

                // Volume = sum of all days
                weekData.volume = weekData.days.reduce((sum, d) => sum + d.volume, 0);

                // Upsert into database
                const result = await PsxWeekly.findOneAndUpdate(
                    { symbol, weekStart: weekData.weekStart },
                    {
                        stockId: weekData.days[0].stockId,
                        symbol: weekData.symbol,
                        weekStart: weekData.weekStart,
                        open: weekData.open,
                        high: weekData.high,
                        low: weekData.low,
                        close: weekData.close,
                        volume: weekData.volume
                    },
                    { upsert: true, new: true }
                );

                if (result.isNew || !result) {
                    aggregated++;
                } else {
                    updated++;
                }
            }

            return { aggregated, updated };
        } catch (error) {
            console.error(`❌ Error aggregating weekly data for ${symbol}:`, error.message);
            return { aggregated: 0, updated: 0, error: error.message };
        }
    }

    /**
     * Aggregate daily data to monthly OHLCV
     */
    async aggregateToMonthly(symbol) {
        try {
            // Get all daily data for symbol, sorted by date
            const dailyData = await PsxDaily.find({ symbol }).sort({ date: 1 }).lean();

            if (dailyData.length === 0) {
                return { aggregated: 0, updated: 0 };
            }

            // Group by month
            const monthGroups = {};

            for (const day of dailyData) {
                const date = dayjs(day.date);
                const monthStart = date.startOf('month').toDate();
                const monthKey = monthStart.toISOString();

                if (!monthGroups[monthKey]) {
                    monthGroups[monthKey] = {
                        monthStart,
                        symbol,
                        open: null,
                        high: null,
                        low: null,
                        close: null,
                        volume: 0,
                        days: []
                    };
                }

                monthGroups[monthKey].days.push(day);
            }

            // Calculate OHLC for each month
            let aggregated = 0;
            let updated = 0;

            for (const monthData of Object.values(monthGroups)) {
                if (monthData.days.length === 0) continue;

                // Open = first day's open
                monthData.open = monthData.days[0].open;

                // High = max high of month
                monthData.high = Math.max(...monthData.days.map(d => d.high));

                // Low = min low of month
                monthData.low = Math.min(...monthData.days.map(d => d.low));

                // Close = last day's close
                monthData.close = monthData.days[monthData.days.length - 1].close;

                // Volume = sum of all days
                monthData.volume = monthData.days.reduce((sum, d) => sum + d.volume, 0);

                // Upsert into database
                const result = await PsxMonthly.findOneAndUpdate(
                    { symbol, monthStart: monthData.monthStart },
                    {
                        stockId: monthData.days[0].stockId,
                        symbol: monthData.symbol,
                        monthStart: monthData.monthStart,
                        open: monthData.open,
                        high: monthData.high,
                        low: monthData.low,
                        close: monthData.close,
                        volume: monthData.volume
                    },
                    { upsert: true, new: true }
                );

                if (result.isNew || !result) {
                    aggregated++;
                } else {
                    updated++;
                }
            }

            return { aggregated, updated };
        } catch (error) {
            console.error(`❌ Error aggregating monthly data for ${symbol}:`, error.message);
            return { aggregated: 0, updated: 0, error: error.message };
        }
    }

    /**
     * Aggregate all timeframes for a symbol
     */
    async aggregateAll(symbol) {
        try {
            const weeklyResult = await this.aggregateToWeekly(symbol);
            const monthlyResult = await this.aggregateToMonthly(symbol);

            return {
                weekly: weeklyResult,
                monthly: monthlyResult
            };
        } catch (error) {
            console.error(`❌ Error aggregating all timeframes for ${symbol}:`, error.message);
            return {
                weekly: { error: error.message },
                monthly: { error: error.message }
            };
        }
    }
}

export default new DataAggregationService();
