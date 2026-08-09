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
        let oversoldShares = 0;

        const sorted = this.sortTransactions(transactions);

        for (const tx of sorted) {
            if (tx.type === 'BUY') {
                // Add to position
                const buyCost = (tx.quantity * tx.price) + (tx.fees || 0);
                totalShares += tx.quantity;
                totalCost += buyCost;
            } else if (tx.type === 'SELL') {
                // Excess beyond the holding has no cost basis - don't price it.
                const sellable = Math.min(tx.quantity, totalShares);
                oversoldShares += tx.quantity - sellable;

                if (sellable > 0) {
                    const avgCost = totalCost / totalShares;

                    const feesPortion = (tx.fees || 0) * (sellable / tx.quantity);
                    const sellProceeds = (sellable * tx.price) - feesPortion;
                    const sellCost = sellable * avgCost;
                    realizedPnL += (sellProceeds - sellCost);

                    totalShares -= sellable;
                    totalCost -= sellCost;
                }

                if (totalShares <= 0) {
                    totalShares = 0;
                    totalCost = 0;
                }
            } else {
                // SPLIT/BONUS: share count scales, money invested does not.
                totalShares *= this.parseRatio(tx.ratio);
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
            marketValue: Math.round(marketValue * 100) / 100,
            oversoldShares
        };
    }
}
