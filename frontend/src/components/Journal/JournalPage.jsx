import { useState, useEffect, useCallback } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { getEntries, getStats, getOptions, deleteEntry } from '../../services/journal';
import JournalStats from './JournalStats';
import JournalList from './JournalList';
import JournalEntryModal from './JournalEntryModal';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' }
];

export default function JournalPage() {
    const [entries, setEntries] = useState([]);
    const [stats, setStats] = useState(null);
    const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [editing, setEditing] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const load = useCallback(async () => {
        try {
            const params = filter === 'all' ? {} : { status: filter };
            const [list, s] = await Promise.all([getEntries(params), getStats()]);
            setEntries(list);
            setStats(s);
        } catch {
            toast.error('Failed to load journal');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { getOptions().then(setOptions).catch(() => setOptions(null)); }, []);

    const openNew = () => { setEditing(null); setShowModal(true); };
    const openEdit = (entry) => { setEditing(entry); setShowModal(true); };

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
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-cyan-500" />
                        Trading Journal
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        What you decided, separate from how it turned out.
                    </p>
                </div>
                <button onClick={openNew}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Journal a trade
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                </div>
            ) : (
                <>
                    <JournalStats stats={stats} />

                    <div className="flex gap-2">
                        {FILTERS.map((f) => (
                            <button key={f.key} onClick={() => setFilter(f.key)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f.key
                                    ? 'bg-cyan-500 text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <JournalList entries={entries} onEdit={openEdit} onDelete={remove} />
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
