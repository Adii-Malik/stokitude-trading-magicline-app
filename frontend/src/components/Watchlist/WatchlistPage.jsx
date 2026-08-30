import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, RefreshCw, Check, X, ArrowUpRight } from 'lucide-react';
import { useWatchlist } from '../../contexts/WatchlistContext';
import { pct, tone, toSlug } from '../Heatmap/heatmapData';
import { TIMEFRAMES } from '../Heatmap/heatmapConfig';
import { group, isStale } from './horizons';

const labelOf = (period) => TIMEFRAMES.find((t) => t.id === period)?.label || period;

const ago = (days) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

/**
 * How far a name has travelled since you flagged it.
 *
 * Shown as a delta rather than two numbers, because the question on returning is
 * not "what is it doing" - the sector page answers that - but "did the thing I
 * noticed hold up".
 */
function Since({ item }) {
    if (item.perfNow == null || item.perfWhenNoticed == null) {
        return <span className="text-xs text-gray-400 dark:text-gray-500">no quote</span>;
    }
    const delta = item.perfNow - item.perfWhenNoticed;
    return (
        <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">since flagged</span>
            <span className={`rounded px-1.5 py-0.5 text-sm font-semibold tabular-nums ${tone(delta)}`}>
                {pct(delta)}
            </span>
        </span>
    );
}

function Row({ item, onAnalyse, onDrop, onOpen }) {
    const [verdict, setVerdict] = useState('');
    const [busy, setBusy] = useState(false);
    const stale = isStale(item);
    const waiting = item.state === 'noticed';

    const save = async () => {
        setBusy(true);
        try { await onAnalyse(item, verdict.trim()); } finally { setBusy(false); }
    };

    return (
        <div className={`relative border-t border-gray-200 px-4 py-3 dark:border-gray-700
                         ${waiting ? '' : 'bg-gray-50 dark:bg-gray-900/40'}`}>
            {/* The stripe is the only place colour means urgency rather than direction. */}
            <span className={`absolute inset-y-0 left-0 w-[3px] ${waiting
                ? (stale ? 'bg-rose-500' : 'bg-amber-500') : 'bg-transparent'}`} />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <button type="button" onClick={() => onOpen(item)}
                    className="font-semibold text-gray-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400">
                    {item.symbol}
                </button>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">
                    {item.name}
                </span>
                {stale && waiting && (
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                        stale
                    </span>
                )}
                <Since item={item} />
                <button type="button" onClick={() => onDrop(item)} title="Not interested"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-rose-600 dark:hover:bg-gray-700 dark:hover:text-rose-400">
                    <X className="h-4 w-4" />
                </button>
            </div>

            {waiting ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        value={verdict}
                        onChange={(e) => setVerdict(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                        maxLength={280}
                        placeholder="One line — what did the analysis tell you?"
                        aria-label={`Verdict for ${item.symbol}`}
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <button type="button" onClick={save} disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:opacity-60">
                        <Check className="h-4 w-4" /> Mark analysed
                    </button>
                </div>
            ) : (
                <p className="mt-1.5 border-l-2 border-gray-300 pl-2.5 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400">
                    {item.verdict || 'Analysed — no note.'}
                </p>
            )}
        </div>
    );
}

/**
 * Everything you flagged and have not finished with.
 *
 * Horizon first, sector second, name third. The horizon matters more than it
 * looks: a name down 3% since you noticed it is noise on a five-year idea and a
 * problem on one flagged yesterday, and a single flat list invites exactly that
 * comparison.
 */
export default function WatchlistPage() {
    const navigate = useNavigate();
    const { items, loading, error, reload, unflag, update, counts } = useWatchlist();

    const bands = group(items);

    const onAnalyse = (item, verdict) => update(item.id, { state: 'analysed', verdict });
    const onDrop = (item) => (item.state === 'noticed' ? unflag(item.id) : update(item.id, { state: 'dropped' }));
    const onOpen = (item) => navigate(`/heatmap/${toSlug(item.sector)}?over=${item.period}`);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                <div>
                    <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
                        <Bookmark className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                        Shortlist
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Names you flagged off the heatmap, grouped by how long the idea has
                        to play out. Write a line and it stops asking.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {counts.waiting > 0 && (
                        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${counts.stale
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            {counts.waiting} waiting{counts.stale ? ` · ${counts.stale} stale` : ''}
                        </span>
                    )}
                    <button type="button" onClick={reload}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-rose-600 dark:border-gray-700 dark:bg-gray-800 dark:text-rose-400">
                    {error}
                </div>
            )}

            {!error && !bands.length && (
                <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400">
                        {loading ? 'Reading your shortlist…' : 'Nothing flagged yet.'}
                    </p>
                    {!loading && (
                        <button type="button" onClick={() => navigate('/heatmap')}
                            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                            Open the heatmap <ArrowUpRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            )}

            {bands.map((band) => (
                <div key={band.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900/40">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-900 dark:text-white">
                            {band.name}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            {band.periods.map(labelOf).join(' · ')}
                        </span>
                        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                            stale after {band.staleDays} days
                        </span>
                    </div>

                    {band.groups.map((g) => (
                        <div key={`${g.sector}|${g.period}`}>
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-gray-200 px-4 pb-1.5 pt-3 dark:border-gray-700">
                                <button type="button" onClick={() => onOpen(g.items[0])}
                                    className="text-sm font-bold uppercase tracking-wide text-gray-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400">
                                    {g.sector}
                                </button>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    over {labelOf(g.period).toLowerCase()} · flagged {ago(g.days)}
                                </span>
                            </div>
                            {g.items.map((item) => (
                                <Row key={item.id} item={item}
                                    onAnalyse={onAnalyse} onDrop={onDrop} onOpen={onOpen} />
                            ))}
                        </div>
                    ))}
                </div>
            ))}

            {bands.length > 0 && (
                <p className="px-1 text-xs text-gray-400 dark:text-gray-500">
                    A flag goes stale when it outlives its horizon, not when it gets old —
                    five days is late on a weekly idea and nothing on a yearly one.
                    Writing a verdict stops the clock.
                </p>
            )}
        </div>
    );
}
