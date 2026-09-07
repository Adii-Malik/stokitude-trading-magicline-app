import Stock from '../models/Stock.js';

/**
 * The session's numbers for a set of symbols, whichever market they trade in.
 *
 * This asked the warehouse first, and that was the wrong order. The warehouse is
 * the nightly bar sync's output, and a symbol whose bars stop arriving keeps its
 * last close forever while looking perfectly healthy - NRL sat at 499.74 for
 * weeks while the board had it at 560. A level watcher reading that fired on a
 * price the stock had not traded at since August, and told its owner the level
 * printed "today". A stale number is worse than no number, because nothing
 * downstream can tell the difference.
 *
 * So the scanner is asked first and the warehouse is the fallback. That also
 * makes the watcher agree with the screen by construction: the shortlist row and
 * the heatmap both price a name off this same feed, and a level that fires on a
 * number the row never showed you is indefensible however correct it is.
 *
 * Not the heatmap's board, though - that is capped at the largest thousand
 * companies and the smallest on it is $22.75B, so a mid-cap you flagged would
 * quietly never be priced. A filter on the symbols themselves has no cap.
 */

const REGION = { PK: 'pakistan', US: 'america' };

/**
 * Long enough that a fifteen-minute poll never asks twice for one run, short
 * enough that the next run gets a fresh number. The feed itself is delayed
 * fifteen minutes, so anything tighter buys nothing.
 */
const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

/** One request covers this many names comfortably; a long shortlist is chunked. */
const CHUNK = 200;

/**
 * Close, high and low - the whole session, not one number.
 *
 * The extremes are what make a level checkable without watching every tick:
 * they run from the open, so "did the day reach 530" is answerable at any point
 * in the afternoon and stays answerable if a poll is missed entirely.
 */
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
                columns: ['name', 'close', 'high', 'low'],
                range: [0, batch.length]
            })
        });
        if (!res.ok) throw new Error(`TradingView scanner returned ${res.status}`);

        const body = await res.json();
        for (const row of body.data || []) {
            const [symbol, close, high, low] = row.d || [];
            if (symbol && close != null) {
                out.set(String(symbol).toUpperCase(), {
                    last: close,
                    // A name that has not traded today reports no range. Falling
                    // back to the last price keeps every comparison defined.
                    high: high ?? close,
                    low: low ?? close,
                    live: true
                });
            }
        }
    }
    return out;
}

/**
 * @param symbols {string[]}
 * @param market {string} which board to ask. A symbol does not carry its market,
 *        so the caller - which loaded the records and therefore knows - says.
 * @returns {Promise<Map<string, {last: number, high: number, low: number, live: boolean}>>}
 *          symbol -> session, absent where unknown. `live` is false for a
 *          warehoused close, which is a previous session and cannot be treated
 *          as a range.
 */
export async function quotesFor(symbols = [], market = 'PK') {
    const wanted = [...new Set(symbols.filter(Boolean).map((s) => String(s).toUpperCase()))];
    const found = new Map();
    if (!wanted.length) return found;

    const now = Date.now();
    const ask = [];
    for (const symbol of wanted) {
        const hit = cache.get(`${market}|${symbol}`);
        if (hit && now - hit.at < TTL_MS) found.set(symbol, hit.quote);
        else ask.push(symbol);
    }

    if (ask.length) {
        // A scanner that is down must not take the whole check with it: the
        // caller gets what could be found and is expected to count the rest
        // rather than treat it as nothing to do.
        try {
            const live = await fromScanner(ask, market);
            for (const [symbol, quote] of live) {
                found.set(symbol, quote);
                cache.set(`${market}|${symbol}`, { at: now, quote });
            }
        } catch (error) {
            console.error(`Could not price ${ask.length} ${market} symbol(s):`, error.message);
        }
    }

    const still = wanted.filter((s) => !found.has(s));
    if (!still.length) return found;

    /**
     * The warehouse, for whatever the scanner could not answer.
     *
     * Marked `live: false` on the way out. It is a previous close and has no
     * session range, so a caller that wants "did today reach this" must not be
     * handed one it can mistake for today.
     */
    const stocks = await Stock.find({ symbol: { $in: still } })
        .unscoped()
        .select('symbol currentPrice')
        .lean();
    for (const s of stocks) {
        if (s.currentPrice != null) {
            found.set(s.symbol, { last: s.currentPrice, high: s.currentPrice, low: s.currentPrice, live: false });
        }
    }

    return found;
}

/** Just the last price, for callers that compare one number. */
export async function pricesFor(symbols = [], market = 'PK') {
    const quotes = await quotesFor(symbols, market);
    return new Map([...quotes].map(([symbol, q]) => [symbol, q.last]));
}

export default { quotesFor, pricesFor };
