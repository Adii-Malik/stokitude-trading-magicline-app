/**
 * What the heatmap can be asked for, in words rather than field names.
 *
 * TradingView's own controls say "Perf.1M" and "market_cap_basic". These are
 * the same choices phrased the way you would ask the question, which is why the
 * widget's top bar is switched off and this drives it instead.
 */

/** Which board each market looks at. A wrong id here is the dangerous case:
 *  the widget does not error on one, it quietly renders the S&P 500 instead. */
export const BOARDS = {
    PK: { dataSource: 'AllPK', label: 'Pakistan Stock Exchange' },
    US: { dataSource: 'SPX500', label: 'S&P 500' }
};

export const TIMEFRAMES = [
    { id: 'change', label: 'Today', hint: 'since yesterday’s close' },
    { id: 'Perf.W', label: '1 week' },
    { id: 'Perf.1M', label: '1 month' },
    { id: 'Perf.3M', label: '3 months' },
    { id: 'Perf.6M', label: '6 months' },
    { id: 'Perf.YTD', label: 'Year so far' },
    { id: 'Perf.Y', label: '12 months' }
];

export const GROUPINGS = [
    { id: 'sector', label: 'By sector' },
    { id: 'no_group', label: 'Every stock' }
];

export const SIZES = [
    { id: 'market_cap_basic', label: 'Company size' },
    { id: 'volume', label: 'Volume traded' }
];

/** A month is long enough to be a trend and short enough to still be tradeable. */
export const DEFAULTS = { timeframe: 'Perf.1M', grouping: 'sector', size: 'market_cap_basic' };
