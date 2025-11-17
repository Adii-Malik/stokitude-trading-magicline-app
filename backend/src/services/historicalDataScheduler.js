import Stock from '../models/Stock.js';
import stockAnalysisScraper from './stockAnalysisScraper.js';
import PsxDaily from '../models/PsxDaily.js';
import PsxWeekly from '../models/PsxWeekly.js';
import PsxMonthly from '../models/PsxMonthly.js';
import dayjs from 'dayjs';

/**
 * Historical Data Service
 * 
 * Updates daily/weekly/monthly historical data for symbols
 * Note: Scheduling is now handled by Job Management System
 */
class HistoricalDataScheduler {
    constructor() {
        // No scheduling state needed - managed by JMS
    }

    /**
     * Update today's historical data for all symbols
     */
    async updateHistoricalData() {
        const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
        console.log(`\n📊 [${currentTime} PKT] Starting daily historical data update...`);

        try {
            // Get all stocks with historical data enabled
            const stocks = await Stock.find({
                historicalDataStatus: 'available'
            }).select('symbol');

            if (stocks.length === 0) {
                console.log('ℹ️  No stocks with historical data enabled');
                return;
            }

            console.log(`📝 Found ${stocks.length} symbols to update`);

            // Get today's date (trading day)
            const today = dayjs();
            const dayOfWeek = today.day();

            // Skip weekends
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                console.log(`⏸️  Today is ${today.format('dddd')} - skipping (weekend)`);
                return;
            }

            const todayStr = today.format('YYYY-MM-DD');
            let successCount = 0;
            let failCount = 0;

            // Update each symbol (fetch last 3 months, save only today's data)
            for (const stock of stocks) {
                try {
                    console.log(`  📥 Updating ${stock.symbol} for ${todayStr}...`);

                    // Fetch last 3 months' data to ensure we capture today's data
                    const results = await stockAnalysisScraper.fetchAllTimeframes(stock.symbol, '3M');

                    let savedCount = 0;

                    // Save daily data - ONLY today's data
                    if (results.daily.success.length > 0) {
                        const todayData = results.daily.success.filter(data => {
                            const dataDate = dayjs(data.date).format('YYYY-MM-DD');
                            return dataDate === todayStr;
                        });

                        if (todayData.length > 0) {
                            const dailyOps = todayData.map(data => ({
                                updateOne: {
                                    filter: { symbol: data.symbol, date: data.date },
                                    update: { $set: { stockId: stock._id, ...data } },
                                    upsert: true
                                }
                            }));
                            await PsxDaily.bulkWrite(dailyOps);
                            savedCount += todayData.length;
                            console.log(`     ✓ Daily: ${todayData.length} record(s) for ${todayStr}`);
                        } else {
                            console.log(`     ⚠️ No daily data found for ${todayStr}`);
                        }
                    }

                    // Save/update weekly data for current week (if available)
                    if (results.weekly.success.length > 0) {
                        const thisWeekStart = today.startOf('week').toDate();
                        const thisWeekData = results.weekly.success.filter(data => {
                            const weekStart = new Date(data.weekStart);
                            return weekStart.getTime() === thisWeekStart.getTime();
                        });

                        if (thisWeekData.length > 0) {
                            const weeklyOps = thisWeekData.map(data => ({
                                updateOne: {
                                    filter: { symbol: data.symbol, weekStart: data.weekStart },
                                    update: { $set: { stockId: stock._id, ...data } },
                                    upsert: true
                                }
                            }));
                            await PsxWeekly.bulkWrite(weeklyOps);
                            savedCount += thisWeekData.length;
                            console.log(`     ✓ Weekly: ${thisWeekData.length} record(s) updated`);
                        }
                    }

                    // Save/update monthly data for current month (if available)
                    if (results.monthly.success.length > 0) {
                        const thisMonthStart = today.startOf('month').toDate();
                        const thisMonthData = results.monthly.success.filter(data => {
                            const monthStart = new Date(data.monthStart);
                            return monthStart.getTime() === thisMonthStart.getTime();
                        });

                        if (thisMonthData.length > 0) {
                            const monthlyOps = thisMonthData.map(data => ({
                                updateOne: {
                                    filter: { symbol: data.symbol, monthStart: data.monthStart },
                                    update: { $set: { stockId: stock._id, ...data } },
                                    upsert: true
                                }
                            }));
                            await PsxMonthly.bulkWrite(monthlyOps);
                            savedCount += thisMonthData.length;
                            console.log(`     ✓ Monthly: ${thisMonthData.length} record(s) updated`);
                        }
                    }

                    if (savedCount > 0) {
                        successCount++;
                        console.log(`  ✅ Updated ${stock.symbol} (${savedCount} records)`);
                    } else {
                        failCount++;
                        console.log(`  ⚠️  No new data for ${stock.symbol}`);
                    }
                } catch (error) {
                    failCount++;
                    console.error(`  ❌ Error updating ${stock.symbol}:`, error.message);
                }
            }

            console.log(`\n✅ Historical data update complete:`);
            console.log(`   • Success: ${successCount}`);
            console.log(`   • Failed: ${failCount}`);
            console.log(`   • Total: ${stocks.length}`);

        } catch (error) {
            console.error('❌ Error in daily historical data update:', error.message);
        }
    }

    /**
     * Manually trigger update (for testing)
     */
    async manualUpdate() {
        console.log('🔧 Manual historical data update triggered');
        await this.updateHistoricalData();
    }
}

export default new HistoricalDataScheduler();

