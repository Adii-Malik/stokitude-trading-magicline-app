/**
 * Brokerage from a slab table.
 *
 * Mirrors frontend/src/utils/commission.js, which the transaction form uses for
 * instant feedback. Kept here so server-side work - backfills, imports - does
 * not have to reach into the frontend package.
 */

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
