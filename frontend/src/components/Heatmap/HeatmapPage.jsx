import { useState } from 'react';
import { LayoutGrid, Info } from 'lucide-react';
import { useMarket } from '../../contexts/MarketContext';
import { useTheme } from '../../contexts/ThemeContext';
import TradingViewHeatmap from './TradingViewHeatmap';
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
                    {board.label} — green is up over {period?.label.toLowerCase()}, red is down.
                    Bigger tiles are bigger companies.
                </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700 space-y-3">
                <Choice label="Period" options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
                <Choice label="Group" options={GROUPINGS} value={grouping} onChange={setGrouping} />
                <Choice label="Tile size" options={SIZES} value={size} onChange={setSize} />
            </div>

            {/* Only on PSX. The grouping is the one thing here that will not match
                how you think about that market - TradingView files Lucky under
                Non-Energy Minerals and puts fertiliser, sugar and textile in one
                bucket called Process Industries. On US boards its sectors are the
                ordinary reference and there is nothing to warn about, so saying
                this there would be noise about a market you are not looking at. */}
            {market === 'PK' && (
                <div className="flex gap-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4">
                    <Info className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-500" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                        These are TradingView's sectors, not PSX's. Cement sits under
                        <em> Non-Energy Minerals</em>, and <em>Process Industries</em> holds fertiliser,
                        sugar, chemicals and textile together. Good for spotting where money is
                        moving; not the sector names on your own books.
                    </p>
                </div>
            )}

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
