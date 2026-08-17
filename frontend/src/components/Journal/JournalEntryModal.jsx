import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import { createEntry, updateEntry } from '../../services/journal';
import { chargesFor } from '../../utils/commission';
import { mistakeLabel } from './labels';

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
        setupQuality: entry?.setupQuality || '',
        entryFrom: entry?.entryFrom ?? '',
        entryTo: entry?.entryTo ?? '',
        entryDate: dateValue(entry?.entryDate) || new Date().toISOString().slice(0, 10),
        entryPrice: entry?.entryPrice ?? '',
        quantity: entry?.quantity ?? '',
        exitDate: dateValue(entry?.exitDate),
        exitPrice: entry?.exitPrice ?? '',
        exitConfirmed: entry?.exitConfirmed ?? false,
        markPrice: entry?.markPrice ?? '',
        fees: entry?.fees ?? '',
        plannedStop: entry?.plannedStop ?? '',
        // Copied, not referenced: editing a price must not mutate the loaded
        // entry, and isHit has to survive a save it was not part of.
        targets: (entry?.targets || []).map((t) => ({ ...t })),
        stopPlaced: entry?.stopPlaced ?? false,
        eventChecked: entry?.eventChecked ?? false,
        emotionalState: entry?.emotionalState || 'neutral',
        marketCondition: entry?.marketCondition || 'sideways',
        mistakes: entry?.mistakes || [],
        notes: entry?.notes || '',
        lesson: entry?.lesson || ''
    });
    const [saving, setSaving] = useState(false);

    const planning = form.state === 'planned';

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const toggleMistake = (code) =>
        set('mistakes', form.mistakes.includes(code)
            ? form.mistakes.filter((m) => m !== code)
            : [...form.mistakes, code]);

    // A planned trade has no fill, so risk is measured against the zone midpoint
    // - the same reference the backend uses.
    const bounds = [form.entryFrom, form.entryTo].filter((v) => v !== '').map(Number);
    const reference = planning
        ? (bounds.length ? bounds.reduce((a, b) => a + b, 0) / bounds.length : null)
        : (form.entryPrice === '' ? null : Number(form.entryPrice));

    const riskPerShare = form.plannedStop !== '' && reference != null
        ? Math.abs(reference - Number(form.plannedStop))
        : null;
    const risk = riskPerShare != null && form.quantity !== ''
        ? riskPerShare * Number(form.quantity)
        : null;

    // Quoted against the nearest target, which is what the model stores first.
    const nearest = form.targets.length
        ? form.targets.map((t) => Number(t.price)).filter((p) => !Number.isNaN(p))
            .sort((a, b) => (form.direction === 'short' ? b - a : a - b))[0]
        : null;
    const rr = riskPerShare > 0 && nearest != null && reference != null
        ? Math.abs(nearest - reference) / riskPerShare
        : null;

    const stopWithoutLevel = form.stopPlaced && form.plannedStop === '';
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
    // it, so a journalled fill and a hand-entered one cost the same.
    const suggestedFee = portfolio && !planning
        ? chargesFor({
            price: form.entryPrice, quantity: form.quantity,
            slabs: portfolio.commissionSlabs, charges: portfolio.charges,
            side: form.direction === 'short' ? 'SELL' : 'BUY'
        }).total
        : 0;

    const [feeEdited, setFeeEdited] = useState(false);
    useEffect(() => {
        // Prefill once, then leave it alone. An explicit flag rather than checking
        // for an empty value, which froze on the first keystroke last time.
        if (!feeEdited && !entryBooked && suggestedFee > 0) {
            setForm((f) => ({ ...f, fees: suggestedFee.toFixed(2) }));
        }
    }, [suggestedFee, feeEdited, entryBooked]);

    const submit = async (e) => {
        e.preventDefault();
        if (stopWithoutLevel) {
            toast.error('Enter the stop level you placed');
            return;
        }
        if (zoneMissing) {
            toast.error('Give the entry zone a level to watch for');
            return;
        }
        setSaving(true);
        try {
            // null rather than undefined, so clearing a field survives JSON.stringify.
            const num = (v) => (v === '' || v == null ? null : parseFloat(v));
            const payload = {
                ...form,
                // Ungraded is absent, not an empty string the enum would reject.
                setupQuality: form.setupQuality || null,
                // Empty means journal-only, not an unparseable ObjectId.
                portfolioId: form.portfolioId || null,
                entryFrom: num(form.entryFrom),
                entryTo: num(form.entryTo),
                exitPrice: num(form.exitPrice),
                markPrice: num(form.markPrice),
                fees: num(form.fees) || 0,
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
                    exitPrice: null, exitDate: null, markPrice: null
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
            if (exitBooked) { delete payload.exitPrice; delete payload.exitDate; }

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
            size="lg"
            onClose={onClose}
            title={editing
                ? (planning ? 'Edit Planned Trade' : 'Edit Trade')
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

                <Section title="Trade">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Field label="Symbol *">
                            <input required value={form.symbol} className={input}
                                onChange={(e) => set('symbol', e.target.value.toUpperCase())} />
                        </Field>
                        <Field label="Market">
                            <select value={form.exchange} className={input}
                                onChange={(e) => set('exchange', e.target.value)}>
                                {(options?.exchanges || ['PSX']).map((x) => <option key={x}>{x}</option>)}
                            </select>
                        </Field>
                        <Field label="Direction">
                            <select value={form.direction} className={input}
                                onChange={(e) => set('direction', e.target.value)}>
                                <option value="long">Long</option>
                                <option value="short">Short</option>
                            </select>
                        </Field>
                        <Field label="Setup">
                            <select value={form.setupType} className={input}
                                onChange={(e) => set('setupType', e.target.value)}>
                                {(options?.setupTypes || []).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>
                        <Field label="How it looks">
                            <select value={form.setupQuality} className={input}
                                onChange={(e) => set('setupQuality', e.target.value)}>
                                {/* Blank by default: a grade should mean you gave one. */}
                                <option value="">not graded</option>
                                {(options?.setupQualities || []).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>
                    </div>
                    {planning ? (
                        <div className="mt-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <Field label="Entry zone from *">
                                    <input type="number" step="any" value={form.entryFrom} className={input}
                                        onChange={(e) => set('entryFrom', e.target.value)} />
                                </Field>
                                <Field label="to">
                                    <input type="number" step="any" value={form.entryTo} className={input}
                                        onChange={(e) => set('entryTo', e.target.value)} />
                                </Field>
                                <Field label="Quantity">
                                    <input type="number" step="any" value={form.quantity} className={input}
                                        placeholder="optional"
                                        onChange={(e) => set('quantity', e.target.value)} />
                                </Field>
                            </div>
                            <p className="text-xs text-ink-faint mt-1">
                                A level is a band, not a number. You&apos;ll be told when price trades into it.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                            <Field label="Entry date *" locked={entryBooked}>
                                <input type="date" required value={form.entryDate} className={input}
                                    disabled={entryBooked}
                                    onChange={(e) => set('entryDate', e.target.value)} />
                            </Field>
                            <Field label="Entry price *" locked={entryBooked}>
                                <input type="number" step="any" required value={form.entryPrice} className={input}
                                    disabled={entryBooked}
                                    onChange={(e) => set('entryPrice', e.target.value)} />
                            </Field>
                            <Field label="Quantity *" locked={entryBooked}>
                                <input type="number" step="any" required value={form.quantity} className={input}
                                    disabled={entryBooked}
                                    onChange={(e) => set('quantity', e.target.value)} />
                            </Field>
                        </div>
                    )}

                    <div className="mt-3">
                        <Field label="Book it in a portfolio">
                            <select value={form.portfolioId} className={input}
                                disabled={entryBooked}
                                onChange={(e) => set('portfolioId', e.target.value)}>
                                <option value="">Don&apos;t book it — journal only</option>
                                {bookable.map((p) => (
                                    <option key={p._id} value={p._id}>{p.name}</option>
                                ))}
                            </select>
                        </Field>
                        <p className="text-xs text-ink-faint mt-1">
                            {entryBooked
                                ? 'Booked. The ledger owns the numbers above — edit the transaction in the portfolio to change them.'
                                : form.portfolioId
                                    ? 'A buy is recorded when you save, and a sell when you close. The ledger then owns those numbers.'
                                    : bookable.length === 0
                                        ? `No ${currency} portfolio to book into. The journal will track this trade on its own.`
                                        : 'Leave unset for a trade held somewhere this app has no ledger for.'}
                        </p>
                    </div>
                </Section>

                <Section title="The plan" hint="Filled in before the outcome is known.">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Field label="Stop level">
                            <input type="number" step="any" value={form.plannedStop} className={input}
                                onChange={(e) => set('plannedStop', e.target.value)} />
                        </Field>
                        <Field label="Risk">
                            <div className="px-3 py-2 text-sm text-ink-muted">
                                {risk != null ? risk.toFixed(2) : '—'}
                            </div>
                        </Field>
                        <Field label="Reward : risk">
                            <div className="px-3 py-2 text-sm text-ink-muted">
                                {rr != null ? `${rr.toFixed(2)} : 1` : '—'}
                            </div>
                        </Field>
                    </div>

                    <TargetsEditor targets={form.targets} onChange={(t) => set('targets', t)} />

                    <div className="mt-2 space-y-2">
                        <Check checked={form.stopPlaced} onChange={(v) => set('stopPlaced', v)}
                            label="Stop was actually placed at the broker"
                            hint="Not a mental stop — a resting order." />
                        {stopWithoutLevel && (
                            <p className="text-xs text-red-600 dark:text-red-400 pl-6">Enter the stop level too.</p>
                        )}
                        <Check checked={form.eventChecked} onChange={(v) => set('eventChecked', v)}
                            label="Checked the earnings/event calendar before entering" />
                    </div>
                </Section>

                {/* Nothing to exit from until the trade is entered. */}
                <Section title="Exit" hint="Leave blank while the trade is open." hidden={planning}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Field label="Exit date" locked={exitBooked}>
                            <input type="date" value={form.exitDate} className={input}
                                disabled={exitBooked}
                                onChange={(e) => set('exitDate', e.target.value)} />
                        </Field>
                        <Field label="Exit price" locked={exitBooked}>
                            <input type="number" step="any" value={form.exitPrice} className={input}
                                disabled={exitBooked}
                                onChange={(e) => set('exitPrice', e.target.value)} />
                        </Field>
                        <Field label="Fees" locked={entryBooked}>
                            <input type="number" step="any" value={form.fees} className={input}
                                disabled={entryBooked}
                                onChange={(e) => { setFeeEdited(true); set('fees', e.target.value); }} />
                        </Field>
                    </div>
                    {portfolio && !entryBooked && suggestedFee > 0 && (
                        <p className="text-xs text-ink-faint mt-1">
                            {suggestedFee.toFixed(2)} from {portfolio.name}&apos;s commission rules. Override if the note says otherwise.
                        </p>
                    )}
                    {form.exitPrice !== '' ? (
                        <div className="mt-2">
                            <Check checked={form.exitConfirmed} onChange={(v) => set('exitConfirmed', v)}
                                label="Confirmed from a broker fill or statement"
                                hint="Leave unchecked if this is from memory — the stats will flag it." />
                        </div>
                    ) : (
                        <div className="mt-3 w-1/3">
                            <Field label="Last price">
                                <input type="number" step="any" className={input} value={form.markPrice}
                                    placeholder="optional"
                                    onChange={(e) => set('markPrice', e.target.value)} />
                            </Field>
                            <p className="text-xs text-ink-faint mt-1">
                                Marks an open trade by hand. Kept out of realized P/L.
                            </p>
                        </div>
                    )}
                </Section>

                {/* Judgment belongs after the fact. Asking what went wrong with a
                    trade that has not been taken invites a fabricated answer. */}
                {planning ? (
                    <Section title="Why this level" hint="The thesis, written while it is still a decision.">
                        <Field label="Notes">
                            <textarea rows="3" value={form.notes} className={input} maxLength={2000}
                                placeholder="What makes this level worth taking?"
                                onChange={(e) => set('notes', e.target.value)} />
                        </Field>
                    </Section>
                ) : (
                <Section title="Review">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="How I felt">
                            <select value={form.emotionalState} className={input}
                                onChange={(e) => set('emotionalState', e.target.value)}>
                                {(options?.emotions || []).map((x) => <option key={x} value={x}>{x}</option>)}
                            </select>
                        </Field>
                        <Field label="Market">
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
                        <div className="flex flex-wrap gap-2">
                            {(options?.mistakes || []).map((code) => (
                                <button key={code} type="button" onClick={() => toggleMistake(code)}
                                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${form.mistakes.includes(code)
                                        ? 'bg-red-500 border-red-500 text-white'
                                        : 'border-hairline text-ink-muted hover:border-red-400'}`}>
                                    {mistakeLabel(code)}
                                </button>
                            ))}
                        </div>
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

const input = 'w-full px-3 py-2 border border-hairline bg-surface text-ink rounded-control focus:ring-2 focus:ring-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed';

function Section({ title, hint, hidden, children }) {
    if (hidden) return null;
    return (
        <div className="border-t border-hairline pt-4 first:border-t-0 first:pt-0">
            <h3 className="font-semibold text-ink">{title}</h3>
            {hint && <p className="text-xs text-ink-faint mb-2">{hint}</p>}
            <div className={hint ? '' : 'mt-2'}>{children}</div>
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
