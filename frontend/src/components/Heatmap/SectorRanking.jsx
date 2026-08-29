import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import api from '../../services/api';

const pct = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
const tone = (v) => (v > 0 ? 'text-emerald-600 dark:text-emerald-400'
    : v < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400');

/**
 * A bar that grows either side of a centre line, so up and down are read by
 * direction before the number is read at all. Scaled to the strongest move on
 * screen rather than a fixed range - a quiet month would otherwise draw every
 * sector as a stub.
 */
function Bar({ value, max }) {
    const width = max ? Math.min(Math.abs(value) / max * 50, 50) : 0;
    return (
        <div className="relative h-4 w-full">
            <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
            <div
                className={`absolute inset-y-0 rounded-sm ${value >= 0 ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`}
                style={value >= 0
                    ? { left: '50%', width: `${width}%` }
                    : { right: '50%', width: `${width}%` }}
            />
        </div>
    );
}

/** The stocks behind a sector - the reason for looking at the sector at all. */
function Constituents({ stocks }) {
    return (
        <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3">
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {stocks.map((s) => (
                    <div key={s.symbol} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{s.symbol}</span>
                        <span className="flex-1 truncate text-xs text-gray-400 dark:text-gray-500">{s.name}</span>
                        <span className={`tabular-nums font-medium ${tone(s.perf)}`}>{pct(s.perf)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function SectorRanking({ period, periodLabel }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(null);

    useEffect(() => {
        let live = true;
        setData(null); setError(null);
        api.get('/heatmap/sectors', { params: { period } })
            .then(({ data }) => { if (live) setData(data.data); })
            .catch((e) => { if (live) setError(e.response?.data?.message || 'Could not load sectors'); });
        return () => { live = false; };
    }, [period]);

    if (error) {
        return <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-sm text-rose-600 dark:text-rose-400">{error}</div>;
    }
    if (!data) {
        return <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-sm text-gray-500 dark:text-gray-400">Ranking sectors…</div>;
    }

    const max = Math.max(...data.sectors.map((s) => Math.abs(s.median)), 1);

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="flex items-baseline justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    Sectors, best to worst
                </h2>
                {/* The excluded count is shown, not hidden: on PSX it is the ETFs,
                    preference shares and closed-end funds we hold no sector for,
                    and a reader is entitled to know the list is not everything. */}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    over {periodLabel?.toLowerCase()} · {data.sectors.length} sectors · {data.counted} stocks
                    {data.truncated > 0 && ` (largest ${data.truncated} of ${data.available})`}
                    {data.unclassified > 0 && ` · ${data.unclassified} funds and preference shares left out`}
                </span>
            </div>

            <div className="hidden sm:grid grid-cols-[1fr_auto_5rem_6rem] gap-3 px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700/50">
                <span>Sector</span><span className="w-32 text-center">Move</span>
                <span className="text-right">Typical</span><span className="text-right">How many up</span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {data.sectors.map((s) => (
                    <div key={s.sector}>
                        <button
                            type="button"
                            onClick={() => setOpen(open === s.sector ? null : s.sector)}
                            className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_5rem_6rem] items-center gap-3 px-5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                {open === s.sector
                                    ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
                                    : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
                                <span className="truncate text-sm text-gray-800 dark:text-gray-200">{s.sector}</span>
                                <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">({s.count})</span>
                            </span>
                            <span className="hidden sm:block w-32"><Bar value={s.median} max={max} /></span>
                            <span className={`text-right text-sm font-semibold tabular-nums ${tone(s.median)}`}>{pct(s.median)}</span>
                            {/* Breadth, because a sector median says nothing about whether the
                                move was broad. Nineteen Modarabas with fifteen up is a different
                                trade from one name carrying the number. */}
                            <span className="hidden sm:block text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                                {s.up}/{s.count}
                            </span>
                        </button>
                        {open === s.sector && <Constituents stocks={s.stocks} />}
                    </div>
                ))}
            </div>
        </div>
    );
}
