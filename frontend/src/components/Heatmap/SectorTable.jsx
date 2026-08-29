import { useState, useEffect } from 'react';
import { ChevronRight, ArrowUpDown } from 'lucide-react';

const pct = (v, dp = 1) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`);
const tone = (v) => (v == null ? 'text-gray-400'
    : v > 0 ? 'text-emerald-600 dark:text-emerald-400'
        : v < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400');

/**
 * Every sector, every period, side by side.
 *
 * One column per period rather than one period at a time, because rotation is
 * the thing worth seeing: a sector green over a year and red over a month is a
 * different trade from one red on both, and switching a filter back and forth
 * hides exactly that.
 */
export default function SectorTable({ data, period, onPeriodChange, onOpen }) {
    const [sort, setSort] = useState({ key: period, dir: 'desc' });

    /**
     * The ranking follows the period.
     *
     * Otherwise the map paints one week while the rows are still ordered by the
     * month, and the top row is not the best sector on screen - which is the one
     * thing this table is for. Clicking any header still overrides it, until the
     * period moves again.
     */
    useEffect(() => setSort({ key: period, dir: 'desc' }), [period]);

    const value = (s, key) => {
        if (key === 'count') return s.count;
        if (key === 'breadth') return s.periods[period]?.up ?? 0;
        return s.periods[key]?.median ?? null;
    };

    const rows = [...data.sectors].sort((a, b) => {
        const av = value(a, sort.key), bv = value(b, sort.key);
        if (av == null) return 1;
        if (bv == null) return -1;
        return sort.dir === 'desc' ? bv - av : av - bv;
    });

    const head = (key, label, extra = '') => (
        <th
            onClick={() => setSort({ key, dir: sort.key === key && sort.dir === 'desc' ? 'asc' : 'desc' })}
            className={`px-2 py-2 font-medium cursor-pointer select-none whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-200 ${extra} ${sort.key === key ? 'text-cyan-600 dark:text-cyan-400' : ''}`}
        >
            <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="w-3 h-3 opacity-40" /></span>
        </th>
    );

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                        <th className="px-4 py-2 text-left font-medium">Sector</th>
                        {head('count', 'Cos.', 'text-right')}
                        {head('breadth', 'Up', 'text-right')}
                        <th className="px-2 py-2 text-right font-medium whitespace-nowrap">A/D</th>
                        {data.periods.map((p) => head(p.id, p.short, 'text-right'))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {rows.map((s) => {
                        const stat = s.periods[period];
                        return (
                            <tr key={s.sector} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="px-4 py-2">
                                        <button type="button" onClick={() => onOpen(s.sector)}
                                            className="flex items-center gap-2 text-left hover:text-cyan-600 dark:hover:text-cyan-400">
                                            <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
                                            <span className="text-gray-800 dark:text-gray-200">{s.sector}</span>
                                        </button>
                                    </td>
                                    <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{s.count}</td>
                                    <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                        {stat ? `${stat.up}/${s.count}` : '—'}
                                    </td>
                                    {/* Advance/decline ratio. A dash means nothing fell - which is
                                        a stronger statement than any number would be. */}
                                    <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                        {stat == null ? '—' : stat.ratio == null ? 'all up' : stat.ratio.toFixed(1)}
                                    </td>
                                    {data.periods.map((p) => {
                                        const v = s.periods[p.id]?.median;
                                        return (
                                            <td key={p.id}
                                                onClick={() => onPeriodChange(p.id)}
                                                title={`Colour the map by ${p.label}`}
                                                className={`px-2 py-2 text-right tabular-nums cursor-pointer ${tone(v)} ${p.id === period ? 'font-semibold bg-cyan-50/60 dark:bg-cyan-900/20' : ''}`}>
                                                {pct(v)}
                                            </td>
                                        );
                                    })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
