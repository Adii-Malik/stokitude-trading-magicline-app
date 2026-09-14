/**
 * What the heatmap can be asked for, in words rather than field names.
 *
 * TradingView names these Perf.1M and Perf.YTD. These are the same choices
 * phrased the way you would ask the question.
 */

/** The board each market is looking at, for the sentence under the title. */
export const BOARDS = {
    PK: { label: 'Pakistan Stock Exchange' },
    US: { label: 'the US market' }
};

// Day counts for the rolling windows, so none of them can be heard as a
// calendar period. "This month" is the only calendar one the scanner offers.
export const TIMEFRAMES = [
    { id: 'change', label: 'Today', hint: 'since yesterday’s close' },
    { id: 'Perf.W', label: 'Last 7 days' },
    { id: 'change|1M', label: 'This month', hint: 'since last month’s close' },
    { id: 'Perf.1M', label: 'Last 30 days' },
    { id: 'Perf.3M', label: 'Last 3 months' },
    { id: 'Perf.6M', label: 'Last 6 months' },
    { id: 'Perf.YTD', label: 'Year so far', hint: 'since 1 January' },
    { id: 'Perf.Y', label: 'Last 12 months' },
    { id: 'Perf.5Y', label: 'Last 5 years' }
];

/** The month you are in, which is the month people mean when they ask. */
export const DEFAULTS = { timeframe: 'change|1M' };

/**
 * The period, carried in the URL.
 *
 * Clicking a sector used to land on a page reset to one month, whatever you had
 * been looking at - the question you asked the board was thrown away by the
 * answer. Keeping it in the query string means the sector page opens on the
 * period you clicked, the back link returns on the period you left, and a link
 * you paste shows what you were seeing.
 */
export const PERIOD_PARAM = 'over';

export function periodFrom(params) {
    const asked = params.get(PERIOD_PARAM);
    return TIMEFRAMES.some((t) => t.id === asked) ? asked : DEFAULTS.timeframe;
}
