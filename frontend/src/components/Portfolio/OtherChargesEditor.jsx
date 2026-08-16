import { Plus, Trash2 } from 'lucide-react';
import { DEFAULT_PSX_CHARGES } from '../../utils/commission';

const BASES = [
    ['PERCENT_OF_BROKERAGE', '% of brokerage'],
    ['PERCENT_OF_VALUE', '% of trade value'],
    ['PER_SHARE', 'Per share'],
    ['FIXED', 'Fixed']
];

/**
 * Charges beyond brokerage. Each line picks its own basis on purpose: sales
 * tax is a cut of the brokerage, CDC is per share, the rest are a percentage
 * of traded value. Forcing them all onto trade value fits one contract note
 * and drifts on every other.
 */
export default function OtherChargesEditor({ charges, onChange }) {
    const rows = charges?.length ? charges : [];

    const update = (i, patch) => onChange(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
    const remove = (i) => onChange(rows.filter((_, n) => n !== i));
    const add = () => onChange([...rows, { name: '', basis: 'PERCENT_OF_VALUE', value: 0, appliesTo: 'BOTH' }]);

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Other charges
                </label>
                {rows.length === 0 && (
                    <button type="button" onClick={() => onChange(DEFAULT_PSX_CHARGES)}
                        className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">
                        Use typical PSX charges
                    </button>
                )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Sales tax, CDC, NCCPL, SECP, LAGA, CVT, WHT. Added to the brokerage when
                a trade is entered.
            </p>

            {rows.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3">
                    None set — only brokerage will be prefilled.
                </p>
            ) : (
                <>
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-1 mb-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="col-span-3">Charge</span>
                <span className="col-span-4">Based on</span>
                <span className="col-span-2">Rate</span>
                        <span className="col-span-2">Applies to</span>
                    </div>

                    <div className="space-y-2">
                    {rows.map((c, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                            <input
                                value={c.name ?? ''}
                                onChange={(e) => update(i, { name: e.target.value })}
                                className={`${cell} col-span-3`} placeholder="Name"
                            />
                            <select
                                value={c.basis}
                                onChange={(e) => update(i, { basis: e.target.value })}
                                className={`${cell} col-span-4`}
                            >
                                {BASES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                            </select>
                            <input
                                type="number" step="0.001" value={c.value ?? ''}
                                onChange={(e) => update(i, { value: e.target.value })}
                                className={`${cell} col-span-2`} placeholder="Rate"
                            />
                            <select
                                value={c.appliesTo || 'BOTH'}
                                onChange={(e) => update(i, { appliesTo: e.target.value })}
                                className={`${cell} col-span-2`}
                            >
                                <option value="BOTH">Both</option>
                                <option value="BUY">Buy</option>
                                <option value="SELL">Sell</option>
                            </select>
                            <button
                                type="button" onClick={() => remove(i)}
                                className="col-span-1 p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title="Remove charge"
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
                <Plus className="w-4 h-4" /> Add charge
            </button>
        </div>
    );
}

const cell = 'px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500';
