/**
 * Base Fundamentals Source
 * Abstract class defining the interface for fundamental data sources
 */
export default class BaseFundamentalsSource {
    /**
     * Get fundamental data for a symbol
     * @param {String} symbol - Stock symbol
     * @returns {Object} - Fundamental data (partial or complete)
     */
    async getFundamentals(symbol) {
        throw new Error('Must implement getFundamentals() method');
    }

    /**
     * Get source name
     * @returns {String}
     */
    getName() {
        throw new Error('Must implement getName() method');
    }

    /**
     * Check if source is enabled
     * @returns {Boolean}
     */
    isEnabled() {
        return true;
    }

    /**
     * Get priority (higher = checked first)
     * @returns {Number}
     */
    getPriority() {
        return 0;
    }
}
