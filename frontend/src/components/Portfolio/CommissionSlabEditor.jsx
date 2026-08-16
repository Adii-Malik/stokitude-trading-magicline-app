import { Plus, Trash2 } from 'lucide-react';
import { DEFAULT_PSX_SLABS } from '../../utils/commission';

/**
 * Price bands for brokerage. Kept editable because rates differ by broker,
 * and a wrong rate quietly biases every gain the portfolio reports.
 */
export default function CommissionSlabEditor({ slabs, onChange }) {
    const rows = slabs?.length ? slabs : [];

    const update = (i, patch) => onChange(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
    const remove = (i) => onChange(rows.filter((_, n) => n !== i));
    const add = () => {
        const last = rows[rows.length - 1];
        const from = last?.to != null && last.to !== '' ? Number(last.to) + 0.01 : 0.01;
        onChange([...rows, { from, to: null, type: 'PER_SHARE', value: 0 }]);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Commission slab
                </label>
                {rows.length === 0 && (
                    <button type="button" onClick={() => onChange(DEFAULT_PSX_SLABS)}
                        className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">
                        Use typical PSX rates
                    </button>
                )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Matched on share price. Brokers commonly charge a flat rate per share on
                cheap stocks and a percentage of value above a threshold.
            </p>

            {rows.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3">
                    No bands set — fees will not be prefilled.
                </p>
            ) : (
                <>
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-1 mb-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="col-span-3">From price</span>
                <span className="col-span-3">To price</span>
                <span className="col-span-3">Charged</span>
                        <span className="col-span-2">Rate</span>
                    </div>

                    <div className="space-y-2">
                    {rows.map((s, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                            <input
                                type="number" step="0.01" value={s.from ?? ''}
                                onChange={(e) => update(i, { from: e.target.value })}
                                className={`${cell} col-span-3`} placeholder="From"
                            />
                            <input
                                type="number" step="0.01" value={s.to ?? ''}
                                onChange={(e) => update(i, { to: e.target.value === '' ? null : e.target.value })}
                                className={`${cell} col-span-3`} placeholder="any"
                            />
                            <select
                                value={s.type}
                                onChange={(e) => update(i, { type: e.target.value })}
                                className={`${cell} col-span-3`}
                            >
                                <option value="PER_SHARE">Per share</option>
                                <option value="PERCENT">% of value</option>
                            </select>
                            <input
                                type="number" step="0.001" value={s.value ?? ''}
                                onChange={(e) => update(i, { value: e.target.value })}
                                className={`${cell} col-span-2`} placeholder="Rate"
                            />
                            <button
                                type="button" onClick={() => remove(i)}
                                className="col-span-1 p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title="Remove band"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    </div>
                </>
            )}

            <button
                type="button" onClick={add}
                className="mt-2 inline-flex items-center gap-1 text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
            >
                <Plus className="w-4 h-4" /> Add band
            </button>
        </div>
    );
}

const cell = 'px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500';
