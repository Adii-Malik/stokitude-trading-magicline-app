import { useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useMarket } from '../../contexts/MarketContext';
import { useTheme } from '../../contexts/ThemeContext';
import TradingViewHeatmap from './TradingViewHeatmap';
import SectorRanking from './SectorRanking';
import { BOARDS, TIMEFRAMES, GROUPINGS, SIZES, DEFAULTS } from './heatmapConfig';

/** One row of choices. Buttons rather than a select: there are few enough to
 *  show them all, and seeing the alternatives is half of what makes it clear. */
function Choice({ label, options, value, onChange }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 w-20 shrink-0">
                {label}
            </span>
            <div className="flex flex-wrap gap-1">
                {options.map((o) => (
                    <button
                        key={o.id}
                        type="button"
                        onClick={() => onChange(o.id)}
                        title={o.hint}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${value === o.id
                            ? 'bg-cyan-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
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
    const [grouping, setGrouping] = useState(DEFAULTS.grouping);
    const [size, setSize] = useState(DEFAULTS.size);

    const board = BOARDS[market] || BOARDS.PK;
    const period = TIMEFRAMES.find((t) => t.id === timeframe);

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <LayoutGrid className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                    Market Heatmap
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {board.label} — how every sector has moved over {period?.label.toLowerCase()},
                    and which stocks moved it.
                </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700 space-y-3">
                <Choice label="Period" options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
                <Choice label="Group" options={GROUPINGS} value={grouping} onChange={setGrouping} />
                <Choice label="Tile size" options={SIZES} value={size} onChange={setSize} />
            </div>

            <SectorRanking period={timeframe} periodLabel={period?.label} />

            <div className="px-1 pt-2 text-sm text-gray-500 dark:text-gray-400">
                Every stock on the board. Grouped by TradingView's own sectors here, not PSX's, and sized by company — so the giants dominate. Use it to drill in, not to compare sectors.
            </div>

            {/* Keyed so a filter change builds a new container rather than
                mutating one the widget already replaced with its iframe. */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                style={{ height: 'min(75vh, 820px)' }}>
                <TradingViewHeatmap
                    key={`${board.dataSource}-${timeframe}-${grouping}-${size}-${theme}`}
                    dataSource={board.dataSource}
                    blockColor={timeframe}
                    blockSize={size}
                    grouping={grouping}
                    theme={theme}
                />
            </div>
        </div>
    );
}
