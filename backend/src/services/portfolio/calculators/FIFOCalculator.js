/**
 * FIFO (First-In-First-Out) Calculator
 * Tracks individual purchase lots for tax compliance
 * More complex but required for accurate CGT calculations
 */
import BasePnLCalculator from './BasePnLCalculator.js';
import { holdingMonths, cgtRateFor, taxYearOf, FILER_STATUS } from '../../../config/taxConfig.js';

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

    /**
     * Which lot the next slice of a sell comes out of, as an index into `lots`.
     * First in, first out: always the oldest. Overridden by settlement rules that
     * match differently, such as NCCPL's same-day LIFO.
     */
    pickLot() {
        return 0;
    }

    /**
     * A last chance to reorder same-day activity before matching. Plain FIFO
     * takes the transactions as they happened.
     */
    orderForSettlement(sorted) {
        return sorted;
    }

    /**
     * @param {Array} transactions
     * @param {Number} currentPrice
     * @param {Object} [options]
     * @param {String} [options.filerStatus] FILER | NON_FILER - drives CGT tier rate
     */
    calculate(transactions, currentPrice, options = {}) {
        const filerStatus = options.filerStatus || FILER_STATUS.FILER;
        const lots = []; // Track individual purchase lots
        let realizedPnL = 0;
        let oversoldShares = 0;

        // Per-disposal tax records: each matched lot->sell slice, tagged with
        // its holding period, CGT tier and tax. NCCPL settles CGT per disposal
        // (FIFO), not on an aggregate, so tax must be computed lot by lot.
        const disposals = [];

        const sorted = this.orderForSettlement(this.sortTransactions(transactions));

        for (const tx of sorted) {
            if (tx.type === 'BUY') {
                // Add new lot
                lots.push({
                    quantity: tx.quantity,
                    price: tx.price,
                    fees: this.chargesOf(tx),
                    purchaseDate: tx.executedAt,
                    transactionId: tx._id
                });
            } else if (tx.type === 'SELL') {
                // Sell from oldest lots first
                let remainingToSell = tx.quantity;
                const sellPrice = tx.price;
                const totalSellFees = this.chargesOf(tx);

                while (remainingToSell > 0 && lots.length > 0) {
                    const index = this.pickLot(lots, tx);
                    const lot = lots[index];
                    const sellQty = Math.min(remainingToSell, lot.quantity);

                    // Allocate fees proportionally
                    const feesPortion = (totalSellFees * sellQty) / tx.quantity;

                    // Calculate P/L for this portion. The lot's own fees are
                    // split across the slices that consume it and drawn down as
                    // they go: dividing by the shrinking quantity while leaving
                    // lot.fees whole charged the same fees to every slice, so a
                    // lot sold in two halves cost more than the same lot sold at
                    // once.
                    const lotFeeShare = lot.quantity > 0 ? (lot.fees * sellQty) / lot.quantity : 0;
                    const sellProceeds = (sellQty * sellPrice) - feesPortion;
                    const costBasis = (sellQty * lot.price) + lotFeeShare;
                    const gain = sellProceeds - costBasis;
                    realizedPnL += gain;

                    // Holding-period CGT for this slice. Long-term (>24m) is
                    // exempt; only positive gains are taxed. Losses carry the
                    // rate too so the report can net them by tax year.
                    const months = holdingMonths(lot.purchaseDate, tx.executedAt);
                    const { label, rate } = cgtRateFor(months, filerStatus);
                    const tax = gain > 0 ? (gain * rate) / 100 : 0;

                    disposals.push({
                        quantity: sellQty,
                        purchaseDate: lot.purchaseDate,
                        sellDate: tx.executedAt,
                        holdingMonths: months,
                        tier: label,
                        gain: Math.round(gain * 100) / 100,
                        cgtRate: rate,
                        cgtTax: Math.round(tax * 100) / 100,
                        taxYear: taxYearOf(tx.executedAt)
                    });

                    // Update lot
                    lot.fees -= lotFeeShare;
                    lot.quantity -= sellQty;
                    remainingToSell -= sellQty;

                    // Remove lot if fully sold
                    if (lot.quantity <= 0) {
                        lots.splice(index, 1);
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
        const cgtTax = disposals.reduce((s, d) => s + d.cgtTax, 0);

        return {
            netShares: totalShares,
            avgCost: Math.round(avgCost * 100) / 100,
            costBasis: Math.round(totalCost * 100) / 100,
            realizedPnL: Math.round(realizedPnL * 100) / 100,
            unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
            marketValue: Math.round(marketValue * 100) / 100,
            oversoldShares,
            // Holding-period CGT (advance tax NCCPL would deduct), per disposal
            // and totalled. Only meaningful for FIFO, which tracks lots.
            cgtTax: Math.round(cgtTax * 100) / 100,
            disposals,
            lots: lots.map(lot => ({
                quantity: lot.quantity,
                price: lot.price,
                fees: lot.fees,
                purchaseDate: lot.purchaseDate
            }))
        };
    }
}

