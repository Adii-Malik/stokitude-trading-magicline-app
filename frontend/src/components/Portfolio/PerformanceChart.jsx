/**
 * Portfolio value over time, against the benchmark.
 * Both lines are rebased to 100 so a small portfolio is comparable to an index.
 */
import { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';
import { TrendingUp, TrendingDown, Activity, Percent } from 'lucide-react';
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

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance</h3>

                <div className="flex flex-wrap items-center gap-2">
                    {comparable && (
                        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
                            <ModeButton active={mode === 'value'} onClick={() => setMode('value')}>Value</ModeButton>
                            <ModeButton active={mode === 'vs'} onClick={() => setMode('vs')}>vs KSE100</ModeButton>
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

            {summary && <Stats summary={summary} currency={currency} />}

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

            {!loading && !comparable && data?.series?.length > 0 && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Add a KSE100 stock with daily history to compare against the index.
                </p>
            )}
        </div>
    );
}

function Stats({ summary, currency }) {
    const gain = summary.total - summary.invested;
    const showReturn = summary.invested > 0;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat
                icon={Activity}
                label="Portfolio Value"
                value={formatCurrency(summary.total, currency)}
                hint={`Equity ${formatCurrency(summary.value, currency)}`}
            />
            <Stat
                icon={gain >= 0 ? TrendingUp : TrendingDown}
                label="Gain"
                value={showReturn ? formatCurrency(gain, currency, { signed: true }) : '—'}
                hint={showReturn ? `on ${formatCurrency(summary.invested, currency)} invested` : 'record a deposit'}
                color={showReturn ? getPnLColorClass(gain) : ''}
            />
            <Stat
                icon={Percent}
                label="Annualised (XIRR)"
                value={summary.xirrPct != null ? formatPercent(summary.xirrPct, 1, { signed: true }) : '—'}
                hint={summary.xirrPct != null ? 'money-weighted' : 'needs a cash deposit'}
                color={summary.xirrPct != null ? getPnLColorClass(summary.xirrPct) : ''}
            />
            <Stat
                icon={TrendingDown}
                label="Max Drawdown"
                value={summary.drawdown.pct ? `-${summary.drawdown.pct.toFixed(1)}%` : '—'}
                hint={summary.drawdown.from ? `${summary.drawdown.from} → ${summary.drawdown.to}` : 'no fall recorded'}
                color={summary.drawdown.pct ? 'text-red-600 dark:text-red-400' : ''}
            />
        </div>
    );
}

function Stat({ icon: Icon, label, value, hint, color = '' }) {
    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Icon className="w-3.5 h-3.5" />
                {label}
            </div>
            <div className={`mt-1 text-lg font-semibold ${color || 'text-gray-900 dark:text-white'}`}>
                {value}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{hint}</div>
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
                ? 'bg-white dark:bg-gray-900 text-cyan-600 dark:text-cyan-400 shadow-sm'
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
