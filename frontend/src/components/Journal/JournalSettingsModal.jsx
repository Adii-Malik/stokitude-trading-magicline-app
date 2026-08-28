import { useState, useEffect } from 'react';
import { X, Plus, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import { FIELD, choice } from '../../ui/field';
import { PRESETS, nearestPreset } from './presets';
import { saveSettings, getRiskProfiles, saveRiskProfile } from '../../services/journal';
import { formatCurrency, getPnLColorClass } from '../../utils/portfolioUtils';

/**
 * The few answers that are the same on every trade.
 *
 * Deliberately small. A setting earns its place only when leaving it out means
 * asking the same question over and over — everything else belongs on the form
 * where it is used, or is worked out from the data.
 */
export default function JournalSettingsModal({ settings, portfolios = [], byTracker = [], bySetup = [], onClose, onSaved }) {
    // One book per market. A single default could only ever be right for one of
    // them, and was silently wrong for the other.
    const [books, setBooks] = useState(() => ({ ...(settings?.defaultBooks || {}) }));
    const [ask, setAsk] = useState(Boolean(settings?.askForBook));
    const [setups, setSetups] = useState(settings?.setups || []);
    const [trackers, setTrackers] = useState(settings?.trackers || []);
    const [saving, setSaving] = useState(false);

    // Grouped by what a book is exclusive to. PSX first, because that is what
    // this app is built around.
    const byMarket = portfolios.reduce((acc, p) => {
        const c = (p.currency || 'PKR').toUpperCase();
        (acc[c] = acc[c] || []).push(p);
        return acc;
    }, {});
    const markets = Object.keys(byMarket).sort((a, b) =>
        a === 'PKR' ? -1 : b === 'PKR' ? 1 : a.localeCompare(b));

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

    // Which book's rule is open for editing, if any. One at a time: two numbers
    // and three presets is a panel, not a table cell.
    const [editingBook, setEditingBook] = useState(null);

    const setRule = (id, patch) =>
        setRules((r) => ({ ...r, [id]: { ...(r[id] || {}), ...patch } }));

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
                saveSettings({ defaultBooks: books, askForBook: ask, setups, trackers }),
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
        <Modal title="Journal settings" onClose={onClose} size="xl"
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
            <div className="flex flex-col md:flex-row gap-x-8 gap-y-6">
                <div className="flex-1 min-w-0 flex flex-col gap-6">

                <Section title="Default book, per market"
                    hint="Which book a new trade logs against, one per market.">
                    <div className="flex flex-col gap-3">
                        {markets.map((m) => (
                            <label key={m} className="grid grid-cols-[52px_1fr] items-center gap-3">
                                <span className="text-sm font-bold text-ink-faint tabular-nums">{m}</span>
                                <select value={books[m] || ''} disabled={ask} className={FIELD}
                                    onChange={(e) => setBooks({ ...books, [m]: e.target.value })}>
                                    <option value="">Whichever I used last</option>
                                    {byMarket[m].map((p) => (
                                        <option key={p._id} value={p._id}>{p.name}</option>
                                    ))}
                                </select>
                            </label>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-ink-muted mt-1 cursor-pointer">
                        <input type="checkbox" checked={ask} onChange={(e) => setAsk(e.target.checked)}
                            className="w-4 h-4 accent-cyan-500" />
                        Ask me each time instead
                    </label>
                </Section>

                {/* One list per moment: what you were doing going in, what you
                    did coming out. Both are named here and tapped on the form,
                    which is what stops a name drifting into two spellings — the
                    book already carries a "reteset" beside a "pullback". */}
                <NamedList title="Setups you trade" items={setups} onChange={setSetups}
                    stats={bySetup} placeholder="name a setup you take"
                    hint="Tapped when you log a trade. Empty the list and the form stops asking." />

                <Section title="Risk rules, per book"
                    hint="Each book is judged by its own rule. Leave one alone and it is not judged.">
                    {rules === null ? (
                        <p className="text-sm text-ink-faint py-2">Loading…</p>
                    ) : portfolios.length === 0 ? (
                        <p className="text-sm text-ink-faint py-2">No books yet.</p>
                    ) : editingBook ? (
                        <RuleEditor
                            book={portfolios.find((p) => String(p._id) === editingBook)}
                            rule={rules[editingBook] || {}}
                            onChange={(patch) => setRule(editingBook, patch)}
                            onDone={() => setEditingBook(null)} />
                    ) : (
                        <div className="flex flex-col gap-3">
                            {markets.map((m) => (
                                <div key={m}>
                                    <div className="text-xs font-bold text-ink-faint tabular-nums mb-1">{m}</div>
                                    <div className="divide-y divide-hairline/70">
                                        {byMarket[m].map((p) => {
                                            const id = String(p._id);
                                            const r = rules[id];
                                            const set = r?.defaultRiskPct && r?.maxPositionPct;
                                            return (
                                                <div key={id} className="flex items-center gap-3 py-2.5">
                                                    <span className={`text-sm font-semibold truncate ${set ? 'text-ink' : 'text-ink-faint'}`}>
                                                        {p.name}
                                                    </span>
                                                    <span className="ml-auto text-sm text-ink-faint tabular-nums whitespace-nowrap">
                                                        {set ? `${r.defaultRiskPct}% risk · ${r.maxPositionPct}% max` : 'not judged'}
                                                    </span>
                                                    <button onClick={() => setEditingBook(id)}
                                                        className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:underline shrink-0">
                                                        {set ? 'Edit' : 'Set'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-6">
                <NamedList title="Things you're tracking" items={trackers} onChange={setTrackers}
                    stats={byTracker} placeholder="name it in your own words"
                    hint="Tapped when you close one." />


                </div>
            </div>
        </Modal>
    );
}

/**
 * One book's rule, in the shape the size calculator used to carry.
 *
 * It lives here now rather than there because it is configuration, not
 * arithmetic — and having it in both places meant two ways to change one stored
 * value. The calculator reads what this writes.
 */
function RuleEditor({ book, rule, onChange, onDone }) {
    const active = nearestPreset(rule.defaultRiskPct, rule.maxPositionPct);

    return (
        <div className="flex flex-col gap-3">
            <button onClick={onDone}
                className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600 dark:text-cyan-400 self-start">
                <ArrowLeft className="w-4 h-4" /> All books
            </button>
            <p className="text-sm font-semibold text-ink">{book?.name}</p>

            <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((preset) => (
                    <button key={preset.name} type="button"
                        aria-pressed={active?.name === preset.name}
                        onClick={() => onChange({
                            defaultRiskPct: String(preset.risk), maxPositionPct: String(preset.cap)
                        })}
                        className={choice(active?.name === preset.name)}>
                        {preset.name}
                        <span className={`block text-xs ${active?.name === preset.name ? 'text-cyan-50' : 'text-ink-faint'}`}>
                            {preset.risk}% · {preset.cap}%
                        </span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink-muted">Risk per trade (%)</span>
                    <input type="number" step="any" min="0" max="100" className={`${FIELD} tabular-nums`}
                        value={rule.defaultRiskPct || ''} placeholder="2"
                        onChange={(e) => onChange({ defaultRiskPct: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink-muted">Max per stock (%)</span>
                    <input type="number" step="any" min="0" max="100" className={`${FIELD} tabular-nums`}
                        value={rule.maxPositionPct || ''} placeholder="20"
                        onChange={(e) => onChange({ maxPositionPct: e.target.value })} />
                </label>
            </div>

            <p className="text-sm text-ink-faint">
                <strong className="text-ink-muted">Risk per trade</strong> is what you lose if the stop
                hits. <strong className="text-ink-muted">Max per stock</strong> caps how much of the book
                one name can become whatever the stop says — it is what protects you when price gaps
                straight past the stop instead of filling at it.
            </p>
        </div>
    );
}

/**
 * A list the user authors, with what each name has been worth beside it.
 *
 * The count and the money come from closed trades, so a name shows what keeping
 * it has bought before you decide whether to keep it — a setup you have taken
 * four times for a loss is worth seeing next to the delete button.
 */
function NamedList({ title, hint, items, onChange, stats = [], placeholder }) {
    const [draft, setDraft] = useState('');
    const statOf = (name) => stats.find((t) => t.name === name);

    const add = () => {
        const name = draft.trim();
        if (!name) return;
        if (items.some((t) => t.toLowerCase() === name.toLowerCase())) {
            toast.error('That is already on the list');
            return;
        }
        onChange([...items, name]);
        setDraft('');
    };

    return (
        <Section title={title} hint={hint}>
            {items.length === 0 ? (
                <p className="text-sm text-ink-faint border border-dashed border-hairline rounded-control px-3 py-4 text-center">
                    Nothing yet — and that is fine. Name one when you notice you need it.
                </p>
            ) : (
                <div className="divide-y divide-hairline/70">
                    {items.map((name) => {
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
                                <button onClick={() => onChange(items.filter((t) => t !== name))}
                                    aria-label={`Remove ${name}`}
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
                    maxLength={40} placeholder={placeholder} className={FIELD} />
                <button onClick={add}
                    className="px-3 py-2 text-sm border border-hairline rounded-control text-ink-muted
                        hover:bg-surface-muted flex items-center gap-1 shrink-0">
                    <Plus className="w-4 h-4" /> Add
                </button>
            </div>
        </Section>
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
