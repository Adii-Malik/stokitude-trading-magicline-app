import { useState, useEffect, useCallback } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { getEntries, getStats, getOptions, deleteEntry } from '../../services/journal';
import JournalHeadline from './JournalHeadline';
import JournalStats from './JournalStats';
import JournalList from './JournalList';
import JournalEntryModal from './JournalEntryModal';
import RiskCalculator from './RiskCalculator';

const TABS = [
    { key: 'trades', label: 'Trades' },
    { key: 'performance', label: 'Performance' },
    { key: 'risk', label: 'Size a trade' }
];

const STATUS_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' }
];

export default function JournalPage() {
    const [entries, setEntries] = useState([]);
    const [stats, setStats] = useState(null);
    const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('trades');
    const [status, setStatus] = useState('all');
    const [editing, setEditing] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const load = useCallback(async () => {
        try {
            const params = status === 'all' ? {} : { status };
            const [list, s] = await Promise.all([getEntries(params), getStats()]);
            setEntries(list);
            setStats(s);
        } catch {
            toast.error('Failed to load journal');
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { getOptions().then(setOptions).catch(() => setOptions(null)); }, []);

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

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-cyan-500" />
                    Journal
                </h1>
                <button onClick={() => { setEditing(null); setShowModal(true); }}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 flex items-center gap-2 shrink-0">
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Journal a trade</span>
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                </div>
            ) : (
                <>
                    <JournalHeadline stats={stats} />

                    <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                        {TABS.map((t) => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.key
                                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === 'trades' && (
                        <>
                            <div className="flex gap-2">
                                {STATUS_FILTERS.map((f) => (
                                    <button key={f.key} onClick={() => setStatus(f.key)}
                                        className={`px-3 py-1 rounded-lg text-sm ${status === f.key
                                            ? 'bg-cyan-500 text-white'
                                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <JournalList entries={entries}
                                onEdit={(e) => { setEditing(e); setShowModal(true); }}
                                onDelete={remove} />
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
