import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Lock, ChevronRight, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import { SymbolInput } from '../../ui/SymbolInput';
import { TagInput } from '../../ui/TagInput';
import { FIELD } from '../../ui/field';
import { RiskRail } from './RiskRail';
import api from '../../services/api';
import { createEntry, updateEntry } from '../../services/journal';
import { chargesFor } from '../../utils/commission';

const dateValue = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function JournalEntryModal({ entry, options, onClose, onSaved }) {
    const editing = Boolean(entry?._id);
    const [form, setForm] = useState({
        state: entry?.state || 'open',
        portfolioId: entry?.portfolioId || '',
        symbol: entry?.symbol || '',
        exchange: entry?.exchange || 'PSX',
        direction: entry?.direction || 'long',
        setupType: entry?.setupType || 'other',
        entryFrom: entry?.entryFrom ?? '',
        entryTo: entry?.entryTo ?? '',
        entryDate: dateValue(entry?.entryDate) || new Date().toISOString().slice(0, 10),
        entryPrice: entry?.entryPrice ?? '',
        quantity: entry?.quantity ?? '',
        exitDate: dateValue(entry?.exitDate),
        exitPrice: entry?.exitPrice ?? '',
        exitConfirmed: entry?.exitConfirmed ?? false,
        fees: entry?.fees ?? '',
        exitFees: entry?.exitFees ?? '',
        plannedStop: entry?.plannedStop ?? '',
        // Copied, not referenced: editing a price must not mutate the loaded
        // entry, and isHit has to survive a save it was not part of.
        targets: (entry?.targets || []).map((t) => ({ ...t })),
        emotionalState: entry?.emotionalState || 'neutral',
        marketCondition: entry?.marketCondition || 'sideways',
        mistakes: entry?.mistakes || [],
        notes: entry?.notes || '',
        lesson: entry?.lesson || ''
    });
    const [saving, setSaving] = useState(false);
    const [showMore, setShowMore] = useState(false);

    /**
     * The form asks only what its stage can answer. Watching a level has no fill,
     * being in a trade has no result, and only a finished trade can be reviewed —
     * so exit prices and "what went wrong" stay out of sight until they mean
     * something. Everything visible at once was the whole problem.
     */
    const planning = form.state === 'planned';
    const closing = form.state === 'closed';
    const live = form.state === 'open';
    // Arrived here from an open trade, so this visit is the act of closing it
    // rather than revisiting one already finished.
    const closingNow = entry?.state === 'open' && closing;

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const bounds = [form.entryFrom, form.entryTo].filter((v) => v !== '').map(Number);
    const entryRef = planning
        ? (bounds.length ? bounds.reduce((a, b) => a + b, 0) / bounds.length : null)
        : (form.entryPrice === '' ? null : Number(form.entryPrice));
    const perShare = entryRef != null && form.plannedStop !== ''
        ? Math.abs(entryRef - Number(form.plannedStop))
        : 0;

    const zoneMissing = planning && bounds.length === 0;

    // Which legs the portfolio ledger already owns. Those numbers are read-only
    // here: the transaction is the record, and two editable copies of one fill is
    // exactly the drift this link exists to remove.
    const entryBooked = Boolean(entry?.entryTransactionId);
    const exitBooked = Boolean(entry?.exitTransactionId);

    // Only portfolios in this trade's currency can hold it. Filtering rather than
    // letting the server reject it keeps the impossible choice off the screen.
    const currency = (options?.exchangeRules || []).find((x) => x.code === form.exchange)?.currency || 'PKR';
    const bookable = (options?.portfolios || []).filter((p) => (p.currency || 'PKR') === currency);
    const portfolio = bookable.find((p) => p._id === form.portfolioId);

    // Commission priced the same way the portfolio's own transaction form prices
    // it, so a journalled fill and a hand-entered one cost the same. Priced per
    // leg, and on the correct side: a long pays the buy rate going in and the sell
    // rate coming out.
    const priceLeg = (price, side) => (portfolio && !planning
        ? chargesFor({
            price, quantity: form.quantity,
            slabs: portfolio.commissionSlabs, charges: portfolio.charges, side
        }).total
        : 0);

    const entrySide = form.direction === 'short' ? 'SELL' : 'BUY';
    const suggestedFee = priceLeg(form.entryPrice, entrySide);
    const suggestedExitFee = closing
        ? priceLeg(form.exitPrice, entrySide === 'BUY' ? 'SELL' : 'BUY')
        : 0;

    // Explicit flags rather than checking for an empty value, which froze the
    // prefill on the first keystroke last time.

    useEffect(() => {
        if (!entryBooked && suggestedFee > 0) {
            setForm((f) => ({ ...f, fees: suggestedFee.toFixed(2) }));
        }
    }, [suggestedFee, entryBooked]);

    useEffect(() => {
        if (!exitBooked && suggestedExitFee > 0) {
            setForm((f) => ({ ...f, exitFees: suggestedExitFee.toFixed(2) }));
        }
    }, [suggestedExitFee, exitBooked]);


    // The verdict is the server's to give: capital comes from the portfolios and
    // the limits from your profile, so neither is this form's to guess at.
    const [riskCtx, setRiskCtx] = useState(null);
    const riskKey = [form.portfolioId, currency, form.entryPrice || form.entryFrom,
        form.plannedStop, form.quantity, form.targets?.[0]?.price, form.direction].join('|');
    useEffect(() => {
        if (!form.portfolioId || !form.plannedStop || !(form.entryPrice || form.entryFrom)) {
            setRiskCtx(null); return;
        }
        let live = true;
        const t = setTimeout(async () => {
            try {
                const res = await api.get('/journal/risk-context', {
                    params: {
                        currency,
                        portfolioId: form.portfolioId || undefined,
                        entryPrice: form.entryPrice || form.entryFrom,
                        stopPrice: form.plannedStop,
                        quantity: form.quantity || undefined,
                        targetPrice: form.targets?.[0]?.price,
                        direction: form.direction
                    }
                });
                if (live) setRiskCtx(res.data.data);
            } catch { if (live) setRiskCtx(null); }
        }, 250);
        return () => { live = false; clearTimeout(t); };
    }, [riskKey]);

    const submit = async (e) => {
        e.preventDefault();
        if (zoneMissing) {
            toast.error('Give the entry zone a level to watch for');
            return;
        }
        // Without a price there is no exit. The model would quietly reopen the
        // trade, which looks like the save silently failed.
        if (closing && form.exitPrice === '') {
            toast.error('Enter the price you exited at');
            return;
        }
        setSaving(true);
        try {
            // null rather than undefined, so clearing a field survives JSON.stringify.
            const num = (v) => (v === '' || v == null ? null : parseFloat(v));
            const payload = {
                ...form,
                // Ungraded is absent, not an empty string the enum would reject.
                // Empty means journal-only, not an unparseable ObjectId.
                portfolioId: form.portfolioId || null,
                entryFrom: num(form.entryFrom),
                entryTo: num(form.entryTo),
                exitPrice: num(form.exitPrice),
                fees: num(form.fees) || 0,
                exitFees: num(form.exitFees) || 0,
                plannedStop: num(form.plannedStop),
                // Blank rows are how a target gets removed. Ordering and level
                // numbering are the model's job, not the form's.
                targets: form.targets
                    .filter((t) => t.price !== '' && t.price != null)
                    .map((t) => ({ ...t, price: num(t.price) })),
                exitDate: form.exitDate || null
            };

            if (planning) {
                // A planned trade has no fill and no outcome. Sending blanks would
                // trip the conditional validators the moment it opens.
                Object.assign(payload, {
                    entryPrice: null, quantity: null, entryDate: null,
                    exitPrice: null, exitDate: null
                });
            } else {
                payload.entryPrice = num(form.entryPrice);
                payload.quantity = num(form.quantity);
            }
            // Don't send what the ledger owns. The server refuses changes to these
            // anyway; omitting them means an unrelated edit never trips that guard.
            if (entryBooked) {
                delete payload.entryPrice; delete payload.quantity;
                delete payload.entryDate; delete payload.fees; delete payload.portfolioId;
            }
            if (exitBooked) {
                delete payload.exitPrice; delete payload.exitDate; delete payload.exitFees;
            }

            if (editing) await updateEntry(entry._id, payload);
            else await createEntry(payload);
            toast.success(editing ? 'Entry updated' : 'Trade journaled');
            onSaved();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save entry');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            size="xl"
            onClose={onClose}
            rail={
                <RiskRail
                    books={bookable}
                    portfolioId={form.portfolioId}
                    onPickBook={(v) => set('portfolioId', v)}
                    locked={entryBooked}
                    capital={riskCtx?.capital}
                    verdict={riskCtx?.verdict}
                    suggested={riskCtx?.suggested}
                    currency={currency}
                    onUseSuggested={(n) => set('quantity', String(n))}
                />
            }
            title={closingNow ? `Close ${form.symbol || 'the trade'}`
                : editing ? (planning ? 'Edit Planned Trade' : 'Edit Trade')
                    : (planning ? 'Plan a Trade' : 'Journal a Trade')}
            footer={
                <>
                    <button type="button" onClick={onClose}
                        className="flex-1 px-4 py-2 border border-hairline text-ink-muted rounded-control hover:bg-surface-muted">
                        Cancel
                    </button>
                    {/* Outside the form element, so bound to it by id. This is what
                        keeps the actions visible while a long form scrolls. */}
                    <button type="submit" form={FORM_ID} disabled={saving}
                        className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-control hover:bg-cyan-600 disabled:opacity-50">
                        {saving ? 'Saving...'
                            : closingNow ? 'Close the trade'
                                : editing ? 'Save changes'
                                    : planning ? 'Watch this level' : 'Add to journal'}
                    </button>
                </>
            }
        >
            <form id={FORM_ID} onSubmit={submit} className="space-y-5">
                {/* A closed trade has a result already; offering to un-enter it
                    would only invite an inconsistent record. */}
                {form.state !== 'closed' && (
                    <div className="flex gap-2 p-1 bg-surface-muted rounded-control">
                        {[
                            { key: 'planned', label: 'Watching a level', hint: 'Not in it yet' },
                            { key: 'open', label: 'In the trade', hint: 'Filled' }
                        ].map((m) => (
                            <button key={m.key} type="button" onClick={() => set('state', m.key)}
                                className={`flex-1 px-3 py-2 rounded-control text-sm transition-colors ${form.state === m.key
                                    ? 'bg-surface text-ink shadow-card font-medium'
                                    : 'text-ink-muted hover:text-ink'}`}>
                                {m.label}
                                <span className="block text-xs text-ink-faint">{m.hint}</span>
                            </button>
                        ))}
                    </div>
                )}

                <Section title="1 · What you’re trading"
                    when={planning ? null : form.entryDate}
                    onWhen={(v) => set('entryDate', v)} whenLocked={entryBooked}>
                    <div className={ROW}>
                        <Field label="Symbol *">
                            <SymbolInput
                                required
                                value={form.symbol}
                                onChange={(v) => set('symbol', v)}
                                // Picking a known stock fills the entry price for a
                                // trade being logged now; a plan is waiting for a
                                // level, so leave its zone alone.
                                onSelect={(stock) => {
                                    if (live && !entryBooked && stock.currentPrice > 0 && form.entryPrice === '') {
                                        set('entryPrice', String(stock.currentPrice));
                                    }
                                }}
                            />
                        </Field>
                        <Field label="Direction">
                            <select value={form.direction} className={input}
                                onChange={(e) => set('direction', e.target.value)}>
                                <option value="long">Long</option>
                                <option value="short">Short</option>
                            </select>
                        </Field>
                    </div>
                </Section>

                {/* The two that decide the size, together and nothing between them. */}
                <Section title="2 · Entry and stop">
                    <div className={ROW}>
                        {planning ? (
                            <>
                                <Field label="Entry zone from *">
                                    <input type="number" step="any" value={form.entryFrom} className={input}
                                        onChange={(e) => set('entryFrom', e.target.value)} />
                                </Field>
                                <Field label="to">
                                    <input type="number" step="any" value={form.entryTo} className={input}
                                        onChange={(e) => set('entryTo', e.target.value)} />
                                </Field>
                            </>
                        ) : (
                            <Field label="Entry price *" locked={entryBooked}>
                                <input type="number" step="any" required value={form.entryPrice} className={input}
                                    disabled={entryBooked}
                                    onChange={(e) => set('entryPrice', e.target.value)} />
                            </Field>
                        )}
                        <Field label="Stop loss">
                            <input type="number" step="any" value={form.plannedStop} className={input}
                                onChange={(e) => set('plannedStop', e.target.value)} />
                        </Field>
                    </div>
                    {planning && (
                        <p className="text-xs text-ink-faint mt-1">
                            A level is a band, not a number. You&apos;ll be told when price trades into it.
                        </p>
                    )}
                    {perShare > 0 && (
                        <p className="text-xs text-ink-faint mt-1 tabular-nums">
                            {perShare.toFixed(2)} a share at risk — the distance that sets the size.
                        </p>
                    )}
                </Section>

                <Section title="3 · How many">
                    <div className={ROW}>
                        <Field label="Shares" locked={entryBooked}>
                            <input type="number" step="any" required={!planning} value={form.quantity}
                                className={input} disabled={entryBooked}
                                placeholder={planning ? 'optional' : ''}
                                onChange={(e) => set('quantity', e.target.value)} />
                        </Field>
                    </div>
                    <p className="text-xs text-ink-faint mt-1">
                        {riskCtx?.suggested
                            ? 'Take the suggestion beside this, or type your own.'
                            : 'An entry and a stop will suggest a size.'}
                    </p>
                </Section>

                {/* Judgement rather than arithmetic: none of it is needed to size
                    a trade, so none of it is in the way of doing so. */}
                <button type="button" onClick={() => setShowMore((v) => !v)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600
                               dark:text-cyan-400 border-t border-dashed border-hairline pt-4">
                    {showMore ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    Setup, market and targets
                </button>

                {showMore && (
                    <div className="flex flex-col gap-4">
                        <div className={ROW}>
                            <Field label="Setup">
                                <TagInput single value={form.setupType ? [form.setupType] : []}
                                    suggestions={options?.setupTypes || []}
                                    placeholder="what you call it"
                                    onChange={(v) => set('setupType', v[0] || '')} />
                            </Field>
                            <Field label="Exchange">
                                <select value={form.exchange} className={input}
                                    onChange={(e) => set('exchange', e.target.value)}>
                                    {(options?.exchanges || ['PSX']).map((x) => <option key={x}>{x}</option>)}
                                </select>
                            </Field>
                        </div>

                        <TargetsEditor targets={form.targets} onChange={(t) => set('targets', t)} />
                    </div>
                )}

                <Section title="Exit" hidden={!closing}>
                    <div className={ROW}>
                        <Field label="Exit date" locked={exitBooked}>
                            <input type="date" value={form.exitDate} className={input}
                                disabled={exitBooked}
                                onChange={(e) => set('exitDate', e.target.value)} />
                        </Field>
                        <Field label="Exit price *" locked={exitBooked}>
                            <input type="number" step="any" value={form.exitPrice} className={input}
                                disabled={exitBooked}
                                onChange={(e) => set('exitPrice', e.target.value)} />
                        </Field>
                    </div>
                    <div className="mt-3">
                        <Check checked={form.exitConfirmed} onChange={(v) => set('exitConfirmed', v)}
                            label="Confirmed from a broker fill or statement"
                            hint="Leave unchecked if this is from memory — the stats will flag it." />
                    </div>
                </Section>

                {/* Judgment belongs after the fact. Asking what went wrong with a
                    trade still running invites a fabricated answer, so until it is
                    closed the only prompt is the thesis. */}
                {!closing ? (
                    <Section
                        title={planning ? 'Why this level' : 'Why this trade'}
                        hint="The thesis, written while the outcome is still unknown.">
                        <Field label="Notes">
                            <textarea rows="3" value={form.notes} className={input} maxLength={2000}
                                placeholder={planning
                                    ? 'What makes this level worth taking?'
                                    : 'Why did I take this? How will I manage it?'}
                                onChange={(e) => set('notes', e.target.value)} />
                        </Field>
                    </Section>
                ) : (
                <Section title="Review">
                    <div className={ROW}>
                        <Field label="How I felt">
                            <select value={form.emotionalState} className={input}
                                onChange={(e) => set('emotionalState', e.target.value)}>
                                {(options?.emotions || []).map((x) => <option key={x} value={x}>{x}</option>)}
                            </select>
                        </Field>
                        <Field label="Market condition">
                            <select value={form.marketCondition} className={input}
                                onChange={(e) => set('marketCondition', e.target.value)}>
                                {(options?.marketConditions || []).map((x) => <option key={x} value={x}>{x}</option>)}
                            </select>
                        </Field>
                    </div>

                    <div className="mt-3">
                        <div className="text-sm font-medium text-ink-muted mb-1">
                            What went wrong
                        </div>
                        <p className="text-xs text-ink-faint mb-2">
                            Leave empty if the plan was followed — a loss on a good decision is not a mistake.
                        </p>
                        <TagInput value={form.mistakes} suggestions={options?.mistakes || []}
                            placeholder="in your own words, then Enter"
                            onChange={(v) => set('mistakes', v)} />
                    </div>

                    <div className="mt-3">
                        <Field label="Notes">
                            <textarea rows="3" value={form.notes} className={input} maxLength={2000}
                                placeholder="Why did I take this? How did I manage it?"
                                onChange={(e) => set('notes', e.target.value)} />
                        </Field>
                    </div>
                    <div className="mt-3">
                        <Field label="Lesson">
                            <input value={form.lesson} className={input} maxLength={500}
                                placeholder="One sentence I want to remember"
                                onChange={(e) => set('lesson', e.target.value)} />
                        </Field>
                    </div>
                </Section>
                )}
            </form>
        </Modal>
    );
}

// The form lives in the dialog body while its submit button lives in the sticky
// footer, so the two are joined by id rather than by nesting.
const FORM_ID = 'journal-entry-form';

const input = FIELD;
const ROW = 'grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]';

function Section({ title, hint, hidden, when, onWhen, whenLocked, children }) {
    if (hidden) return null;
    return (
        <div className="border-t border-hairline pt-5 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-3">
                <h3 className="font-semibold text-ink">{title}</h3>
                {/* On the heading row, which had the space going spare. Needed on
                    every trade and right by default on almost all of them, so it
                    earns sight without costing a tab stop among the real fields. */}
                {when !== undefined && when !== null && (
                    <input
                        type="date" value={when} disabled={whenLocked}
                        onChange={(e) => onWhen(e.target.value)}
                        aria-label="Trade date"
                        className="ml-auto px-2 py-1 text-xs rounded-control border border-hairline
                                   bg-surface text-ink-muted tabular-nums disabled:opacity-60"
                    />
                )}
            </div>
            {hint && <p className="text-xs text-ink-faint mt-0.5">{hint}</p>}
            {/* Fixed, not conditional on the hint: the gap above the fields was
                what shifted between sections, not the heading. */}
            <div className="mt-3">{children}</div>
        </div>
    );
}

/**
 * Staged take-profits. Rows carry isHit through unchanged so editing a price
 * cannot un-hit a target the price poll already flagged.
 */
function TargetsEditor({ targets, onChange }) {
    const update = (i, price) =>
        onChange(targets.map((t, n) => (n === i ? { ...t, price } : t)));

    return (
        <div className="mt-3">
            <div className="text-sm font-medium text-ink-muted mb-1">Targets</div>
            {targets.length === 0 && (
                <p className="text-xs text-ink-faint mb-2">
                    None set. Add one and you&apos;ll be told when price reaches it.
                </p>
            )}
            <div className="space-y-2">
                {targets.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-ink-faint w-6 shrink-0">
                            T{t.level || i + 1}
                        </span>
                        <input type="number" step="any" value={t.price ?? ''} className={input}
                            onChange={(e) => update(i, e.target.value)} />
                        {t.isHit && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                                <CheckCircle className="w-3.5 h-3.5" /> hit
                            </span>
                        )}
                        <button type="button" title="Remove target"
                            onClick={() => onChange(targets.filter((_, n) => n !== i))}
                            className="p-2 text-ink-faint hover:text-red-600 hover:bg-surface-muted rounded-control shrink-0">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={() => onChange([...targets, { price: '', isHit: false }])}
                className="mt-2 inline-flex items-center gap-1 text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
                <Plus className="w-3.5 h-3.5" /> Add target
            </button>
        </div>
    );
}

function Field({ label, locked, children }) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-ink-muted mb-1">
                {label}
                {/* Says why it is disabled, rather than leaving it looking broken. */}
                {locked && <Lock className="w-3 h-3 text-ink-faint" title="Recorded in the portfolio ledger" />}
            </label>
            {children}
        </div>
    );
}

function Check({ checked, onChange, label, hint }) {
    return (
        <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500" />
            <span>
                <span className="text-sm text-ink-muted">{label}</span>
                {hint && <span className="block text-xs text-ink-faint">{hint}</span>}
            </span>
        </label>
    );
}
