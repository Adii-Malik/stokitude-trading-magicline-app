import cron from 'node-cron';
import axios from 'axios';
import config from '../config/config.js';

let serviceMonitor = null;
const getServiceMonitor = async () => {
    if (!serviceMonitor) {
        serviceMonitor = (await import('./serviceMonitor.js')).default;
    }
    return serviceMonitor;
};

/**
 * TradingView Update Scheduler
 * 
 * Triggers TradingView Core Engine to update OHLCV data
 * Endpoint: http://localhost:5002/api/tradingview/update
 * 
 * Schedules:
 * - Daily: Mon-Fri at 5:00 PM PKT (after market close at 3:30 PM)
 * - Weekly/Monthly: Saturday at 5:00 PM PKT (after week ends)
 */

class TradingViewScheduler {
    constructor() {
        // Use centralized endpoint configuration
        this.baseUrl = config.pythonCore.baseUrl;
        this.updateEndpoint = config.pythonCore.endpoints.tradingviewUpdate;
        this.coreEngineUrl = `${this.baseUrl}${this.updateEndpoint}`;
        this.timeout = config.dataSources.tradingview.timeout;
        this.dailyJob = null;
        this.weeklyJob = null;
        this.isRunning = false;
    }

    /**
     * Start all scheduled jobs
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️  TradingView scheduler already running');
            return;
        }

        this.isRunning = true;
        console.log('📅 TradingView scheduler started');

        // No need to log "started" - only log actual job executions

        // Daily update: Mon-Fri at 5:00 PM PKT (17:00)
        this.dailyJob = cron.schedule('0 17 * * 1-5', async () => {
            console.log('\n🔄 [CRON] Daily TradingView update triggered...');
            await this.updateTimeframes(['daily']);
        }, {
            timezone: 'Asia/Karachi',
            scheduled: true
        });

        // Weekly/Monthly update: Saturday at 5:00 PM PKT (17:00)
        this.weeklyJob = cron.schedule('0 17 * * 6', async () => {
            console.log('\n🔄 [CRON] Weekly/Monthly TradingView update triggered...');
            await this.updateTimeframes(['weekly', 'monthly']);
        }, {
            timezone: 'Asia/Karachi',
            scheduled: true
        });

        console.log('   ✅ Daily job: Mon-Fri at 5:00 PM PKT (daily timeframe)');
        console.log('   ✅ Weekly/Monthly job: Saturday at 5:00 PM PKT');
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        if (this.dailyJob) {
            this.dailyJob.stop();
            this.dailyJob = null;
        }
        if (this.weeklyJob) {
            this.weeklyJob.stop();
            this.weeklyJob = null;
        }
        this.isRunning = false;
        console.log('🛑 TradingView scheduler stopped');
    }

    /**
     * Trigger TradingView Core Engine update
     * @param {Array<string>} timeframes - ['daily'] or ['weekly', 'monthly']
     */
    async updateTimeframes(timeframes) {
        const startTimeMs = Date.now();
        const startTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
        console.log(`\n📊 [${startTime} PKT] Triggering TradingView update for: ${timeframes.join(', ')}`);

        const monitor = await getServiceMonitor();
        const serviceType = timeframes.includes('daily') ? 'tradingViewDaily' : 'tradingViewWeekly';

        try {
            const response = await axios.post(
                this.coreEngineUrl,
                { timeframes },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            if (response.data && response.data.success) {
                const data = response.data.data || {};
                const duration = Date.now() - startTimeMs;

                console.log(`✅ TradingView update completed successfully`);
                console.log(`   • Symbols processed: ${data.symbolsProcessed || 'N/A'}`);
                console.log(`   • Records updated: ${data.recordsUpdated || 'N/A'}`);
                console.log(`   • Duration: ${data.duration || 'N/A'}`);

                // Log success
                await monitor.log(
                    serviceType,
                    'success',
                    `Updated ${timeframes.join(', ')} timeframes`,
                    {
                        timeframes,
                        symbolsProcessed: data.symbolsProcessed,
                        recordsUpdated: data.recordsUpdated
                    },
                    duration
                );

                return true;
            } else {
                throw new Error(response.data?.message || 'Invalid response from TradingView Core Engine');
            }
        } catch (error) {
            const duration = Date.now() - startTimeMs;
            let errorMessage = error.message;

            if (error.code === 'ECONNREFUSED') {
                errorMessage = 'TradingView Core Engine is not running (port 5002)';
                console.error(`❌ ${errorMessage}`);
            } else if (error.code === 'ETIMEDOUT') {
                errorMessage = 'TradingView update timed out (may still be processing)';
                console.error(`❌ ${errorMessage}`);
            } else {
                console.error(`❌ TradingView update failed: ${error.message}`);
            }

            // Log error
            await monitor.log(
                serviceType,
                'error',
                errorMessage,
                {
                    timeframes,
                    errorCode: error.code,
                    stack: error.stack
                },
                duration
            );

            return false;
        }
    }

    /**
     * Manual trigger for testing
     * @param {Array<string>} timeframes - ['daily'] or ['weekly', 'monthly']
     */
    async manualTrigger(timeframes = ['daily']) {
        console.log('🔧 Manual TradingView update triggered');
        return await this.updateTimeframes(timeframes);
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            dailyJob: this.dailyJob ? 'active' : 'inactive',
            weeklyJob: this.weeklyJob ? 'active' : 'inactive',
            coreEngineUrl: this.coreEngineUrl
        };
    }
}

export default new TradingViewScheduler();

