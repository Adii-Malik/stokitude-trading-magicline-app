import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, BookOpen, Search, Settings, Flag, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getEntries, getStats, getOptions, getSettings, deleteEntry
} from '../../services/journal';
import { formatCurrency, formatPercent, getPnLColorClass } from '../../utils/portfolioUtils';
import JournalList, { needsYou } from './JournalList';
import JournalPane from './JournalPane';
import JournalStats from './JournalStats';
import JournalEntryModal from './JournalEntryModal';
import JournalSettingsModal from './JournalSettingsModal';
import RiskCalculator from './RiskCalculator';

const TABS = [
    { key: 'trades', label: 'Trades' },
    { key: 'performance', label: 'Performance' },
    { key: 'risk', label: 'Size a trade' }
];

const STATUS = [
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' },
    { key: 'all', label: 'All' }
];

export default function JournalPage() {
    const [entries, setEntries] = useState([]);
    const [stats, setStats] = useState(null);
    const [options, setOptions] = useState(null);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('trades');

    const [status, setStatus] = useState('open');
    const [flagged, setFlagged] = useState(false);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [currency, setCurrency] = useState(null);

    const [selectedId, setSelectedId] = useState(null);
    const [editing, setEditing] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Debounce typing so each keystroke isn't a request.
    useEffect(() => {
        const t = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        try {
            const params = { limit: 200, sort: 'recent' };
            if (query) params.q = query;
            const [page, s] = await Promise.all([getEntries(params), getStats()]);
            setEntries(page.entries);
            setStats(s);
        } catch {
            toast.error('Failed to load journal');
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        getOptions().then(setOptions).catch(() => setOptions(null));
        getSettings().then(setSettings).catch(() => setSettings(null));
    }, []);

    // Which currency's figures the tiles are showing. PKR and USD never sum, so
    // one is always chosen; default to the book with the most closed trades.
    const books = stats?.byCurrency || [];
    const shown = books.find((b) => b.currency === currency) || books[0] || null;
    useEffect(() => {
        if (!currency && books.length) setCurrency(books[0].currency);
    }, [books, currency]);

    const flaggedCount = useMemo(() => entries.filter(needsYou).length, [entries]);

    const visible = useMemo(() => {
        let list = entries;
        if (flagged) list = list.filter(needsYou);
        else if (status !== 'all') list = list.filter((e) => e.status === status);
        return list;
    }, [entries, status, flagged]);

    // Open on whatever most wants a decision, then on the newest thing. Never on
    // an empty pane when there is something to show.
    useEffect(() => {
        if (!visible.length) { setSelectedId(null); return; }
        if (visible.some((e) => e._id === selectedId)) return;
        setSelectedId((visible.find(needsYou) || visible[0])._id);
    }, [visible, selectedId]);

    const selected = visible.find((e) => e._id === selectedId) || null;
    const bookOf = (id) => options?.portfolios?.find((p) => String(p._id) === String(id))?.name;

    const close = (entry) => {
        setEditing({ ...entry, state: 'closed', exitDate: new Date().toISOString() });
        setShowModal(true);
    };

    const remove = async (entry) => {
        if (!window.confirm(`Delete the ${entry.symbol} entry? This cannot be undone.`)) return;
        try {
            await deleteEntry(entry._id);
            toast.success('Entry deleted');
            setSelectedId(null);
            load();
        } catch {
            toast.error('Failed to delete entry');
        }
    };

    const pick = (key) => { setFlagged(false); setStatus(key); };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-cyan-500" />
                    Journal
                </h1>
                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setEditing(null); setShowModal(true); }}
                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Journal a trade</span>
                    </button>
                    <button onClick={() => setShowSettings(true)} title="Journal settings"
                        className="p-2.5 border border-hairline text-ink-faint rounded-control hover:bg-surface-muted hover:text-ink">
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                </div>
            ) : (
                <>
                    <Tiles book={shown} process={stats?.process} books={books}
                        currency={shown?.currency} onCurrency={setCurrency} />

                    <PlanStrip process={stats?.process} />

                    <div className="flex gap-1 border-b border-hairline overflow-x-auto">
                        {TABS.map((t) => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.key
                                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                                    : 'border-transparent text-ink-faint hover:text-ink'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === 'trades' && (
                        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
                            {/* On a phone the pane replaces the list rather than
                                stacking under it: a split view that reflows is two
                                screens pretending to be one. */}
                            <div className={`bg-surface rounded-card ring-1 ring-hairline overflow-hidden
                                ${selected ? 'hidden lg:block' : ''}`}>
                                <div className="flex gap-1.5 p-3 border-b border-hairline flex-wrap">
                                    {flaggedCount > 0 && (
                                        <button onClick={() => { setFlagged(!flagged); }}
                                            className={`px-3 py-1.5 rounded-control text-sm font-semibold inline-flex items-center gap-1.5 ${flagged
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/40'}`}>
                                            <Flag className="w-3.5 h-3.5" /> {flaggedCount}
                                        </button>
                                    )}
                                    {STATUS.map((f) => (
                                        <button key={f.key} onClick={() => pick(f.key)}
                                            className={`px-3 py-1.5 rounded-control text-sm font-semibold ${!flagged && status === f.key
                                                ? 'bg-cyan-500 text-white' : 'text-ink-faint hover:text-ink hover:bg-surface-muted'}`}>
                                            {f.label}
                                            <span className="ml-1.5 text-xs opacity-70 tabular-nums">
                                                {f.key === 'all' ? entries.length : entries.filter((e) => e.status === f.key).length}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                <div className="p-3 border-b border-hairline">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                                        <input value={search} onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search symbol, note or lesson…"
                                            className="w-full pl-9 pr-3 py-2 text-sm border border-hairline bg-surface-muted
                                                text-ink rounded-control focus:ring-2 focus:ring-cyan-500" />
                                    </div>
                                </div>

                                <div className="max-h-[70vh] overflow-y-auto">
                                    <JournalList entries={visible} selectedId={selectedId}
                                        grouped={status === 'all' && !flagged}
                                        onSelect={(e) => setSelectedId(e._id)}
                                        emptyHint={query ? 'Nothing matches that search.'
                                            : flagged ? 'Nothing has reached a level.'
                                                : status === 'open' ? 'No open trades. Switch to Closed or All to see your history.'
                                                    : undefined} />
                                </div>
                            </div>

                            <div className={selected ? '' : 'hidden lg:block'}>
                                {selected && (
                                    <button onClick={() => setSelectedId(null)}
                                        className="lg:hidden mb-2 text-sm text-cyan-600 dark:text-cyan-400 font-semibold inline-flex items-center gap-1">
                                        <ArrowLeft className="w-4 h-4" /> All trades
                                    </button>
                                )}
                                <JournalPane entry={selected} portfolioName={bookOf(selected?.portfolioId)}
                                    onEdit={(e) => { setEditing(e); setShowModal(true); }}
                                    onDelete={remove} onClose={close} />
                            </div>
                        </div>
                    )}

                    {tab === 'performance' && <JournalStats stats={stats} />}

                    {tab === 'risk' && <RiskCalculator options={options} />}
                </>
            )}

            {showModal && (
                <JournalEntryModal
                    entry={editing}
                    options={options}
                    trackers={settings?.trackers || []}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); load(); }}
                />
            )}

            {showSettings && (
                <JournalSettingsModal
                    settings={settings}
                    portfolios={options?.portfolios || []}
                    byTracker={shown?.byTracker?.map((t) => ({ ...t, currency: shown.currency })) || []}
                    onClose={() => setShowSettings(false)}
                    onSaved={(saved) => {
                        setSettings(saved);
                        setShowSettings(false);
                        getOptions().then(setOptions).catch(() => { });
                        // "Size inside your book's rule" is measured against the
                        // rules just edited, so the strip is wrong until refetched.
                        load();
                    }}
                />
            )}
        </div>
    );
}

/**
 * Four numbers about the result.
 *
 * Win rate sits inside expectancy's caption rather than on a tile of its own:
 * alone it is the most misleading figure in trading — you can win seven in ten
 * and lose money — and it only means something read beside the payoff ratio.
 */
function Tiles({ book, process, books, currency, onCurrency }) {
    if (!book) return null;
    const payoff = book.payoffRatio != null ? `${book.payoffRatio.toFixed(1)}:1` : null;

    return (
        <div className="flex items-stretch gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 min-w-0">
                <Tile k={`Net P/L · ${book.currency}`}
                    v={formatCurrency(book.netPnL, book.currency, { signed: true })}
                    color={getPnLColorClass(book.netPnL)}
                    s={`${book.closedTrades} closed${book.bestTrade ? ` · best ${formatCurrency(book.bestTrade, book.currency, { signed: true })}` : ''}`} />
                <Tile k="Expectancy"
                    v={formatCurrency(book.expectancy, book.currency, { signed: true })}
                    color={getPnLColorClass(book.expectancy)}
                    s={`per trade · ${formatPercent(book.winRate, 0)} win${payoff ? ` · ${payoff}` : ''}`} />
                <Tile k="Average R"
                    v={book.avgR != null ? `${book.avgR >= 0 ? '+' : ''}${book.avgR.toFixed(2)}R` : '—'}
                    color={book.avgR != null ? getPnLColorClass(book.avgR) : ''}
                    s={`${book.tradesWithR} of ${book.closedTrades} had a stop`} />
                {/* The only figure here about the present rather than the past,
                    and the only one that can stop you doing something today. */}
                <Tile k="At risk right now"
                    v={book.openRisk ? formatCurrency(book.openRisk, book.currency) : '—'}
                    color={book.openRisk ? 'text-amber-600 dark:text-amber-400' : ''}
                    s={`${book.openTrades} open${book.openWithoutStop ? ` · ${book.openWithoutStop} with no stop` : ''}`} />
            </div>
            {books.length > 1 && (
                <div className="flex flex-col gap-1 bg-surface ring-1 ring-hairline rounded-card p-1.5 justify-center shrink-0">
                    {books.map((b) => (
                        <button key={b.currency} onClick={() => onCurrency(b.currency)}
                            className={`px-3 py-2 rounded-control text-sm font-semibold ${b.currency === currency
                                ? 'bg-cyan-500 text-white' : 'text-ink-faint hover:text-ink'}`}>
                            {b.currency}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function Tile({ k, v, s, color }) {
    return (
        <div className="bg-surface rounded-card ring-1 ring-hairline p-5 min-w-0">
            <div className="text-sm font-medium text-ink-faint">{k}</div>
            <div className={`text-2xl font-bold tracking-tight tabular-nums mt-1 ${color || 'text-ink'}`}>{v}</div>
            <div className="text-xs text-ink-faint tabular-nums truncate mt-0.5">{s}</div>
        </div>
    );
}

/**
 * The plan you wrote, against what you did.
 *
 * Three checks, every one read off the entry — no typed word enters any of them,
 * so no wording can split a row in two. A scorecard rather than a ranking of
 * mistakes, because a rate is something you can move with the next trade, and
 * because it can also say you did the right thing.
 */
function PlanStrip({ process }) {
    if (!process) return null;
    const rows = [
        ['Stop set before you entered', process.stopSet],
        ['Stop honoured once it was set', process.stopHonoured],
        ["Size inside your book's rule", process.sizeInRule]
    ].filter(([, v]) => v?.of > 0);

    if (!rows.length) return null;

    return (
        <div className="bg-surface rounded-card ring-1 ring-hairline p-5 flex flex-col gap-3">
            <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-semibold text-ink">The plan, and what you did</span>
                <span className="text-xs text-ink-faint tabular-nums">
                    {process.closedTrades} closed
                </span>
            </div>
            {rows.map(([label, v]) => {
                const rate = (v.n / v.of) * 100;
                const tone = rate >= 80 ? 'good' : rate >= 50 ? 'warn' : 'bad';
                const bar = { good: 'bg-green-500', warn: 'bg-amber-500', bad: 'bg-red-500' }[tone];
                const text = { good: 'text-green-600 dark:text-green-400', warn: 'text-amber-600 dark:text-amber-400', bad: 'text-red-600 dark:text-red-400' }[tone];
                return (
                    <div key={label} className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_140px_52px_64px] gap-3 items-center text-sm">
                        <span className="text-ink-muted truncate">{label}</span>
                        <span className="hidden sm:block h-2 rounded-full bg-surface-muted overflow-hidden">
                            <span className={`block h-full rounded-full ${bar}`} style={{ width: `${rate}%` }} />
                        </span>
                        <span className={`text-right font-bold tabular-nums ${text}`}>{Math.round(rate)}%</span>
                        <span className="text-right text-xs text-ink-faint tabular-nums">{v.n} of {v.of}</span>
                    </div>
                );
            })}
        </div>
    );
}
