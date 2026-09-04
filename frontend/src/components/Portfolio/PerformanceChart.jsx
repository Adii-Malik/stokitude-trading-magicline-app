/**
 * Portfolio value over time, against the benchmark.
 * Both lines are rebased to 100 so a small portfolio is comparable to an index.
 */
import { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';
import { TrendingDown, Activity, Percent } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency, formatPercent, getPnLColorClass } from '../../utils/portfolioUtils';

const RANGES = [
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: '1Y', days: 365 },
    { label: 'All', days: null }
];

export default function PerformanceChart({ portfolioId, currency = 'PKR' }) {
    const [data, setData] = useState(null);
    const [range, setRange] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('value');

    useEffect(() => {
        let live = true;
        setLoading(true);

        const days = RANGES.find(r => r.label === range)?.days;
        const from = days
            ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
            : undefined;

        api.get(`/portfolios/${portfolioId}/performance`, { params: { from } })
            .then(res => { if (live) { setData(res.data.data); setError(null); } })
            .catch(err => { if (live) setError(err.response?.data?.message || 'Failed to load performance'); })
            .finally(() => { if (live) setLoading(false); });

        return () => { live = false; };
    }, [portfolioId, range]);

    const summary = data?.summary;
    const comparable = (data?.comparison?.length || 0) > 1;
    // A market with no warehoused bars has no curve, no drawdown and no index -
    // and the three of those are a different thing from "no data yet", which is
    // what this screen used to say while drawing a US book against KSE100.
    // The index this book is measured against, named by its market rather than
    // assumed: KSE100 was hardcoded here and in the route, so a book outside
    // Pakistan was drawn against the Pakistani index.
    const index = data?.benchmark?.symbol;

    return (
        <div className="bg-surface rounded-card shadow-card p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance</h3>

                <div className="flex flex-wrap items-center gap-2">
                    {comparable && (
                        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
                            <ModeButton active={mode === 'value'} onClick={() => setMode('value')}>Value</ModeButton>
                            <ModeButton active={mode === 'vs'} onClick={() => setMode('vs')}>vs {index}</ModeButton>
                        </div>
                    )}
                    <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
                        {RANGES.map(r => (
                            <ModeButton key={r.label} active={range === r.label} onClick={() => setRange(r.label)}>
                                {r.label}
                            </ModeButton>
                        ))}
                    </div>
                </div>
            </div>

            {summary && <Stats summary={summary} comparison={data?.comparison}
                currency={currency} index={index} />}

            {loading && <Placeholder>Loading…</Placeholder>}
            {!loading && error && <Placeholder>{error}</Placeholder>}
            {!loading && !error && !data?.series?.length && (
                <Placeholder>
                    No price history for this portfolio yet. Historical data is needed to chart it.
                </Placeholder>
            )}
            {!loading && !error && data?.series?.length > 0 && (
                <Chart
                    series={data.series}
                    comparison={data.comparison}
                    mode={comparable ? mode : 'value'}
                />
            )}

            {!loading && data?.missingPrices?.length > 0 && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                    No price history for {data.missingPrices.join(', ')} — those holdings count
                    as zero on days you held them, so the line and the comparison are understated.
                </p>
            )}

            {!loading && summary?.lateCapital && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                    Your first deposit is dated after your first trade, so XIRR and drawdown
                    are overstated. Date the deposit on or before the first buy to correct them.
                </p>
            )}

            {!loading && !comparable && data?.series?.length > 0 && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Add a {index} stock with daily history to compare against the index.
                </p>
            )}
        </div>
    );
}

/**
 * Only what the cards above do not already say. Value, cost and P/L live in
 * the portfolio summary; these three are the time-based measures.
 */
function Stats({ summary, comparison, currency, index }) {
    const last = comparison?.[comparison.length - 1];
    const edge = last ? last.portfolio - last.benchmark : null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <Stat
                icon={Percent}
                label="Annualised (XIRR)"
                value={summary.xirrPct != null ? formatPercent(summary.xirrPct, 1, { signed: true }) : '—'}
                hint={
                    summary.lateCapital ? 'overstated: deposit dated after first trade'
                        : summary.xirrPct != null ? `on ${formatCurrency(summary.peakInvested, currency)} at peak`
                            : 'record a cash deposit'
                }
                color={summary.lateCapital ? 'text-amber-600 dark:text-amber-400'
                    : summary.xirrPct != null ? getPnLColorClass(summary.xirrPct) : ''}
            />
            <Stat
                icon={TrendingDown}
                label="Max Drawdown"
                value={summary.drawdown.pct != null ? `-${summary.drawdown.pct.toFixed(1)}%` : '—'}
                hint={summary.drawdown.from ? `${summary.drawdown.from} → ${summary.drawdown.to}` : 'no fall recorded'}
                color={summary.drawdown.pct ? 'text-red-600 dark:text-red-400' : ''}
            />
            <Stat
                icon={Activity}
                label={`vs ${index}`}
                value={edge != null ? `${edge >= 0 ? '+' : ''}${edge.toFixed(1)} pts` : '—'}
                hint={edge != null
                    ? `you ${(last.portfolio - 100).toFixed(1)}%, index ${(last.benchmark - 100).toFixed(1)}%`
                    : `needs ${index} history`}
                color={edge != null ? getPnLColorClass(edge) : ''}
            />
        </div>
    );
}

/** Compact by design: these are secondary to the summary cards above. */
function Stat({ icon: Icon, label, value, hint, color = '' }) {
    return (
        <div className="rounded-lg border border-hairline px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
            </div>
            <div className={`mt-0.5 text-lg font-bold truncate ${color || 'text-gray-900 dark:text-white'}`}>
                {value}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{hint}</div>
        </div>
    );
}

function Chart({ series, comparison, mode }) {
    const box = useRef(null);

    useEffect(() => {
        if (!box.current) return;

        const dark = document.documentElement.classList.contains('dark');
        const chart = createChart(box.current, {
            height: 280,
            layout: {
                background: { color: 'transparent' },
                textColor: dark ? '#9ca3af' : '#6b7280',
                attributionLogo: false
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { color: dark ? '#374151' : '#f3f4f6' }
            },
            rightPriceScale: { borderVisible: false },
            timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
            handleScale: false,
            handleScroll: false
        });

        if (mode === 'vs') {
            const mine = chart.addSeries(LineSeries, { color: '#0891b2', lineWidth: 2, title: 'Portfolio' });
            const index = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'KSE100' });
            mine.setData(comparison.map(r => ({ time: r.date, value: r.portfolio })));
            index.setData(comparison.map(r => ({ time: r.date, value: r.benchmark })));
        } else {
            const line = chart.addSeries(LineSeries, { color: '#0891b2', lineWidth: 2 });
            line.setData(series.map(r => ({ time: r.date, value: r.total })));
        }

        chart.timeScale().fitContent();

        const resize = () => chart.applyOptions({ width: box.current?.clientWidth || 0 });
        resize();
        window.addEventListener('resize', resize);

        return () => {
            window.removeEventListener('resize', resize);
            chart.remove();
        };
    }, [series, comparison, mode]);

    return <div ref={box} className="w-full" />;
}

function ModeButton({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${active
                ? 'bg-surface text-cyan-600 dark:text-cyan-400 shadow-card'
                : 'text-gray-600 dark:text-gray-400'
                }`}
        >
            {children}
        </button>
    );
}

function Placeholder({ children }) {
    return (
        <div className="h-[280px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 text-center px-4">
            {children}
        </div>
    );
}
