import { useState, useEffect, useCallback } from 'react';
import { Plus, BookOpen, Search, XCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { getEntries, getStats, getOptions, deleteEntry, updateEntry } from '../../services/journal';
import JournalHeadline from './JournalHeadline';
import JournalStats from './JournalStats';
import JournalList from './JournalList';
import JournalEntryModal from './JournalEntryModal';
import RiskCalculator from './RiskCalculator';
import { mistakeLabel } from './labels';

const TABS = [
    { key: 'trades', label: 'Trades' },
    { key: 'performance', label: 'Performance' },
    { key: 'risk', label: 'Size a trade' }
];

// Open trades are the ones you can still act on, so they lead. Planned sits
// beside them because a level about to print needs a decision just as much.
const STATUS_FILTERS = [
    { key: 'open', label: 'Open' },
    { key: 'planned', label: 'Watching' },
    { key: 'closed', label: 'Closed' },
    { key: 'cancelled', label: 'Never triggered' },
    { key: 'all', label: 'All' }
];

const SORTS = [
    { key: 'recent', label: 'Newest first' },
    { key: 'oldest', label: 'Oldest first' },
    { key: 'worst', label: 'Biggest losses' },
    { key: 'best', label: 'Biggest wins' },
    { key: 'symbol', label: 'Symbol A–Z' }
];

const PAGE = 25;

export default function JournalPage() {
    const [entries, setEntries] = useState([]);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState(null);
    const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('trades');

    const [status, setStatus] = useState('open');
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('recent');
    const [mistake, setMistake] = useState('');
    const [limit, setLimit] = useState(PAGE);

    const [editing, setEditing] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Debounce typing so each keystroke isn't a request.
    useEffect(() => {
        const t = setTimeout(() => { setQuery(search); setLimit(PAGE); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        try {
            const params = { limit, sort };
            if (status !== 'all') params.status = status;
            if (query) params.q = query;
            if (mistake) params.mistake = mistake;

            const [page, s] = await Promise.all([getEntries(params), getStats()]);
            setEntries(page.entries);
            setTotal(page.total);
            setStats(s);
        } catch {
            toast.error('Failed to load journal');
        } finally {
            setLoading(false);
        }
    }, [status, query, sort, mistake, limit]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { getOptions().then(setOptions).catch(() => setOptions(null)); }, []);

    const reset = (fn) => { fn(); setLimit(PAGE); };

    // Promoting a plan to a position. Prefilled from the zone it was waiting for,
    // but left editable: a fill is rarely exactly the level you drew.
    const take = (entry) => {
        const bounds = [entry.entryFrom, entry.entryTo].filter((n) => n != null);
        setEditing({
            ...entry,
            state: 'open',
            entryPrice: bounds.length ? bounds.reduce((a, b) => a + b, 0) / bounds.length : '',
            entryDate: new Date().toISOString()
        });
        setShowModal(true);
    };

    // Closing is an action, not a mode to discover. The form then asks for the
    // exit and the review, which are the only things it does not already know.
    const close = (entry) => {
        setEditing({ ...entry, state: 'closed', exitDate: new Date().toISOString() });
        setShowModal(true);
    };

    // A level that never triggered is kept, not deleted. How often your setups
    // fail to trigger is only answerable if the record survives.
    const cancel = async (entry) => {
        try {
            await updateEntry(entry._id, { state: 'cancelled' });
            toast.success('Marked as never triggered');
            load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update entry');
        }
    };

    const remove = async (entry) => {
        if (!window.confirm(`Delete the ${entry.symbol} entry? This cannot be undone.`)) return;
        try {
            await deleteEntry(entry._id);
            toast.success('Entry deleted');
            load();
        } catch {
            toast.error('Failed to delete entry');
        }
    };

    // "Open by default" is the resting state, so returning to it counts as clear.
    const dirty = Boolean(search || mistake || sort !== 'recent' || status !== 'open');
    const clearFilters = () => {
        setSearch('');
        setQuery('');
        setMistake('');
        setSort('recent');
        setStatus('open');
        setLimit(PAGE);
    };
    const filtered = Boolean(query || mistake);

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-cyan-500" />
                    Journal
                </h1>
                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setEditing({ state: 'planned' }); setShowModal(true); }}
                        className="px-4 py-2 border border-hairline text-ink-muted rounded-control hover:bg-surface-muted flex items-center gap-2">
                        <Eye className="w-4 h-4" /> <span className="hidden sm:inline">Watch a level</span>
                    </button>
                    <button onClick={() => { setEditing(null); setShowModal(true); }}
                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Journal a trade</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                </div>
            ) : (
                <>
                    <JournalHeadline stats={stats} />

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
                        <>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search symbol, notes or lesson…"
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-hairline bg-surface text-ink rounded-control focus:ring-2 focus:ring-cyan-500" />
                                </div>
                                <select value={sort} onChange={(e) => reset(() => setSort(e.target.value))}
                                    className="px-3 py-2 text-sm border border-hairline bg-surface text-ink rounded-control">
                                    {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </select>
                                <select value={mistake} onChange={(e) => reset(() => setMistake(e.target.value))}
                                    className="px-3 py-2 text-sm border border-hairline bg-surface text-ink rounded-control">
                                    <option value="">Any mistake</option>
                                    {(options?.mistakes || []).map((m) => (
                                        <option key={m} value={m}>{mistakeLabel(m)}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex gap-2">
                                    {STATUS_FILTERS.map((f) => (
                                        <button key={f.key} onClick={() => reset(() => setStatus(f.key))}
                                            className={`px-3 py-1 rounded-lg text-sm ${status === f.key
                                                ? 'bg-cyan-500 text-white'
                                                : 'text-ink-muted hover:bg-surface-muted'}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    {dirty && (
                                        <button onClick={clearFilters}
                                            className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline">
                                            <XCircle className="w-3.5 h-3.5" /> Clear filters
                                        </button>
                                    )}
                                    {total > 0 && (
                                        <span className="text-xs text-ink-faint">
                                            Showing {entries.length} of {total}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <JournalList entries={entries}
                                emptyHint={filtered ? 'Nothing matches those filters.'
                                    : status === 'open' ? 'No open trades. Switch to Closed or All to see your history.'
                                        : status === 'planned' ? 'No levels being watched. Add one and you\'ll be told when price reaches it.'
                                            : status === 'cancelled' ? 'No abandoned levels yet.'
                                                : undefined}
                                onEdit={(e) => { setEditing(e); setShowModal(true); }}
                                onTake={take}
                                onClose={close}
                                onCancel={cancel}
                                onDelete={remove} />

                            {entries.length < total && (
                                <button onClick={() => setLimit(limit + PAGE)}
                                    className="w-full py-2 text-sm border border-hairline rounded-control text-ink-muted hover:bg-surface-muted">
                                    Load {Math.min(PAGE, total - entries.length)} more
                                </button>
                            )}
                        </>
                    )}

                    {tab === 'performance' && <JournalStats stats={stats} />}

                    {tab === 'risk' && <RiskCalculator options={options} />}
                </>
            )}

            {showModal && (
                <JournalEntryModal
                    entry={editing}
                    options={options}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); load(); }}
                />
            )}
        </div>
    );
}
