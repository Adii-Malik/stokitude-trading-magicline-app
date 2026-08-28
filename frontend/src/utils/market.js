/**
 * Where a market switch leaves you.
 *
 * A page about one book cannot survive the switch: that book is in the other
 * market, and the server answers 404 for it there. Reloading the same URL was
 * the bug - the page came back showing rupees under a US flag.
 */
export function landingFor(path) {
    return /^\/portfolios\/[^/]+/.test(path) ? '/portfolios' : path;
}

export default { landingFor };
