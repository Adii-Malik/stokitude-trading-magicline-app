import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createEntry, updateEntry } from '../../services/journal';
import { mistakeLabel } from './labels';

const dateValue = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function JournalEntryModal({ entry, options, onClose, onSaved }) {
    const editing = Boolean(entry?._id);
    const [form, setForm] = useState({
        symbol: entry?.symbol || '',
        exchange: entry?.exchange || 'PSX',
        direction: entry?.direction || 'long',
        setupType: entry?.setupType || 'other',
        entryDate: dateValue(entry?.entryDate) || new Date().toISOString().slice(0, 10),
        entryPrice: entry?.entryPrice ?? '',
        quantity: entry?.quantity ?? '',
        exitDate: dateValue(entry?.exitDate),
        exitPrice: entry?.exitPrice ?? '',
        exitConfirmed: entry?.exitConfirmed ?? false,
        fees: entry?.fees ?? '',
        plannedStop: entry?.plannedStop ?? '',
        plannedTarget: entry?.plannedTarget ?? '',
        stopPlaced: entry?.stopPlaced ?? false,
        eventChecked: entry?.eventChecked ?? false,
        emotionalState: entry?.emotionalState || 'neutral',
        marketCondition: entry?.marketCondition || 'sideways',
        mistakes: entry?.mistakes || [],
        notes: entry?.notes || '',
        lesson: entry?.lesson || ''
    });
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const toggleMistake = (code) =>
        set('mistakes', form.mistakes.includes(code)
            ? form.mistakes.filter((m) => m !== code)
            : [...form.mistakes, code]);

    // Risk is only meaningful once a stop level exists.
    const risk = form.plannedStop !== '' && form.entryPrice !== '' && form.quantity !== ''
        ? Math.abs(form.entryPrice - form.plannedStop) * form.quantity
        : null;

    const stopWithoutLevel = form.stopPlaced && form.plannedStop === '';

    const submit = async (e) => {
        e.preventDefault();
        if (stopWithoutLevel) {
            toast.error('Enter the stop level you placed');
            return;
        }
        setSaving(true);
        try {
            const num = (v) => (v === '' ? undefined : parseFloat(v));
            const payload = {
                ...form,
                entryPrice: num(form.entryPrice),
                quantity: num(form.quantity),
                exitPrice: num(form.exitPrice),
                fees: num(form.fees) || 0,
                plannedStop: num(form.plannedStop),
                plannedTarget: num(form.plannedTarget),
                exitDate: form.exitDate || undefined
            };
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {editing ? 'Edit Trade' : 'Journal a Trade'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-5">
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
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3">
                            <Field label="Entry date *">
                                <input type="date" required value={form.entryDate} className={input}
                                    onChange={(e) => set('entryDate', e.target.value)} />
                            </Field>
                            <Field label="Entry price *">
                                <input type="number" step="any" required value={form.entryPrice} className={input}
                                    onChange={(e) => set('entryPrice', e.target.value)} />
                            </Field>
                            <Field label="Quantity *">
                                <input type="number" step="any" required value={form.quantity} className={input}
                                    onChange={(e) => set('quantity', e.target.value)} />
                            </Field>
                        </div>
                    </Section>

                    <Section title="The plan" hint="Filled in before the outcome is known.">
                        <div className="grid grid-cols-3 gap-3">
                            <Field label="Stop level">
                                <input type="number" step="any" value={form.plannedStop} className={input}
                                    onChange={(e) => set('plannedStop', e.target.value)} />
                            </Field>
                            <Field label="Target">
                                <input type="number" step="any" value={form.plannedTarget} className={input}
                                    onChange={(e) => set('plannedTarget', e.target.value)} />
                            </Field>
                            <Field label="Risk">
                                <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                                    {risk != null ? risk.toFixed(2) : '—'}
                                </div>
                            </Field>
                        </div>
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

                    <Section title="Exit" hint="Leave blank while the trade is open.">
                        <div className="grid grid-cols-3 gap-3">
                            <Field label="Exit date">
                                <input type="date" value={form.exitDate} className={input}
                                    onChange={(e) => set('exitDate', e.target.value)} />
                            </Field>
                            <Field label="Exit price">
                                <input type="number" step="any" value={form.exitPrice} className={input}
                                    onChange={(e) => set('exitPrice', e.target.value)} />
                            </Field>
                            <Field label="Fees">
                                <input type="number" step="any" value={form.fees} className={input}
                                    onChange={(e) => set('fees', e.target.value)} />
                            </Field>
                        </div>
                        {form.exitPrice !== '' && (
                            <div className="mt-2">
                                <Check checked={form.exitConfirmed} onChange={(v) => set('exitConfirmed', v)}
                                    label="Confirmed from a broker fill or statement"
                                    hint="Leave unchecked if this is from memory — the stats will flag it." />
                            </div>
                        )}
                    </Section>

                    <Section title="Review">
                        <div className="grid grid-cols-2 gap-3">
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
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                What went wrong
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Leave empty if the plan was followed — a loss on a good decision is not a mistake.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {(options?.mistakes || []).map((code) => (
                                    <button key={code} type="button" onClick={() => toggleMistake(code)}
                                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${form.mistakes.includes(code)
                                            ? 'bg-red-500 border-red-500 text-white'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-red-400'}`}>
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

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50">
                            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add to journal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const input = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500';

function Section({ title, hint, children }) {
    return (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 first:border-t-0 first:pt-0">
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{hint}</p>}
            <div className={hint ? '' : 'mt-2'}>{children}</div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
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
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                {hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
            </span>
        </label>
    );
}
