/**
 * Calculator Registry
 * Central registry for all P/L calculation methods
 * Allows plug-and-play addition of new calculators
 */
import AverageCostCalculator from './AverageCostCalculator.js';
import FIFOCalculator from './FIFOCalculator.js';
import NCCPLCalculator from './NCCPLCalculator.js';

class CalculatorRegistry {
    constructor() {
        this.calculators = new Map();
        this._registerDefaults();
    }

    /**
     * Register default calculators
     * @private
     */
    _registerDefaults() {
        this.register(new AverageCostCalculator());
        this.register(new FIFOCalculator());
        this.register(new NCCPLCalculator());
    }

    /**
     * Register a new calculator
     * @param {BasePnLCalculator} calculator
     */
    register(calculator) {
        const name = calculator.getName();
        if (this.calculators.has(name)) {
            console.warn(`Calculator ${name} already registered, overwriting`);
        }
        this.calculators.set(name, calculator);
        console.log(`✓ Registered calculator: ${name}`);
    }

    /**
     * Get calculator by name
     * @param {String} name - Calculator name (e.g., 'AVERAGE_COST', 'FIFO')
     * @returns {BasePnLCalculator}
     */
    get(name) {
        if (!this.calculators.has(name)) {
            throw new Error(`Unknown P/L calculator: ${name}. Available: ${this.getAvailableNames().join(', ')}`);
        }
        return this.calculators.get(name);
    }

    /**
     * Get all registered calculators
     * @returns {Array} - [{ name, description, supportsLotTracking }]
     */
    getAll() {
        return Array.from(this.calculators.values()).map(calc => ({
            name: calc.getName(),
            description: calc.getDescription(),
            supportsLotTracking: calc.supportsLotTracking()
        }));
    }

    /**
     * Get available calculator names
     * @returns {Array<String>}
     */
    getAvailableNames() {
        return Array.from(this.calculators.keys());
    }

    /**
     * Check if calculator exists
     * @param {String} name
     * @returns {Boolean}
     */
    has(name) {
        return this.calculators.has(name);
    }
}

// Export singleton instance
export default new CalculatorRegistry();
