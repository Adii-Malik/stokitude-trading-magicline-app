/**
 * Manual Override Source
 * Highest priority - admin manually entered data takes precedence
 */
import BaseFundamentalsSource from './BaseFundamentalsSource.js';
import StockFundamental from '../../../models/StockFundamental.js';

export default class ManualOverrideSource extends BaseFundamentalsSource {
    getName() {
        return 'MANUAL_OVERRIDE';
    }

    getPriority() {
        return 100; // Highest priority
    }

    isEnabled() {
        return true; // Always check for manual overrides
    }

    async getFundamentals(symbol) {
        try {
            // Check if admin manually entered data for this symbol
            const manual = await StockFundamental.findOne({
                symbol,
                manualOverride: true
            });

            if (manual) {
                console.log(`   ✓ ${symbol}: Using manual override data`);

                return {
                    dividendTTM: manual.dividendTTM,
                    dividendYield: manual.dividendYield,
                    payoutRatio: manual.payoutRatio,
                    dividendGrowth3Y: manual.dividendGrowth3Y,
                    dividendConsistencyYears: manual.dividendConsistencyYears,
                    epsGrowthYoY: manual.epsGrowthYoY,
                    revenueGrowth3Y: manual.revenueGrowth3Y,
                    debtToEquity: manual.debtToEquity,
                    currentRatio: manual.currentRatio,
                    roe: manual.roe,
                    sector: manual.sector,
                    industry: manual.industry,
                    marketCap: manual.marketCap,
                    shariahCompliant: manual.shariahCompliant,
                    dataSource: 'MANUAL'
                };
            }

            return {};
        } catch (error) {
            console.error(`Error fetching manual override for ${symbol}:`, error);
            return {};
        }
    }
}
