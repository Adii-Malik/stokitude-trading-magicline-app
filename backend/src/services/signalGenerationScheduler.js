import cron from 'node-cron';
import axios from 'axios';
import TradingStrategy from '../models/TradingStrategy.js';
import Stock from '../models/Stock.js';
import config from '../config/config.js';

let serviceMonitor = null;

const getServiceMonitor = async () => {
    if (!serviceMonitor) {
        serviceMonitor = (await import('./serviceMonitor.js')).default;
    }
    return serviceMonitor;
};

/**
 * Signal Generation Scheduler
 * 
 * Automatically generates trading signals for active strategies after market hours
 * When: Mon-Sat at 5:30 PM PKT (after daily/weekly/monthly candles and data updated)
 * 
 * Key Points:
 * - Daily candles form at market close (3:30 PM PKT) Mon-Fri
 * - Weekly/Monthly candles form on Saturday
 * - TradingView updates data at 5:00 PM PKT
 * - Signal generation runs at 5:30 PM PKT (after data is fresh)
 * - Only generates signals for active strategies (isActive: true)
 * - Checks if signal already exists for today before generating
 * - Broadcasts new signals via Socket.IO for real-time updates
 */

class SignalGenerationScheduler {
    constructor() {
        this.job = null;
        this.isRunning = false;
        this.isGenerating = false;
        this.apiBaseUrl = `http://localhost:${config.port}/api`;
    }

    /**
     * Start scheduled job
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️  Signal Generation Scheduler already running');
            return;
        }

        this.isRunning = true;
        console.log('📅 Signal Generation Scheduler started');

        // No need to log "started" - only log actual job executions

        // Schedule: Mon-Sat at 5:30 PM PKT (after market close and data update)
        // Daily candles: Mon-Fri at 3:30 PM → TradingView updates at 5:00 PM → signals at 5:30 PM
        // Weekly/Monthly candles: Sat → TradingView updates at 5:00 PM → signals at 5:30 PM
        this.job = cron.schedule('30 17 * * 1-6', async () => {
            console.log('\n📊 [CRON] Automated signal generation triggered...');
            await this.generateSignals();
        }, {
            timezone: 'Asia/Karachi',
            scheduled: true
        });

        console.log('   ✅ Signal generation job: Mon-Sat at 5:30 PM PKT (daily/weekly/monthly signals)');
    }

    /**
     * Stop scheduled job
     */
    stop() {
        if (this.job) {
            this.job.stop();
            this.job = null;
        }
        this.isRunning = false;
        console.log('🛑 Signal Generation Scheduler stopped');
    }

    /**
     * Main signal generation logic - just triggers core system
     * Core system handles: fetching symbols, generating signals, saving to DB
     */
    async generateSignals() {
        if (this.isGenerating) {
            console.log('⚠️  Signal generation already in progress, skipping...');
            return;
        }

        this.isGenerating = true;
        const startTimeMs = Date.now();
        const startTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
        const monitor = await getServiceMonitor();

        console.log(`\n🤖 [${startTime} PKT] Starting automated signal generation...`);

        try {
            // Get all active strategies with userId
            const activeStrategies = await TradingStrategy.find({ isActive: true })
                .select('name pythonStrategy pythonConfig userId')
                .lean();

            if (activeStrategies.length === 0) {
                console.log('⚠️  No active strategies found.');
                await monitor.log('signalGenerationScheduler', 'info', 'No active strategies', { count: 0 });
                this.isGenerating = false;
                return;
            }

            console.log(`   📋 Found ${activeStrategies.length} active strategy(ies)`);

            let totalSignalsGenerated = 0;
            const errors = [];

            // For each active strategy, trigger core system
            for (const strategy of activeStrategies) {
                console.log(`\n   🎯 Triggering core for: ${strategy.name} (${strategy.pythonStrategy})`);

                try {
                    // Call Python Core: POST /api/signals/generate
                    // No symbol = batch mode (core fetches all symbols)
                    // Core will: fetch symbols, generate signals, save to DB
                    const response = await axios.post(
                        `${config.pythonCore.baseUrl}${config.pythonCore.endpoints.signals}`,
                        {
                            strategy: strategy.pythonStrategy,
                            config: strategy.pythonConfig,  // timeframe inside config
                            save_to_db: true,
                            user_id: strategy.userId.toString(),
                            strategy_id: strategy._id.toString()
                            // No symbol parameter = batch mode for all symbols
                        },
                        {
                            headers: { 'Content-Type': 'application/json' },
                            timeout: 300000 // 5 minutes
                        }
                    );

                    if (response.data.success) {
                        const count = response.data.total_signals || 0;
                        totalSignalsGenerated += count;
                        console.log(`      ✅ Core generated ${count} signal(s)`);
                    }
                } catch (error) {
                    errors.push({ strategy: strategy.name, error: error.message });
                    console.error(`      ❌ Error: ${error.message}`);
                }
            }

            const duration = Date.now() - startTimeMs;
            const endTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });

            console.log(`\n✅ [${endTime} PKT] Signal generation completed`);
            console.log(`   • Strategies: ${activeStrategies.length}`);
            console.log(`   • Signals: ${totalSignalsGenerated}`);
            console.log(`   • Errors: ${errors.length}`);
            console.log(`   • Duration: ${(duration / 1000).toFixed(2)}s`);

            await monitor.log(
                'signalGenerationScheduler',
                errors.length > 0 ? 'warning' : 'success',
                `Generated ${totalSignalsGenerated} signals from ${activeStrategies.length} strategies`,
                { strategies: activeStrategies.length, signals: totalSignalsGenerated, errors: errors.length },
                duration
            );

        } catch (error) {
            const duration = Date.now() - startTimeMs;
            console.error(`❌ Failed: ${error.message}`);
            await monitor.log('signalGenerationScheduler', 'error', error.message, { stack: error.stack }, duration);
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isGenerating: this.isGenerating,
            job: this.job ? 'active' : 'inactive',
            schedule: 'Mon-Sat at 5:30 PM PKT (daily/weekly/monthly signals)'
        };
    }
}

export default new SignalGenerationScheduler();

