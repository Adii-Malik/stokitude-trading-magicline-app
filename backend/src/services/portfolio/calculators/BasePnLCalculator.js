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
}
