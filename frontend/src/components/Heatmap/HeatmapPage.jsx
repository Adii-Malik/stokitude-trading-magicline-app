import { useEffect, useState } from 'react';
import { LayoutGrid, RefreshCw } from 'lucide-react';
import { useMarket } from '../../contexts/MarketContext';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../services/api';
import SectorTreemap from './SectorTreemap';
import SectorTable from './SectorTable';
import { BOARDS, TIMEFRAMES, TILE_WEIGHTS, DEFAULTS } from './heatmapConfig';

/** One row of choices, shown in full because seeing the alternatives is half of
 *  what makes a control clear. */
function Choice({ label, options, value, onChange }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </span>
            <div className="flex flex-wrap gap-1">
                {options.map((o) => (
                    <button key={o.id} type="button" onClick={() => onChange(o.id)} title={o.hint}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === o.id
                            ? 'bg-cyan-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}>
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function HeatmapPage() {
    const { market } = useMarket();
    const { theme } = useTheme();
    const [timeframe, setTimeframe] = useState(DEFAULTS.timeframe);
    const [weight, setWeight] = useState('count');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(null);

    // Every period arrives together, so this runs once per market rather than
    // once per filter change - the period buttons only repaint what is here.
    const load = () => {
        setData(null); setError(null);
        api.get('/heatmap/sectors')
            .then(({ data }) => setData(data.data))
            .catch((e) => setError(e.response?.data?.message || 'Could not load sectors'));
    };
    useEffect(load, [market]);

    const board = BOARDS[market] || BOARDS.PK;
    const period = TIMEFRAMES.find((t) => t.id === timeframe);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                <div>
                    <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
                        <LayoutGrid className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                        Sector Heatmap
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {board.label} — every sector over {period?.label.toLowerCase()}. Click one for the names inside it.
                    </p>
                </div>
                <button type="button" onClick={load}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </button>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <Choice label="Period" options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
                <Choice label="Tile size" options={TILE_WEIGHTS} value={weight} onChange={setWeight} />
            </div>

            {error && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-rose-600 dark:border-gray-700 dark:bg-gray-800 dark:text-rose-400">
                    {error}
                </div>
            )}
            {!data && !error && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Reading the board…
                </div>
            )}

            {data && (
                <>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                        <SectorTreemap sectors={data.sectors} period={timeframe} sizeBy={weight}
                            dark={theme === 'dark'} onSelect={(s) => setOpen(open === s ? null : s)} />
                    </div>

                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                            <h2 className="font-semibold text-gray-900 dark:text-white">Every sector, every period</h2>
                            {/* What is counted, and what is not. A reader is entitled to
                                know the list is not the whole board. */}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {data.sectors.length} sectors · {data.counted} stocks
                                {data.truncated > 0 && ` (largest ${data.truncated} of ${data.available})`}
                                {data.unclassified > 0 && ` · ${data.unclassified} funds and preference shares left out`}
                            </span>
                        </div>
                        <SectorTable data={data} period={timeframe} onPeriodChange={setTimeframe}
                            openSector={open} onToggle={setOpen} />
                    </div>
                </>
            )}
        </div>
    );
}
