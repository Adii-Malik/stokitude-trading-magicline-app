/**
 * Where a market switch leaves you.
 *
 * A page about one book cannot survive the switch: that book is in the other
 * market, and the server answers 404 for it there. Reloading the same URL was
 * the bug - the page came back showing rupees under a US flag.
 */
export function landingFor(path) {
    if (/^\/portfolios\/[^/]+/.test(path)) return '/portfolios';
    // Same reasoning for a sector: PSX's CEMENT has no counterpart on a US
    // board, and the page would sit there asking for a sector that is not there.
    if (/^\/heatmap\/[^/]+/.test(path)) return '/heatmap';
    return path;
}

/**
 * Whether a market has a price history to draw.
 *
 * The engine warehouses PSX bars and nothing else, so a US book has no curve,
 * no drawdown and no index to sit beside. Everything that needs those is not
 * shown there at all rather than shown empty - a panel explaining what it
 * cannot do still spends a section of the screen saying nothing.
 *
 * Kept here, next to landingFor, because both answer the same kind of question:
 * what this market does and does not have.
 */
export function hasPriceHistory(market) {
    return String(market || 'PK').toUpperCase() === 'PK';
}

/**
 * Whether a market has the fundamentals the allocation engine scores on.
 *
 * Separate from hasPriceHistory on purpose, even though both are PK-only today.
 * They are different facts about different collections - bars in psxdailies,
 * ratios in stockfundamentals - and folding them into one flag is how the
 * stocks list and the OHLCV history came to be treated as the same problem.
 *
 * With no fundamentals there is nothing to rank, so the engine has no universe
 * and the screen has nothing to offer.
 */
export function hasFundamentals(market) {
    return String(market || 'PK').toUpperCase() === 'PK';
}

export default { landingFor, hasPriceHistory, hasFundamentals };
