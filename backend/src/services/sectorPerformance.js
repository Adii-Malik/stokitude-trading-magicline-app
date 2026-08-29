import Stock from '../models/Stock.js';
import { currentMarket } from '../config/marketStore.js';

/**
 * How each sector of a market is doing, ranked.
 *
 * The heatmap next to this cannot answer the question. It sizes every tile by
 * market cap, so five giants own the screen and Modarabas - nineteen companies,
 * fifteen of them up - is a sliver you cannot read. Worse, it groups by
 * TradingView's twenty sectors, which put fertiliser, sugar and textile in one
 * bucket called Process Industries.
 *
 * So the numbers come from TradingView, and the grouping comes from us: the PSX
 * sector already stored against every stock. No history is warehoused for this -
 * the scanner returns each company's performance over every period we offer,
 * and a sector is that arithmetic over its members.
 */

const SCANNER = {
    PK: { region: 'pakistan', exchange: 'PSX' },
    US: { region: 'america', exchange: null }
};

/** The periods the heatmap offers, so both halves of the screen agree. */
export const PERIODS = ['change', 'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.YTD', 'Perf.Y'];

// The scanner is a live quote feed and this is a sector overview - a few minutes
// stale is invisible, and it keeps a page refresh from being a request each.
const TTL_MS = 5 * 60 * 1000;

/** As many as one request should ask for. Anything past it is reported, not hidden. */
const LIMIT = 1000;
const cache = new Map();

async function fetchScanner(market, period) {
    const cfg = SCANNER[market];
    const filter = [{ left: 'type', operation: 'equal', right: 'stock' }];
    if (cfg.exchange) filter.push({ left: 'exchange', operation: 'equal', right: cfg.exchange });

    const res = await fetch(`https://scanner.tradingview.com/${cfg.region}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
            filter,
            columns: ['name', 'description', 'sector', period, 'market_cap_basic', 'close'],
            // Largest first, so that when a board is bigger than the cap the part
            // taken is a universe you can name - the biggest N companies - rather
            // than whichever ones the scanner happened to return. PSX has 482 and
            // never truncates; America has 11,762 and always does.
            sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
            range: [0, LIMIT]
        })
    });
    if (!res.ok) throw new Error(`TradingView scanner returned ${res.status}`);
    const body = await res.json();
    return {
        available: body.totalCount ?? (body.data || []).length,
        rows: (body.data || []).map((r) => ({
            symbol: r.d[0], name: r.d[1], tvSector: r.d[2],
            perf: r.d[3], marketCap: r.d[4], close: r.d[5]
        }))
    };
}

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export async function sectorPerformance(period = 'Perf.1M') {
    if (!PERIODS.includes(period)) {
        throw Object.assign(new Error(`Unknown period '${period}'`), { status: 400 });
    }
    const market = currentMarket() || 'PK';
    if (!SCANNER[market]) throw Object.assign(new Error(`No scanner for ${market}`), { status: 400 });

    const key = `${market}:${period}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

    const { rows, available } = await fetchScanner(market, period);

    const ours = new Map(
        (await Stock.find({ sector: { $nin: [null, ''] } }).select('symbol sector').lean())
            .map((s) => [s.symbol, s.sector])
    );

    /**
     * One taxonomy per list, never both.
     *
     * Where we hold sectors of our own - PSX - they are the only ones used, and
     * anything we do not classify is left out rather than filled in from
     * TradingView. Mixing them put CEMENT and Non-Energy Minerals in the same
     * ranking as if they were different sectors, which is not a thing that can
     * be read. What gets dropped on PSX is ETFs, preference shares and
     * closed-end funds, none of which belong in a sector reading anyway.
     *
     * Where we hold none - US - TradingView's are the whole list and there is
     * nothing to mix.
     */
    const useOurs = rows.some((r) => ours.has(r.symbol));

    const groups = new Map();
    let unclassified = 0;
    for (const row of rows) {
        if (row.perf == null) continue;
        const sector = useOurs ? ours.get(row.symbol) : row.tvSector;
        if (!sector) { unclassified++; continue; }
        if (!groups.has(sector)) groups.set(sector, []);
        groups.get(sector).push(row);
    }

    const sectors = [...groups.entries()].map(([sector, members]) => {
        const perfs = members.map((m) => m.perf);
        const capped = members.filter((m) => m.marketCap);
        const totalCap = capped.reduce((a, m) => a + m.marketCap, 0);
        return {
            sector,
            count: members.length,
            // Median leads, because a sector is not one company. Textile Spinning
            // reads +0.1 on the median and +10.7 on the mean - the mean is two
            // names running, the median is what most of the sector actually did.
            median: median(perfs),
            mean: perfs.reduce((a, b) => a + b, 0) / perfs.length,
            capWeighted: totalCap ? capped.reduce((a, m) => a + m.perf * m.marketCap, 0) / totalCap : null,
            up: perfs.filter((p) => p > 0).length,
            down: perfs.filter((p) => p < 0).length,
            stocks: members
                .sort((a, b) => b.perf - a.perf)
                .map((m) => ({ symbol: m.symbol, name: m.name, perf: m.perf, close: m.close, marketCap: m.marketCap }))
        };
    }).sort((a, b) => b.median - a.median);

    const counted = [...groups.values()].reduce((a, m) => a + m.length, 0);
    const value = {
        market, period, sectors, counted, unclassified,
        taxonomy: useOurs ? 'psx' : 'tradingview',
        available,
        truncated: available > LIMIT ? LIMIT : 0,
        asOf: new Date().toISOString()
    };
    cache.set(key, { at: Date.now(), value });
    return value;
}

export default { sectorPerformance, PERIODS };
