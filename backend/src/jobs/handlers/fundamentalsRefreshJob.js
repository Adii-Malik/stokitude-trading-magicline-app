/**
 * Fundamentals Refresh Job Handler
 * Executes automated fundamental data refresh
 */
import FundamentalsAggregator from '../../services/portfolio/fundamentalsSources/FundamentalsAggregator.js';
import Stock from '../../models/Stock.js';

export default async function fundamentalsRefreshJob(context) {
    const { config, logger } = context;

    // Extract config parameters
    const {
        batchSize = 50,
        delayBetweenBatches = 5000,
        maxSymbols = 0
    } = config;

    const startTime = Date.now();

    try {
        console.log('\n📊 ════════════════════════════════════════════════');
        console.log('📊 FUNDAMENTALS REFRESH JOB STARTED');
        console.log('📊 ════════════════════════════════════════════════');
        console.log(`   Batch Size: ${batchSize}`);
        console.log(`   Delay: ${delayBetweenBatches}ms`);
        console.log(`   Max Symbols: ${maxSymbols || 'All'}`);

        logger.info('Starting fundamentals refresh', { batchSize, delayBetweenBatches, maxSymbols });
        
        // Get all active symbols
        const activeSymbols = await Stock.find({
            currentPrice: { $ne: null }
        }).distinct('symbol');

        // Limit symbols if maxSymbols is set (useful for testing)
        const symbolsToRefresh = maxSymbols > 0
            ? activeSymbols.slice(0, maxSymbols)
            : activeSymbols;

        console.log(`\n   Processing ${symbolsToRefresh.length} symbols${maxSymbols > 0 ? ` (limited from ${activeSymbols.length})` : ''}`);

        if (symbolsToRefresh.length === 0) {
            console.log('\n⚠️ No active symbols found to refresh');

            return {
                success: true,
                message: 'No active symbols to refresh',
                symbolsProcessed: 0,
                duration: Date.now() - startTime
            };
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

        logger.info('Fundamentals refresh completed', {
            symbolsProcessed: symbolsToRefresh.length,
            successCount: results.success,
            errorCount: results.errors,
            duration
        });

        return {
            success: true,
            message: `Refreshed ${results.success} of ${symbolsToRefresh.length} symbols in ${durationSec}s`,
            metadata: {
                symbolsProcessed: symbolsToRefresh.length,
                successCount: results.success,
                errorCount: results.errors,
                duration,
                rate: Math.round(symbolsToRefresh.length / durationSec),
                details: results.details.slice(0, 100)
            }
        };

    } catch (error) {
        console.error('\n❌ ════════════════════════════════════════════════');
        console.error('❌ FUNDAMENTALS REFRESH JOB FAILED');
        console.error('❌ ════════════════════════════════════════════════');
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);

        logger.error('Fundamentals refresh failed', { error: error.message });

        return {
            success: false,
            message: `Failed: ${error.message}`,
            metadata: {
                error: error.message,
                stack: error.stack
            }
        };
    }
}
