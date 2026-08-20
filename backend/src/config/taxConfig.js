/**
 * PSX Tax Configuration (Tax Year 2026)
 * Source: Income Tax Ordinance 2001 - Section 37A (CGT), Section 150 (Dividend WHT)
 *
 * Pakistan CGT on listed securities is holding-period driven and depends on
 * filer status. NCCPL deducts it at T+2 settlement using FIFO. Dividend WHT is
 * a final tax; CGT is advance (adjustable) tax claimed as a credit at filing.
 *
 * The Pakistan tax year runs July 1 -> June 30.
 */

export const FILER_STATUS = {
    FILER: 'FILER',
    NON_FILER: 'NON_FILER'
};

/**
 * CGT rate tiers by holding period (in months), Section 37A.
 * `maxMonths: null` means "no upper bound" (long-term).
 * Rates are percentages.
 */
export const CGT_TIERS = [
    { label: 'short-term', minMonths: 0, maxMonths: 12, filerRate: 15, nonFilerRate: 20 },
    { label: 'medium-term', minMonths: 12, maxMonths: 24, filerRate: 12.5, nonFilerRate: 20 },
    { label: 'long-term', minMonths: 24, maxMonths: null, filerRate: 0, nonFilerRate: 0 }
];

/**
 * Dividend withholding tax rates, Section 150. Final tax.
 *
 * Reference only, and deliberately not applied anywhere. Dividends are recorded
 * as the cash actually received, which is already net of this - so deducting it
 * again would tax the same rupees twice. Kept because a return still declares
 * the gross figure and the tax withheld, and because the day someone records a
 * gross dividend instead, this is the rate they will need.
 */
export const DIVIDEND_WHT = {
    [FILER_STATUS.FILER]: 15,
    [FILER_STATUS.NON_FILER]: 30
};

/**
 * Number of tax years a capital loss on listed securities may be carried
 * forward, Section 37A.
 */
export const LOSS_CARRY_FORWARD_YEARS = 6;

/**
 * Months elapsed between two dates. Uses calendar months so that a lot bought
 * on 15 Jan and sold on 15 Jul reads as exactly 6 months.
 *
 * Read in UTC, deliberately. Local getters shifted any timestamp late in the UTC
 * day onto the next calendar day in Asia/Karachi, which cost a whole month at a
 * boundary - and a lot reading 11 months instead of 12 is taxed at 15% rather
 * than 12.5%. Dates entered as a day are midnight UTC; the ones carrying a real
 * time come from the journal booking a fill.
 */
export function holdingMonths(purchaseDate, sellDate) {
    const buy = new Date(purchaseDate);
    const sell = new Date(sellDate);
    if (isNaN(buy) || isNaN(sell)) return 0;

    let months = (sell.getUTCFullYear() - buy.getUTCFullYear()) * 12
        + (sell.getUTCMonth() - buy.getUTCMonth());

    // Partial month: only count it if the day-of-month has been reached.
    if (sell.getUTCDate() < buy.getUTCDate()) months -= 1;

    return Math.max(0, months);
}

/**
 * Resolve the CGT tier and rate for a holding period + filer status.
 * @returns {{ label, rate }} rate as a percentage
 */
export function cgtRateFor(months, filerStatus = FILER_STATUS.FILER) {
    const isFiler = filerStatus !== FILER_STATUS.NON_FILER;
    const tier = CGT_TIERS.find(t =>
        months >= t.minMonths && (t.maxMonths === null || months < t.maxMonths)
    ) || CGT_TIERS[CGT_TIERS.length - 1];

    return {
        label: tier.label,
        rate: isFiler ? tier.filerRate : tier.nonFilerRate
    };
}

/**
 * Pakistan tax year for a given date: July 1 (year N-1) -> June 30 (year N).
 * A disposal on 2026-03-01 belongs to tax year 2026 (Jul 2025 - Jun 2026).
 * @returns {number} the ending calendar year of the tax year
 */
export function taxYearOf(date) {
    const d = new Date(date);
    if (isNaN(d)) return null;
    // UTC, to match taxYearBounds below. Read locally, a disposal at 20:30 UTC on
    // 30 June read as 1 July in Karachi and was filed under the wrong tax year.
    // Months are 0-indexed; July is 6.
    return d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
}

/**
 * Start/end boundaries (inclusive start, exclusive end) for a tax year.
 * @param {number} taxYear ending calendar year (e.g. 2026)
 */
export function taxYearBounds(taxYear) {
    return {
        start: new Date(Date.UTC(taxYear - 1, 6, 1, 0, 0, 0)),        // Jul 1
        end: new Date(Date.UTC(taxYear, 5, 30, 23, 59, 59, 999))      // Jun 30
    };
}

/**
 * Capital gains tax per tax year, after relieving losses against gains.
 *
 * Taxing each disposal on its own overstates the bill badly: a book that made
 * 296,190 in gains and 287,825 in losses owes tax on the 8,365 it actually
 * netted, not on the gross gains. Losses on listed securities offset gains on
 * listed securities, and whatever is left over carries forward six tax years.
 *
 * Relief is applied to the most heavily taxed gains first, and older losses are
 * spent before newer ones so nothing expires while a usable loss sits behind it.
 * Both choices favour the taxpayer, which is the reading to take when the
 * alternative is over-reporting your own tax.
 *
 * @param {Array} disposals from a lot-tracking calculator: { taxYear, gain, cgtRate }
 * @returns {Array} one row per tax year, oldest first
 */
export function cgtByTaxYear(disposals = [], { carryForwardYears = LOSS_CARRY_FORWARD_YEARS } = {}) {
    const years = [...new Set(disposals.map(d => d.taxYear).filter(y => y != null))].sort((a, b) => a - b);

    // Unused losses, each remembering the year it arose so it can expire.
    let pool = [];
    const rows = [];

    for (const taxYear of years) {
        const ofYear = disposals.filter(d => d.taxYear === taxYear);
        const gains = ofYear.filter(d => d.gain > 0);
        const lossTotal = -ofYear.filter(d => d.gain < 0).reduce((s, d) => s + d.gain, 0);

        // A loss from year Y is spendable in Y through Y + carryForwardYears.
        pool = pool.filter(l => taxYear - l.year <= carryForwardYears);
        const carriedIn = pool.reduce((s, l) => s + l.amount, 0);

        if (lossTotal > 0) pool.push({ year: taxYear, amount: lossTotal });
        pool.sort((a, b) => a.year - b.year);

        let tax = 0;
        let taxable = 0;
        const grossGains = gains.reduce((s, d) => s + d.gain, 0);

        for (const d of [...gains].sort((a, b) => b.cgtRate - a.cgtRate)) {
            let net = d.gain;

            // Spend the oldest relief first, and never on an exempt gain - that
            // would burn a loss to save nothing.
            if (d.cgtRate > 0) {
                for (const loss of pool) {
                    if (net <= 0) break;
                    const used = Math.min(loss.amount, net);
                    loss.amount -= used;
                    net -= used;
                }
            }

            taxable += net;
            tax += (net * d.cgtRate) / 100;
        }

        pool = pool.filter(l => l.amount > 0.005);

        rows.push({
            taxYear,
            gains: round(grossGains),
            losses: round(-lossTotal),
            reliefUsed: round(carriedIn + lossTotal - pool.reduce((s, l) => s + l.amount, 0)),
            taxable: round(taxable),
            tax: round(tax),
            carriedForward: round(pool.reduce((s, l) => s + l.amount, 0))
        });
    }

    return rows;
}

const round = (n) => Math.round(n * 100) / 100;
