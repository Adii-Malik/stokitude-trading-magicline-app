/**
 * Average Cost Calculator
 * Simple average cost method - ideal for SIP and dividend investing
 * Default calculator for MVP
 */
import BasePnLCalculator from './BasePnLCalculator.js';

export default class AverageCostCalculator extends BasePnLCalculator {
    getName() {
        return 'AVERAGE_COST';
    }

    getDescription() {
        return 'Simple average cost method - best for SIP/dividend investing';
    }

    calculate(transactions, currentPrice) {
        let totalShares = 0;
        let totalCost = 0;
        let realizedPnL = 0;

        // Sort by execution date
        const sorted = transactions
            .filter(tx => ['BUY', 'SELL'].includes(tx.type))
            .sort((a, b) => new Date(a.executedAt) - new Date(b.executedAt));

        for (const tx of sorted) {
            if (tx.type === 'BUY') {
                // Add to position
                const buyCost = (tx.quantity * tx.price) + (tx.fees || 0);
                totalShares += tx.quantity;
                totalCost += buyCost;
            } else if (tx.type === 'SELL') {
                // Calculate average cost at time of sale
                const avgCost = totalShares > 0 ? totalCost / totalShares : 0;

                // Calculate realized P/L
                const sellProceeds = (tx.quantity * tx.price) - (tx.fees || 0);
                const sellCost = tx.quantity * avgCost;
                realizedPnL += (sellProceeds - sellCost);

                // Reduce position
                totalShares -= tx.quantity;
                totalCost -= sellCost;

                // Handle edge case: selling more than owned (shouldn't happen with validation)
                if (totalShares < 0) {
                    totalShares = 0;
                    totalCost = 0;
                }
            }
        }

        // Calculate current metrics
        const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
        const marketValue = totalShares * currentPrice;
        const unrealizedPnL = marketValue - totalCost;

        return {
            netShares: totalShares,
            avgCost: Math.round(avgCost * 100) / 100, // Round to 2 decimals
            costBasis: Math.round(totalCost * 100) / 100,
            realizedPnL: Math.round(realizedPnL * 100) / 100,
            unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
            marketValue: Math.round(marketValue * 100) / 100
        };
    }
}
