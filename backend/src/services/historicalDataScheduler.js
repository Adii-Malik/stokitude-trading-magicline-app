import Stock from '../models/Stock.js';
import historicalDataScraper from './historicalDataScraper.js';
import dataAggregationService from '../services/dataAggregationService.js';
import PsxDaily from '../models/PsxDaily.js';
import dayjs from 'dayjs';

class HistoricalDataScheduler {
    constructor() {
        this.isRunning = false;
        this.timer = null;
    }

    /**
     * Start the scheduler - runs daily after market close
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Historical data scheduler already running');
            return;
        }

        this.isRunning = true;
        console.log('📅 Historical data scheduler started');

        // Schedule to run at 5:30 PM PKT (after market close at 5:00 PM)
        this.scheduleDaily();
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('🛑 Historical data scheduler stopped');
    }

    /**
     * Schedule the daily update
     */
    scheduleDaily() {
        const now = new Date();
        const scheduledTime = new Date();

        // Set to 5:30 PM PKT (17:30)
        scheduledTime.setHours(17, 30, 0, 0);

        // If it's already past 5:30 PM today, schedule for tomorrow
        if (now > scheduledTime) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        const msUntilScheduled = scheduledTime - now;

        console.log(`⏰ Next historical data update scheduled for: ${scheduledTime.toLocaleString('en-US', { timeZone: 'Asia/Karachi' })} PKT`);

        this.timer = setTimeout(async () => {
            await this.updateHistoricalData();
            // Reschedule for next day
            this.scheduleDaily();
        }, msUntilScheduled);
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

            // Update each symbol
            for (const stock of stocks) {
                try {
                    console.log(`  📥 Fetching ${stock.symbol} for ${todayStr}...`);

                    const data = await historicalDataScraper.scrapeDate(stock.symbol, todayStr);

                    if (data) {
                        // Save to database
                        await PsxDaily.findOneAndUpdate(
                            { symbol: data.symbol, date: data.date },
                            {
                                stockId: stock._id,
                                ...data
                            },
                            { upsert: true, new: true }
                        );

                        // Update aggregations
                        await dataAggregationService.aggregateAll(stock.symbol);

                        successCount++;
                        console.log(`  ✅ Updated ${stock.symbol}`);
                    } else {
                        failCount++;
                        console.log(`  ⚠️  No data for ${stock.symbol}`);
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

