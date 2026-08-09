/**
 * FIFO (First-In-First-Out) Calculator
 * Tracks individual purchase lots for tax compliance
 * More complex but required for accurate CGT calculations
 */
import BasePnLCalculator from './BasePnLCalculator.js';

export default class FIFOCalculator extends BasePnLCalculator {
    getName() {
        return 'FIFO';
    }

    getDescription() {
        return 'First-In-First-Out method - required for tax compliance';
    }

    supportsLotTracking() {
        return true;
    }

    calculate(transactions, currentPrice) {
        const lots = []; // Track individual purchase lots
        let realizedPnL = 0;
        let oversoldShares = 0;

        const sorted = this.sortTransactions(transactions);

        for (const tx of sorted) {
            if (tx.type === 'BUY') {
                // Add new lot
                lots.push({
                    quantity: tx.quantity,
                    price: tx.price,
                    fees: tx.fees || 0,
                    purchaseDate: tx.executedAt,
                    transactionId: tx._id
                });
            } else if (tx.type === 'SELL') {
                // Sell from oldest lots first
                let remainingToSell = tx.quantity;
                const sellPrice = tx.price;
                const totalSellFees = tx.fees || 0;

                while (remainingToSell > 0 && lots.length > 0) {
                    const lot = lots[0];
                    const sellQty = Math.min(remainingToSell, lot.quantity);

                    // Allocate fees proportionally
                    const feesPortion = (totalSellFees * sellQty) / tx.quantity;

                    // Calculate P/L for this portion
                    const sellProceeds = (sellQty * sellPrice) - feesPortion;
                    const costBasis = (sellQty * lot.price) + ((lot.fees * sellQty) / lot.quantity);
                    realizedPnL += (sellProceeds - costBasis);

                    // Update lot
                    lot.quantity -= sellQty;
                    remainingToSell -= sellQty;

                    // Remove lot if fully sold
                    if (lot.quantity <= 0) {
                        lots.shift();
                    }
                }

                if (remainingToSell > 0) {
                    oversoldShares += remainingToSell;
                }
            } else {
                // SPLIT/BONUS: scale every lot, keeping each lot's cost intact.
                const ratio = this.parseRatio(tx.ratio);
                for (const lot of lots) {
                    lot.quantity *= ratio;
                    lot.price /= ratio;
                }
            }
        }

        // Calculate metrics from remaining lots
        let totalShares = 0;
        let totalCost = 0;

        for (const lot of lots) {
            totalShares += lot.quantity;
            totalCost += (lot.quantity * lot.price) + lot.fees;
        }

        const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
        const marketValue = totalShares * currentPrice;
        const unrealizedPnL = marketValue - totalCost;

        return {
            netShares: totalShares,
            avgCost: Math.round(avgCost * 100) / 100,
            costBasis: Math.round(totalCost * 100) / 100,
            realizedPnL: Math.round(realizedPnL * 100) / 100,
            unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
            marketValue: Math.round(marketValue * 100) / 100,
            oversoldShares,
            lots: lots.map(lot => ({
                quantity: lot.quantity,
                price: lot.price,
                fees: lot.fees,
                purchaseDate: lot.purchaseDate
            }))
        };
    }
}
