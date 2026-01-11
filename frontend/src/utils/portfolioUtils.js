/**
 * Portfolio Utilities
 * Shared helper functions for portfolio calculations and formatting
 */

/**
 * Format currency with proper separators
 * @param {number} value - Amount to format
 * @param {string} currency - Currency code (PKR, USD, etc.)
 * @param {boolean} compact - Use compact notation for large numbers
 */
export function formatCurrency(value, currency = 'PKR', compact = false) {
    if (value === null || value === undefined || isNaN(value)) return `${currency} 0`;

    if (compact && Math.abs(value) >= 1000000) {
        const millions = value / 1000000;
        return `${currency} ${millions.toFixed(2)}M`;
    }

    return `${currency} ${value.toLocaleString('en-PK', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    })}`;
}

/**
 * Format percentage
 * @param {number} value - Value to format as percentage
 * @param {number} decimals - Number of decimal places
 */
export function formatPercent(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return `${value.toFixed(decimals)}%`;
}

/**
 * Format shares/quantity
 * @param {number} shares - Number of shares
 */
export function formatShares(shares) {
    if (!shares || isNaN(shares)) return '0';
    return shares.toLocaleString('en-PK');
}

/**
 * Get color class for P/L values
 * @param {number} value - P/L value
 */
export function getPnLColorClass(value) {
    if (value === null || value === undefined || value === 0) {
        return 'text-gray-600 dark:text-gray-400';
    }
    return value > 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';
}

/**
 * Calculate total return percentage
 * @param {number} currentValue - Current market value
 * @param {number} costBasis - Total invested
 * @param {number} realizedPnL - Realized profit/loss
 * @param {number} dividends - Total dividends received
 */
export function calculateTotalReturn(currentValue, costBasis, realizedPnL = 0, dividends = 0) {
    if (!costBasis || costBasis === 0) return 0;

    const totalGain = (currentValue - costBasis) + realizedPnL + dividends;
    return (totalGain / costBasis) * 100;
}

/**
 * Calculate position weight in portfolio
 * @param {number} positionValue - Value of single position
 * @param {number} totalValue - Total portfolio value
 */
export function calculateWeight(positionValue, totalValue) {
    if (!totalValue || totalValue === 0) return 0;
    return (positionValue / totalValue) * 100;
}

/**
 * Calculate gap between current and target weight
 * @param {number} currentWeight - Current position weight %
 * @param {number} targetWeight - Target weight %
 * @param {number} totalValue - Total portfolio value
 */
export function calculateGap(currentWeight, targetWeight, totalValue) {
    const weightDiff = targetWeight - currentWeight;
    return (weightDiff / 100) * totalValue;
}

/**
 * Sort data by field
 * @param {Array} data - Array to sort
 * @param {string} field - Field name to sort by
 * @param {string} direction - 'asc' or 'desc'
 */
export function sortData(data, field, direction = 'desc') {
    return [...data].sort((a, b) => {
        const aVal = getNestedValue(a, field);
        const bVal = getNestedValue(b, field);

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
}

/**
 * Get nested object value by path (e.g., 'metrics.totalValue')
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot-notation path
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

/**
 * Filter data by search term
 * @param {Array} data - Array to filter
 * @param {string} searchTerm - Search query
 * @param {Array} searchFields - Fields to search in
 */
export function filterData(data, searchTerm, searchFields = ['symbol', 'companyName']) {
    if (!searchTerm) return data;

    const term = searchTerm.toLowerCase();
    return data.filter(item =>
        searchFields.some(field => {
            const value = getNestedValue(item, field);
            return value?.toString().toLowerCase().includes(term);
        })
    );
}

/**
 * Validate transaction data
 * @param {Object} transaction - Transaction to validate
 */
export function validateTransaction(transaction) {
    const errors = [];

    if (!transaction.type) {
        errors.push('Transaction type is required');
    }

    if (['BUY', 'SELL', 'DIV'].includes(transaction.type) && !transaction.symbol) {
        errors.push('Symbol is required');
    }

    if (['BUY', 'SELL'].includes(transaction.type)) {
        if (!transaction.quantity || transaction.quantity <= 0) {
            errors.push('Quantity must be greater than 0');
        }
        if (!transaction.price || transaction.price <= 0) {
            errors.push('Price must be greater than 0');
        }
    }

    if (['DIV', 'DEPOSIT', 'WITHDRAW'].includes(transaction.type)) {
        if (!transaction.amount || transaction.amount <= 0) {
            errors.push('Amount must be greater than 0');
        }
    }

    if (!transaction.executedAt) {
        errors.push('Date is required');
    }

    return errors;
}

/**
 * Parse CSV row to transaction
 * @param {Object} row - CSV row object
 */
export function parseCSVTransaction(row) {
    return {
        type: row.Type?.toUpperCase(),
        symbol: row.Symbol?.toUpperCase().trim(),
        quantity: row.Quantity ? parseFloat(row.Quantity) : undefined,
        price: row.Price ? parseFloat(row.Price) : undefined,
        fees: row.Fees ? parseFloat(row.Fees) : 0,
        amount: row.Amount ? parseFloat(row.Amount) : undefined,
        executedAt: row.Date,
        notes: row.Notes || ''
    };
}

/**
 * Get investment goal icon
 * @param {string} strategyType - Strategy type code
 */
export function getStrategyIcon(strategyType) {
    const icons = {
        'DIVIDEND_GROWTH': '💰',
        'BALANCED': '⚖️',
        'GROWTH': '🚀',
        'INCOME': '💰',
        'VALUE': '💎',
        'CUSTOM': '⚙️'
    };
    return icons[strategyType] || '📊';
}

/**
 * Get strategy display name
 * @param {string} strategyType - Strategy type code
 */
export function getStrategyName(strategyType) {
    const names = {
        'DIVIDEND_GROWTH': 'Steady Income',
        'BALANCED': 'Balanced Growth',
        'GROWTH': 'Aggressive Growth',
        'INCOME': 'Income Focus',
        'VALUE': 'Value Investing',
        'CUSTOM': 'Custom Strategy'
    };
    return names[strategyType] || strategyType;
}

/**
 * Get score color class
 * @param {number} score - Score value (0-100)
 */
export function getScoreColorClass(score) {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-cyan-600 dark:text-cyan-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
}

/**
 * Get score badge class
 * @param {number} score - Score value (0-100)
 */
export function getScoreBadgeClass(score) {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    if (score >= 60) return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400';
    if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export default {
    formatCurrency,
    formatPercent,
    formatShares,
    getPnLColorClass,
    calculateTotalReturn,
    calculateWeight,
    calculateGap,
    sortData,
    filterData,
    validateTransaction,
    parseCSVTransaction,
    getStrategyIcon,
    getStrategyName,
    getScoreColorClass,
    getScoreBadgeClass,
    debounce
};
