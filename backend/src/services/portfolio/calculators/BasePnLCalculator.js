/**
 * Base P/L Calculator
 * Abstract class defining the interface for all P/L calculation methods
 */
export default class BasePnLCalculator {
    /**
     * Calculate holdings and P/L from transactions
     * @param {Array} transactions - All transactions for a symbol (BUY, SELL)
     * @param {Number} currentPrice - Current market price
     * @returns {Object} - { netShares, avgCost, costBasis, realizedPnL, unrealizedPnL, marketValue }
     */
    calculate(transactions, currentPrice) {
        throw new Error('Must implement calculate() method');
    }

    /**
     * Get calculator name (e.g., 'AVERAGE_COST', 'FIFO')
     * @returns {String}
     */
    getName() {
        throw new Error('Must implement getName() method');
    }

    /**
     * Get human-readable description
     * @returns {String}
     */
    getDescription() {
        throw new Error('Must implement getDescription() method');
    }

    /**
     * Check if calculator supports lot tracking
     * @returns {Boolean}
     */
    supportsLotTracking() {
        return false;
    }

    /**
     * Share multiplier for a SPLIT/BONUS ratio.
     * "2:1" -> 2 (each share becomes two). "10%" -> 1.1 (10 bonus per 100).
     * Returns 1 when unparseable, so a bad ratio is a no-op rather than a wipe.
     */
    parseRatio(ratio) {
        if (!ratio) return 1;
        const raw = String(ratio).trim();

        const pct = raw.match(/^(\d+(?:\.\d+)?)\s*%$/);
        if (pct) return 1 + (parseFloat(pct[1]) / 100);

        const split = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
        if (split) {
            const [, a, b] = split;
            const to = parseFloat(a), from = parseFloat(b);
            return from > 0 ? to / from : 1;
        }

        const plain = parseFloat(raw);
        return Number.isFinite(plain) && plain > 0 ? plain : 1;
    }

    /**
     * Order transactions deterministically. Same-day trades share an executedAt
     * (date-only input), so tie-break on insertion order.
     */
    sortTransactions(transactions) {
        const key = (tx) => {
            const id = tx._id ? String(tx._id) : '';
            return [
                new Date(tx.executedAt).getTime() || 0,
                tx.createdAt ? new Date(tx.createdAt).getTime() : 0,
                id
            ];
        };

        return transactions
            .filter(tx => ['BUY', 'SELL', 'SPLIT', 'BONUS'].includes(tx.type))
            .map(tx => ({ tx, k: key(tx) }))
            .sort((a, b) => {
                if (a.k[0] !== b.k[0]) return a.k[0] - b.k[0];
                if (a.k[1] !== b.k[1]) return a.k[1] - b.k[1];
                return a.k[2] < b.k[2] ? -1 : a.k[2] > b.k[2] ? 1 : 0;
            })
            .map(entry => entry.tx);
    }
}
