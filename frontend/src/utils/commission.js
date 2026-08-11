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
 * @returns {number} fee for the trade, 0 when no band applies
 */
export function commissionFor({ price, quantity, slabs = [] }) {
    const p = Number(price);
    const q = Number(quantity);
    if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0) return 0;

    const slab = slabFor(p, slabs);
    if (!slab) return 0;

    return slab.type === 'PERCENT'
        ? (q * p * Number(slab.value)) / 100
        : q * Number(slab.value);
}

/** Human description of what a band charges, for the UI. */
export function describeSlab(slab) {
    if (!slab) return 'no band matches this price';
    return slab.type === 'PERCENT'
        ? `${slab.value}% of value`
        : `${slab.value} per share`;
}
