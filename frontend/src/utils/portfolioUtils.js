/**
 * Portfolio Utilities
 * Shared formatting helpers for the Portfolio components.
 */

const CURRENCY_SYMBOLS = {
    USD: '$',
    PKR: 'Rs.'
};

/**
 * Currency symbol for a currency code. Defaults to the PKR symbol.
 * @param {string} currency - Currency code (PKR, USD)
 */
export function currencySymbol(currency) {
    return CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS.PKR;
}

/**
 * Format an amount as "Rs. 1,234.56" / "$ 1,234.56".
 * @param {number} value - Amount to format
 * @param {string} currency - Currency code (PKR, USD)
 * @param {object} [options]
 * @param {boolean} [options.signed] - Prefix positive values with "+"
 */
export function formatCurrency(value, currency = 'PKR', { signed = false } = {}) {
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    const sign = signed && safe >= 0 ? '+' : '';

    const number = safe.toLocaleString('en-PK', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    return `${sign}${currencySymbol(currency)} ${number}`;
}

/**
 * Format a percentage, e.g. "12.34%".
 * @param {number} value - Value to format
 * @param {number} [decimals] - Decimal places
 * @param {object} [options]
 * @param {boolean} [options.signed] - Prefix positive values with "+"
 */
export function formatPercent(value, decimals = 2, { signed = false } = {}) {
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    const sign = signed && safe >= 0 ? '+' : '';
    return `${sign}${safe.toFixed(decimals)}%`;
}

/**
 * Format a share/quantity count.
 * @param {number} shares - Number of shares
 */
export function formatShares(shares) {
    const amount = Number(shares);
    return Number.isFinite(amount) ? amount.toLocaleString('en-PK') : '0';
}

/**
 * Tailwind text colour for a profit/loss value, including the dark variant.
 * @param {number} value - P/L value
 */
export function getPnLColorClass(value) {
    return Number(value) >= 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';
}
