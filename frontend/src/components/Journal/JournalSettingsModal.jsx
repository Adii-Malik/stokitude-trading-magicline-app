import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import { FIELD } from '../../ui/field';
import { saveSettings, getRiskProfiles, saveRiskProfile } from '../../services/journal';
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

    // The rule each book is judged by, keyed on portfolio. Loaded rather than
    // read off `options.portfolios`, which carries only what the trade form's
    // pickers need — a book with rules set was showing "no rules set" here
    // because the field was never on that payload in the first place.
    const [rules, setRules] = useState(null);
    const [savedRules, setSavedRules] = useState({});
    useEffect(() => {
        getRiskProfiles()
            .then((list) => {
                const map = Object.fromEntries(list.map((r) => [String(r.portfolioId), {
                    defaultRiskPct: String(r.defaultRiskPct), maxPositionPct: String(r.maxPositionPct)
                }]));
                setRules(map);
                setSavedRules(map);
            })
            .catch(() => setRules({}));
    }, []);

    const setRule = (id, key, value) =>
        setRules((r) => ({ ...r, [id]: { ...(r[id] || {}), [key]: value } }));

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

    /**
     * Saves the settings and any rule that changed, in one action.
     *
     * A rule only goes up when both halves are filled: half a rule would be
     * stored with the model's default standing in for the other, which reads as
     * a decision the user never made.
     */
    const submit = async () => {
        const changed = Object.entries(rules || {}).filter(([id, r]) => {
            if (!r.defaultRiskPct || !r.maxPositionPct) return false;
            const was = savedRules[id];
            return !was || was.defaultRiskPct !== r.defaultRiskPct
                || was.maxPositionPct !== r.maxPositionPct;
        });

        setSaving(true);
        try {
            const [saved] = await Promise.all([
                saveSettings({ defaultPortfolioId: book || null, askForBook: ask, trackers }),
                ...changed.map(([id, r]) => saveRiskProfile(id, {
                    defaultRiskPct: Number(r.defaultRiskPct),
                    maxPositionPct: Number(r.maxPositionPct)
                }))
            ]);
            toast.success(changed.length
                ? `Settings saved, and ${changed.length} rule${changed.length > 1 ? 's' : ''} updated`
                : 'Settings saved');
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
                    hint="A trade follows the rules of the book it is logged against, so one book being aggressive has nothing to do with another. Leave a book blank and it is simply not judged.">
                    {rules === null ? (
                        <p className="text-sm text-ink-faint py-2">Loading…</p>
                    ) : portfolios.length === 0 ? (
                        <p className="text-sm text-ink-faint py-2">No books yet.</p>
                    ) : (
                        <div className="divide-y divide-hairline/70">
                            <div className="grid grid-cols-[1fr_92px_92px] gap-3 pb-2 text-xs
                                font-bold uppercase tracking-wider text-ink-faint">
                                <span>Book</span>
                                <span className="text-right">Risk %</span>
                                <span className="text-right">Max %</span>
                            </div>
                            {portfolios.map((p) => {
                                const r = rules[String(p._id)] || {};
                                const partial = Boolean(r.defaultRiskPct) !== Boolean(r.maxPositionPct);
                                return (
                                    <div key={p._id} className="grid grid-cols-[1fr_92px_92px] gap-3 py-2.5 items-center">
                                        <span className="text-sm font-semibold text-ink truncate">
                                            {p.name}
                                            {partial && (
                                                <span className="block text-xs font-normal text-amber-600 dark:text-amber-400">
                                                    needs both to count
                                                </span>
                                            )}
                                        </span>
                                        <RuleInput value={r.defaultRiskPct} placeholder="1"
                                            onChange={(v) => setRule(String(p._id), 'defaultRiskPct', v)} />
                                        <RuleInput value={r.maxPositionPct} placeholder="25"
                                            onChange={(v) => setRule(String(p._id), 'maxPositionPct', v)} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Section>

            </div>
        </Modal>
    );
}

/** A percentage. Blank is meaningful — it means this book has no rule. */
function RuleInput({ value, placeholder, onChange }) {
    return (
        <input type="number" step="any" min="0" max="100"
            value={value || ''} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`${FIELD} text-right tabular-nums px-2.5`} />
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
