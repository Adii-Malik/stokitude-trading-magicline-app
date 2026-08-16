/**
 * Brokerage from a slab table.
 *
 * PSX brokers price cheap shares at a flat rate per share and expensive ones
 * as a percentage of value, so the band is chosen by share price and then
 * applied to either the share count or the trade value.
 */

/** A common PSX arrangement, offered as the starting point for a new portfolio. */
export const DEFAULT_PSX_SLABS = [
    { from: 0.01, to: 20, type: 'PER_SHARE', value: 0.03 },
    { from: 20.01, to: null, type: 'PERCENT', value: 0.15 }
];

/** The band covering this share price, or null when none matches. */
export function slabFor(price, slabs = []) {
    const p = Number(price);
    if (!Number.isFinite(p)) return null;
    return slabs.find(s => p >= Number(s.from) && (s.to == null || s.to === '' || p <= Number(s.to))) || null;
}

/**
 * Sales tax is a percentage of the brokerage; the CDC charge is per share,
 * which is why it looks erratic on a contract note - it tracks share count,
 * not trade value. A Sahulat sub-account is billed no CDC at all, so this is
 * set to 0 for such a portfolio, or cleared on the trade itself.
 */
export const DEFAULT_SALES_TAX_PCT = 15;
export const DEFAULT_CDC_PER_SHARE = 0.005;

/**
 * Brokerage alone, before tax and CDC.
 * @returns {number} 0 when no band applies
 */
export function brokerageFor({ price, quantity, slabs = [] }) {
    const p = Number(price);
    const q = Number(quantity);
    if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0) return 0;

    const slab = slabFor(p, slabs);
    if (!slab) return 0;

    return slab.type === 'PERCENT'
        ? (q * p * Number(slab.value)) / 100
        : q * Number(slab.value);
}

/**
 * Everything the contract note charges: brokerage, sales tax on that
 * brokerage, and the CDC's flat fee. Tax and CDC are roughly a fifth again on
 * top of the brokerage, so leaving them out understates the real cost.
 *
 * @returns {{brokerage, salesTax, cdc, total}}
 */
export function chargesFor({ price, quantity, slabs = [],
    salesTaxPct = DEFAULT_SALES_TAX_PCT, cdcPerShare = DEFAULT_CDC_PER_SHARE } = {}) {
    const brokerage = brokerageFor({ price, quantity, slabs });
    if (!brokerage) return { brokerage: 0, salesTax: 0, cdc: 0, total: 0 };

    const salesTax = (brokerage * Number(salesTaxPct)) / 100;
    const cdc = Number(quantity) * (Number(cdcPerShare) || 0);
    return { brokerage, salesTax, cdc, total: brokerage + salesTax + cdc };
}

/**
 * @returns {number} total fee for the trade, 0 when no band applies
 */
export function commissionFor(args) {
    return chargesFor(args).total;
}

/** Human description of what a band charges, for the UI. */
export function describeSlab(slab) {
    if (!slab) return 'no band matches this price';
    return slab.type === 'PERCENT'
        ? `${slab.value}% of value`
        : `${slab.value} per share`;
}
