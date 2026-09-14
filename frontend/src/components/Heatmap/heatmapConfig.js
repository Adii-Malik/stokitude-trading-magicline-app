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

// "This" is calendar and close-to-close; "past" rolls N days back from today.
export const TIMEFRAMES = [
    { id: 'change', label: 'Today', hint: 'since yesterday’s close' },
    { id: 'change|1W', label: 'This week', hint: 'since last Friday’s close' },
    { id: 'change|1M', label: 'This month', hint: 'since last month’s close' },
    { id: 'Perf.W', label: 'Past week', hint: 'rolling 7 days, not this week' },
    { id: 'Perf.1M', label: 'Past month', hint: 'rolling 30 days, not this month' },
    { id: 'Perf.3M', label: 'Past 3 months' },
    { id: 'Perf.6M', label: 'Past 6 months' },
    { id: 'Perf.YTD', label: 'Year so far', hint: 'since 1 January' },
    { id: 'Perf.Y', label: 'Past 12 months' },
    { id: 'Perf.5Y', label: 'Past 5 years' }
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
