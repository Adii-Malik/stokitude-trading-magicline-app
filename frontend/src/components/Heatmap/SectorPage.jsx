import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown } from 'lucide-react';
import { useMarket } from '../../contexts/MarketContext';
import { useTheme } from '../../contexts/ThemeContext';
import Treemap from './Treemap';
import { useSectors, money, pct, tone, fromSlug } from './heatmapData';
import { TIMEFRAMES, PERIOD_PARAM, periodFrom } from './heatmapConfig';

/** The same row of choices as the board, so the two pages read alike. */
function Choice({ label, options, value, onChange }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
            <div className="flex flex-wrap gap-1">
                {options.map((o) => (
                    <button key={o.id} type="button" onClick={() => onChange(o.id)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === o.id
                            ? 'bg-cyan-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}>
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

/**
 * One sector, in full.
 *
 * The board answers which sector is moving; this answers which name inside it
 * is. Same treemap, same period columns - a row in the table used to expand
 * into a cramped strip that pushed the rest of the list off screen, and a
 * sector of thirty-nine names needs a page.
 */
export default function SectorPage() {
    const { sector: slug } = useParams();
    const navigate = useNavigate();
    const { market } = useMarket();
    const currency = market === 'PK' ? 'PKR' : market === 'US' ? 'USD' : null;
    const { theme } = useTheme();
    const { data, error } = useSectors(market);

    // Inherited from the board, so the sector opens on the period you clicked.
    const [params, setParams] = useSearchParams();
    const period = periodFrom(params);
    const setPeriod = (id) => setParams({ [PERIOD_PARAM]: id }, { replace: true });
    const [sort, setSort] = useState({ key: 'weight', dir: 'desc' });

    const name = fromSlug(slug);
    const sector = data?.sectors.find((s) => s.sector === name);
    const label = TIMEFRAMES.find((t) => t.id === period)?.label;

    /** Where you are, and the way back, in one line rather than a stray button. */
    const crumbs = (here) => (
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <button type="button" onClick={() => navigate(`/heatmap?${PERIOD_PARAM}=${period}`)}
                className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:text-cyan-600 dark:hover:text-cyan-400">
                <ArrowLeft className="h-3.5 w-3.5" /> Sector Heatmap
            </button>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{here}</span>
        </nav>
    );

    const shell = (body, here = name) => (
        <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">{crumbs(here)}</div>
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm dark:border-gray-700 dark:bg-gray-800">{body}</div>
        </div>
    );
    if (error) return shell(<span className="text-rose-600 dark:text-rose-400">{error}</span>);
    if (!data) return shell(<span className="text-gray-500 dark:text-gray-400">Reading the board…</span>);
    if (!sector) return shell(<span className="text-gray-500 dark:text-gray-400">No sector called “{name}” on this market.</span>);

    const stat = sector.periods[period];
    const items = sector.stocks.map((s) => ({
        key: s.symbol,
        label: s.symbol,
        value: s.perf[period] ?? 0,
        weight: s.marketCap || 0,
        note: `${s.symbol} — ${s.name}\n${pct(s.perf[period])} over ${label?.toLowerCase()}`
    }));

    const value = (s, key) => {
        if (key === 'weight') return s.marketCap || 0;
        if (key === 'close') return s.close ?? null;
        return s.perf[key] ?? null;
    };
    const rows = [...sector.stocks].sort((a, b) => {
        const av = value(a, sort.key), bv = value(b, sort.key);
        if (av == null) return 1;
        if (bv == null) return -1;
        return sort.dir === 'desc' ? bv - av : av - bv;
    });

    const head = (key, text, extra = '') => (
        <th onClick={() => setSort({ key, dir: sort.key === key && sort.dir === 'desc' ? 'asc' : 'desc' })}
            className={`cursor-pointer select-none whitespace-nowrap px-2 py-2 font-medium hover:text-gray-700 dark:hover:text-gray-200 ${extra} ${sort.key === key ? 'text-cyan-600 dark:text-cyan-400' : ''}`}>
            <span className="inline-flex items-center gap-1">{text}<ArrowUpDown className="h-3 w-3 opacity-40" /></span>
        </th>
    );

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                {crumbs(sector.sector)}
                <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{sector.sector}</h1>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                    <span><span className={`text-lg font-semibold ${tone(stat?.median)}`}>{pct(stat?.median)}</span> typical over {label?.toLowerCase()}</span>
                    <span>{sector.count} companies</span>
                    <span>{stat?.up ?? 0} up, {stat?.down ?? 0} down</span>
                    <span>{money(sector.marketCap)} combined</span>
                </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <Choice label="Period" options={TIMEFRAMES} value={period} onChange={setPeriod} />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <Treemap items={items} dark={theme === 'dark'} height={380} />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                    <h2 className="font-semibold text-gray-900 dark:text-white">Every company, every period</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium">Symbol</th>
                                <th className="px-2 py-2 text-left font-medium">Name</th>
                                {head('close', `Price${currency ? ` (${currency})` : ''}`, 'text-right')}
                                {head('weight', 'Market cap', 'text-right')}
                                {TIMEFRAMES.map((t) => head(t.id, t.label.replace('Year so far', 'YTD'), 'text-right'))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                            {rows.map((s) => (
                                <tr key={s.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{s.symbol}</td>
                                    <td className="max-w-xs truncate px-2 py-2 text-xs text-gray-500 dark:text-gray-400">{s.name}</td>
                                    <td className="px-2 py-2 text-right font-medium tabular-nums text-gray-800 dark:text-gray-200">
                                        {s.close == null ? '—' : s.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{money(s.marketCap)}</td>
                                    {TIMEFRAMES.map((t) => (
                                        <td key={t.id}
                                            className={`px-2 py-2 text-right tabular-nums ${tone(s.perf[t.id])} ${t.id === period ? 'bg-cyan-50/60 font-semibold dark:bg-cyan-900/20' : ''}`}>
                                            {pct(s.perf[t.id])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
