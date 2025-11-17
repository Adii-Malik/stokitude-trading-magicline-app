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
 * TradingView Update Service
 * 
 * Core business logic for triggering TradingView Core Engine to update OHLCV data.
 * Endpoint: http://localhost:5002/api/tradingview/update
 * 
 * NOTE: Scheduling is now managed by Job Management System.
 * This service only contains the update logic (updateTimeframes method).
 */

class TradingViewScheduler {
    constructor() {
        // Use centralized endpoint configuration
        this.baseUrl = config.pythonCore.baseUrl;
        this.updateEndpoint = config.pythonCore.endpoints.tradingviewUpdate;
        this.coreEngineUrl = `${this.baseUrl}${this.updateEndpoint}`;
        this.timeout = config.dataSources.tradingview.timeout;
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
     * Get service status
     */
    getStatus() {
        return {
            coreEngineUrl: this.coreEngineUrl
        };
    }
}

export default new TradingViewScheduler();

