import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import { FIELD } from '../../ui/field';
import { saveSettings } from '../../services/journal';
import { formatCurrency, getPnLColorClass } from '../../utils/portfolioUtils';

/**
 * The few answers that are the same on every trade.
 *
 * Deliberately small. A setting earns its place only when leaving it out means
 * asking the same question over and over — everything else belongs on the form
 * where it is used, or is worked out from the data.
 */
export default function JournalSettingsModal({ settings, portfolios = [], byTracker = [], onClose, onSaved }) {
    const [book, setBook] = useState(settings?.defaultPortfolioId || '');
    const [ask, setAsk] = useState(Boolean(settings?.askForBook));
    const [trackers, setTrackers] = useState(settings?.trackers || []);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);

    // Counts come from closed trades, so a tracker shows what keeping it has been
    // worth before you decide whether to keep it.
    const statOf = (name) => byTracker.find((t) => t.name === name);

    const add = () => {
        const name = draft.trim();
        if (!name) return;
        if (trackers.some((t) => t.toLowerCase() === name.toLowerCase())) {
            toast.error('You are already tracking that');
            return;
        }
        setTrackers([...trackers, name]);
        setDraft('');
    };

    const submit = async () => {
        setSaving(true);
        try {
            const saved = await saveSettings({
                defaultPortfolioId: book || null,
                askForBook: ask,
                trackers
            });
            toast.success('Settings saved');
            onSaved(saved);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title="Journal settings" onClose={onClose} size="md"
            footer={
                <>
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm border border-hairline rounded-control text-ink-muted hover:bg-surface-muted">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={saving}
                        className="px-4 py-2 text-sm bg-cyan-500 text-white rounded-control hover:bg-cyan-600 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </>
            }>
            <div className="flex flex-col gap-6">

                <Section title="Default book"
                    hint="Which book a new trade logs against. Its risk rules are the ones the size calculator uses, so this is more than a convenience — the wrong book sizes the trade against the wrong capital.">
                    <select value={book} onChange={(e) => setBook(e.target.value)} disabled={ask}
                        className={FIELD}>
                        <option value="">Whichever I used last</option>
                        {portfolios.map((p) => (
                            <option key={p._id} value={p._id}>{p.name} ({p.currency})</option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-ink-muted mt-2 cursor-pointer">
                        <input type="checkbox" checked={ask} onChange={(e) => setAsk(e.target.checked)}
                            className="w-4 h-4 accent-cyan-500" />
                        Ask me each time instead
                    </label>
                </Section>

                <Section title="Things you're tracking"
                    hint="Named here, then tapped when you close a trade — never retyped, so two spellings of one habit can never split into two rows. Delete them all and the close form stops asking.">
                    {trackers.length === 0 ? (
                        <p className="text-sm text-ink-faint border border-dashed border-hairline rounded-control px-3 py-4 text-center">
                            Nothing yet — and that is fine. When you catch yourself doing the same
                            thing twice, name it here.
                        </p>
                    ) : (
                        <div className="divide-y divide-hairline/70">
                            {trackers.map((name) => {
                                const stat = statOf(name);
                                return (
                                    <div key={name} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2 text-sm">
                                        <span className="text-ink truncate">{name}</span>
                                        <span className="text-xs text-ink-faint tabular-nums">
                                            {stat ? `${stat.count} trade${stat.count > 1 ? 's' : ''}` : 'never'}
                                        </span>
                                        <span className={`text-sm font-bold tabular-nums text-right w-24 ${stat ? getPnLColorClass(stat.netPnL) : 'text-ink-faint'}`}>
                                            {stat ? formatCurrency(stat.netPnL, stat.currency, { signed: true }) : '—'}
                                        </span>
                                        <button onClick={() => setTrackers(trackers.filter((t) => t !== name))}
                                            aria-label={`Stop tracking ${name}`}
                                            className="p-1 text-ink-faint hover:text-red-600 rounded-control">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="flex gap-2 mt-2">
                        <input value={draft} onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                            maxLength={40} placeholder="name it in your own words…"
                            className={FIELD} />
                        <button onClick={add}
                            className="px-3 py-2 text-sm border border-hairline rounded-control text-ink-muted
                                hover:bg-surface-muted flex items-center gap-1 shrink-0">
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                </Section>

                <Section title="Risk rules, per book"
                    hint="A trade follows the rules of the book it is logged against. One book being aggressive has nothing to do with another. Set them from the size calculator on the trade form.">
                    <div className="divide-y divide-hairline/70">
                        {portfolios.map((p) => (
                            <div key={p._id} className="flex items-center gap-3 py-2 text-sm">
                                <span className="font-semibold text-ink truncate">{p.name}</span>
                                <span className="ml-auto text-xs text-ink-faint tabular-nums whitespace-nowrap">
                                    {p.risk
                                        ? `${p.risk.defaultRiskPct}% risk · ${p.risk.maxPositionPct}% max per stock`
                                        : 'no rules set'}
                                </span>
                            </div>
                        ))}
                    </div>
                </Section>

            </div>
        </Modal>
    );
}

function Section({ title, hint, children }) {
    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint">{title}</h3>
            {hint && <p className="text-sm text-ink-faint -mt-1 max-w-[58ch]">{hint}</p>}
            {children}
        </div>
    );
}
