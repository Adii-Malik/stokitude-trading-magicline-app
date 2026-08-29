import Stock from '../models/Stock.js';
import { currentMarket } from '../config/marketStore.js';

/**
 * How each sector of a market is doing, over every period at once.
 *
 * TradingView's heatmap widget cannot answer this. It sizes every tile by market
 * cap, so five giants own the screen while Modarabas - nineteen companies,
 * fifteen of them up - is a sliver too small to label. And it groups by its own
 * twenty sectors, which file fertiliser, sugar and textile together under
 * Process Industries.
 *
 * So the numbers come from TradingView and the grouping comes from us: the PSX
 * sector already stored against every stock. Nothing is warehoused - the scanner
 * returns each company's performance over all eight periods in a single request,
 * and a sector is that arithmetic over its members.
 */

const SCANNER = {
    PK: { region: 'pakistan', exchange: 'PSX' },
    US: { region: 'america', exchange: null }
};

/** Every period, fetched together, so switching between them costs nothing. */
export const PERIODS = [
    { id: 'change', label: 'Today', short: '1D' },
    { id: 'Perf.W', label: '1 week', short: '1W' },
    { id: 'Perf.1M', label: '1 month', short: '1M' },
    { id: 'Perf.3M', label: '3 months', short: '3M' },
    { id: 'Perf.6M', label: '6 months', short: '6M' },
    { id: 'Perf.YTD', label: 'Year so far', short: 'YTD' },
    { id: 'Perf.Y', label: '12 months', short: '1Y' },
    { id: 'Perf.5Y', label: '5 years', short: '5Y' }
];

const TTL_MS = 5 * 60 * 1000;
/** As many as one request should ask for. Anything past it is reported, not hidden. */
const LIMIT = 1000;
const cache = new Map();

async function fetchScanner(market) {
    const cfg = SCANNER[market];
    const filter = [{ left: 'type', operation: 'equal', right: 'stock' }];
    if (cfg.exchange) filter.push({ left: 'exchange', operation: 'equal', right: cfg.exchange });

    const columns = ['name', 'description', 'sector', 'market_cap_basic', 'close', ...PERIODS.map(p => p.id)];
    const res = await fetch(`https://scanner.tradingview.com/${cfg.region}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
            filter,
            columns,
            // Largest first, so a board bigger than the cap yields a universe you
            // can name - the biggest N - rather than whichever ones came back.
            sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
            range: [0, LIMIT]
        })
    });
    if (!res.ok) throw new Error(`TradingView scanner returned ${res.status}`);
    const body = await res.json();
    return {
        available: body.totalCount ?? (body.data || []).length,
        rows: (body.data || []).map((r) => {
            const [symbol, name, tvSector, marketCap, close, ...perfs] = r.d;
            return {
                symbol, name, tvSector, marketCap, close,
                perf: Object.fromEntries(PERIODS.map((p, i) => [p.id, perfs[i]]))
            };
        })
    };
}

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * A sector's number for one period.
 *
 * Median leads rather than mean. Textile Spinning reads +0.1% median against
 * +10.7% mean - the mean is two names running, the median is what the other
 * thirty-seven did. Breadth rides alongside because a median says nothing about
 * whether the move was broad.
 */
function summarise(members, period) {
    const values = members.map((m) => m.perf[period]).filter((v) => v != null);
    if (!values.length) return null;
    const capped = members.filter((m) => m.marketCap && m.perf[period] != null);
    const totalCap = capped.reduce((a, m) => a + m.marketCap, 0);
    const up = values.filter((v) => v > 0).length;
    const down = values.filter((v) => v < 0).length;
    return {
        median: median(values),
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        capWeighted: totalCap ? capped.reduce((a, m) => a + m.perf[period] * m.marketCap, 0) / totalCap : null,
        up,
        down,
        // Trendlyne's advance/decline ratio. Infinity when nothing fell, which is
        // information rather than an error - every name in the sector rose.
        ratio: down ? up / down : (up ? null : 0)
    };
}

export async function sectorPerformance() {
    const market = currentMarket() || 'PK';
    if (!SCANNER[market]) throw Object.assign(new Error(`No scanner for ${market}`), { status: 400 });

    const hit = cache.get(market);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

    const { rows, available } = await fetchScanner(market);

    const ours = new Map(
        (await Stock.find({ sector: { $nin: [null, ''] } }).select('symbol sector').lean())
            .map((s) => [s.symbol, s.sector])
    );

    /**
     * One taxonomy per list, never both.
     *
     * Where we hold sectors of our own - PSX - they are the only ones used, and
     * anything unclassified is dropped rather than filled in from TradingView.
     * Mixing them put CEMENT and Non-Energy Minerals in one ranking as though
     * they were different sectors. What gets dropped on PSX is ETFs, preference
     * shares and closed-end funds, none of which belong in a sector reading.
     */
    const useOurs = rows.some((r) => ours.has(r.symbol));

    const groups = new Map();
    let unclassified = 0;
    for (const row of rows) {
        const sector = useOurs ? ours.get(row.symbol) : row.tvSector;
        if (!sector) { unclassified++; continue; }
        if (!groups.has(sector)) groups.set(sector, []);
        groups.get(sector).push(row);
    }

    const sectors = [...groups.entries()].map(([sector, members]) => ({
        sector,
        count: members.length,
        marketCap: members.reduce((a, m) => a + (m.marketCap || 0), 0),
        periods: Object.fromEntries(PERIODS.map((p) => [p.id, summarise(members, p.id)])),
        stocks: members.map((m) => ({
            symbol: m.symbol, name: m.name, close: m.close, marketCap: m.marketCap, perf: m.perf
        }))
    }));

    const counted = sectors.reduce((a, s) => a + s.count, 0);
    const value = {
        market,
        taxonomy: useOurs ? 'psx' : 'tradingview',
        periods: PERIODS,
        sectors,
        counted,
        unclassified,
        available,
        truncated: available > LIMIT ? LIMIT : 0,
        asOf: new Date().toISOString()
    };
    cache.set(market, { at: Date.now(), value });
    return value;
}

export default { sectorPerformance, PERIODS };
