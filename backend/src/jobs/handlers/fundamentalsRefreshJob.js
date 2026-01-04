/**
 * Fundamentals Refresh Job Handler
 * Executes automated fundamental data refresh
 */
import FundamentalsAggregator from '../../services/portfolio/fundamentalsSources/FundamentalsAggregator.js';
import Stock from '../../models/Stock.js';
import StockFundamental from '../../models/StockFundamental.js';

export default async function fundamentalsRefreshJob(job, done) {
    const config = job.attrs.data.config || {};
    const {
        batchSize = 10,
        delayBetweenBatches = 5000,
        refreshStaleOnly = true,
        maxAgeHours = 24,
        notifyOnComplete = false
    } = config;

    const startTime = Date.now();

    try {
        console.log('\n📊 ════════════════════════════════════════════════');
        console.log('📊 FUNDAMENTALS REFRESH JOB STARTED');
        console.log('📊 ════════════════════════════════════════════════');
        console.log(`   Batch Size: ${batchSize}`);
        console.log(`   Delay: ${delayBetweenBatches}ms`);
        console.log(`   Refresh Mode: ${refreshStaleOnly ? 'Stale only' : 'All'}`);
        console.log(`   Max Age: ${maxAgeHours} hours`);

        // Get symbols to refresh
        let symbolsToRefresh = [];

        if (refreshStaleOnly) {
            symbolsToRefresh = await FundamentalsAggregator.getStaleSymbols(maxAgeHours);
            console.log(`\n   Found ${symbolsToRefresh.length} stale/missing symbols`);
        } else {
            // Get all active symbols
            const activeSymbols = await Stock.find({
                currentPrice: { $ne: null }
            }).distinct('symbol');
            symbolsToRefresh = activeSymbols;
            console.log(`\n   Refreshing all ${symbolsToRefresh.length} active symbols`);
        }

        if (symbolsToRefresh.length === 0) {
            console.log('\n✓ All fundamentals are up to date - nothing to refresh');

            done(null, {
                success: true,
                message: 'All fundamentals up to date',
                symbolsProcessed: 0,
                duration: Date.now() - startTime
            });
            return;
        }

        // Process in batches
        const results = {
            success: 0,
            errors: 0,
            details: []
        };

        const totalBatches = Math.ceil(symbolsToRefresh.length / batchSize);

        for (let i = 0; i < symbolsToRefresh.length; i += batchSize) {
            const batch = symbolsToRefresh.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;

            console.log(`\n   📦 Batch ${batchNum}/${totalBatches} (${batch.length} symbols)...`);

            const batchResults = await FundamentalsAggregator.refreshAll(batch);

            for (const result of batchResults) {
                if (result.status === 'success') {
                    results.success++;
                    results.details.push({
                        symbol: result.symbol,
                        status: 'success',
                        dataQuality: result.dataQuality,
                        fieldsCount: result.fieldsCount
                    });
                } else {
                    results.errors++;
                    results.details.push({
                        symbol: result.symbol,
                        status: 'error',
                        error: result.error
                    });
                }
            }

            console.log(`      ✓ Batch ${batchNum} complete: ${results.success} success, ${results.errors} errors`);

            // Delay between batches (except for last batch)
            if (i + batchSize < symbolsToRefresh.length) {
                console.log(`      ⏳ Waiting ${delayBetweenBatches}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }

        const duration = Date.now() - startTime;
        const durationSec = Math.round(duration / 1000);

        console.log('\n📊 ════════════════════════════════════════════════');
        console.log('📊 FUNDAMENTALS REFRESH JOB COMPLETED');
        console.log('📊 ════════════════════════════════════════════════');
        console.log(`   ✅ Success: ${results.success}`);
        console.log(`   ❌ Errors: ${results.errors}`);
        console.log(`   ⏱️ Duration: ${durationSec}s`);
        console.log(`   📈 Rate: ${Math.round(symbolsToRefresh.length / durationSec)} symbols/sec`);

        // Send notification if enabled
        if (notifyOnComplete) {
            try {
                const notificationService = (await import('../../services/notificationService.js')).default;
                await notificationService.sendSystemNotification(
                    'Fundamentals Refresh Complete',
                    `Refreshed ${results.success} symbols in ${durationSec}s. ${results.errors} errors.`,
                    'info'
                );
            } catch (error) {
                console.error('   ⚠️ Failed to send notification:', error.message);
            }
        }

        done(null, {
            success: true,
            symbolsProcessed: symbolsToRefresh.length,
            successCount: results.success,
            errorCount: results.errors,
            duration,
            details: results.details.slice(0, 100) // Limit details to prevent huge payloads
        });

    } catch (error) {
        console.error('\n❌ ════════════════════════════════════════════════');
        console.error('❌ FUNDAMENTALS REFRESH JOB FAILED');
        console.error('❌ ════════════════════════════════════════════════');
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);

        done(error);
    }
}
