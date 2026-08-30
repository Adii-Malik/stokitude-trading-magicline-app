import Stock from '../models/Stock.js';

/**
 * The latest price for a set of symbols, whichever market they trade in.
 *
 * PSX is warehoused: the nightly sync writes bars and `stampPricesFromBars`
 * stamps the last close onto `Stock.currentPrice`, which is what every valuation
 * in the app reads. For a Pakistani name the answer is already in the database.
 *
 * The US book is not warehoused - deliberately, because fifteen million bars
 * would not fit the cluster - so there is no Stock row and `currentPrice` is
 * null for every US symbol. That gap is not academic: every journal entry in
 * this account is US, so a level watcher reading only `Stock.currentPrice`
 * would find a price for none of them and stay silent forever while looking
 * perfectly healthy.
 *
 * So anything the warehouse cannot answer is asked of TradingView's scanner by
 * name. Not the heatmap's board, which is capped at the largest thousand
 * companies - the smallest on it is $22.75B, and Masco at $15B falls off the
 * bottom, which is exactly the sort of hole that makes a watcher quietly
 * useless. A filter on the symbols themselves has no cap.
 */

const REGION = { PK: 'pakistan', US: 'america' };

/** Matches the board's five minutes: this is an end-of-day book either way. */
const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

/** One request covers this many names comfortably; a long shortlist is chunked. */
const CHUNK = 200;

async function fromScanner(symbols, market) {
    const region = REGION[market];
    if (!region || !symbols.length) return new Map();

    const out = new Map();
    for (let i = 0; i < symbols.length; i += CHUNK) {
        const batch = symbols.slice(i, i + CHUNK);
        const res = await fetch(`https://scanner.tradingview.com/${region}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
            body: JSON.stringify({
                filter: [
                    { left: 'type', operation: 'equal', right: 'stock' },
                    { left: 'name', operation: 'in_range', right: batch }
                ],
                columns: ['name', 'close'],
                range: [0, batch.length]
            })
        });
        if (!res.ok) throw new Error(`TradingView scanner returned ${res.status}`);

        const body = await res.json();
        for (const row of body.data || []) {
            const [symbol, close] = row.d || [];
            if (symbol && close != null) out.set(String(symbol).toUpperCase(), close);
        }
    }
    return out;
}

/**
 * @param symbols {string[]}
 * @param market {string} which board to ask when the warehouse has nothing.
 *        A symbol does not carry its market, so the caller - which loaded the
 *        records and therefore knows - has to say.
 * @returns {Promise<Map<string, number>>} symbol -> price, absent where unknown.
 */
export async function pricesFor(symbols = [], market = 'PK') {
    const wanted = [...new Set(symbols.filter(Boolean).map((s) => String(s).toUpperCase()))];
    const found = new Map();
    if (!wanted.length) return found;

    // The warehouse first: it is the canonical, split-and-dividend-adjusted
    // price that the rest of the app values against, and it is one query.
    const stocks = await Stock.find({ symbol: { $in: wanted } })
        .unscoped()
        .select('symbol currentPrice')
        .lean();
    for (const s of stocks) {
        if (s.currentPrice != null) found.set(s.symbol, s.currentPrice);
    }

    const now = Date.now();
    const missing = [];
    for (const symbol of wanted) {
        if (found.has(symbol)) continue;
        const hit = cache.get(`${market}|${symbol}`);
        if (hit && now - hit.at < TTL_MS) found.set(symbol, hit.price);
        else missing.push(symbol);
    }
    if (!missing.length) return found;

    // A scanner that is down must not take the warehoused prices with it. The
    // caller gets what could be found; the rest is checked again next run, and
    // callers are expected to count what they could not price rather than treat
    // it as nothing to do.
    try {
        const live = await fromScanner(missing, market);
        for (const [symbol, price] of live) {
            found.set(symbol, price);
            cache.set(`${market}|${symbol}`, { at: now, price });
        }
    } catch (error) {
        console.error(`Could not price ${missing.length} ${market} symbol(s):`, error.message);
    }

    return found;
}

export default { pricesFor };
