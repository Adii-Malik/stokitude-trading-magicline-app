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
 * Everything a contract note charges beyond brokerage. Each line names its
 * own basis, because they genuinely differ:
 *
 *   PERCENT_OF_BROKERAGE  sales tax - 15% of the brokerage, not of the trade
 *   PER_SHARE             CDC - tracks share count, which is why it looks
 *                         erratic against trade value
 *   PERCENT_OF_VALUE      NCCPL, SECP, PSX LAGA, CVT
 *   FIXED                 a flat charge per contract note
 *
 * Treating sales tax as a percentage of traded value happens to fit one note
 * and breaks the moment the brokerage rate changes, so the basis matters.
 */
export const CHARGE_BASES = ['PERCENT_OF_BROKERAGE', 'PERCENT_OF_VALUE', 'PER_SHARE', 'FIXED'];

/** Verified against PSX contract notes from two brokers, August 2026. */
export const DEFAULT_PSX_CHARGES = [
    { name: 'Sales Tax', basis: 'PERCENT_OF_BROKERAGE', value: 15, appliesTo: 'BOTH' },
    { name: 'CDC', basis: 'PER_SHARE', value: 0.005, appliesTo: 'BOTH' }
];

/** One charge line, given the brokerage and trade it sits on. */
export function amountOf(charge, { brokerage, value, quantity }) {
    const v = Number(charge?.value) || 0;
    switch (charge?.basis) {
        case 'PERCENT_OF_BROKERAGE': return (brokerage * v) / 100;
        case 'PERCENT_OF_VALUE': return (value * v) / 100;
        case 'PER_SHARE': return quantity * v;
        case 'FIXED': return v;
        default: return 0;
    }
}

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
export function chargesFor({ price, quantity, slabs = [], charges = DEFAULT_PSX_CHARGES,
    side = 'BUY' } = {}) {
    const brokerage = brokerageFor({ price, quantity, slabs });
    if (!brokerage) return { brokerage: 0, lines: [], total: 0 };

    const context = { brokerage, value: Number(price) * Number(quantity), quantity: Number(quantity) };
    const lines = (charges || [])
        .filter(c => !c.appliesTo || c.appliesTo === 'BOTH' || c.appliesTo === side)
        .map(c => ({ name: c.name, amount: amountOf(c, context) }))
        .filter(l => l.amount > 0);

    return {
        brokerage,
        lines,
        total: brokerage + lines.reduce((s, l) => s + l.amount, 0)
    };
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
