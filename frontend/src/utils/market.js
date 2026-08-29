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

export default { landingFor };
