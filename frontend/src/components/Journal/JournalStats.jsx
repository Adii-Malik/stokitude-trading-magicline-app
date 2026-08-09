import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatPercent, getPnLColorClass } from '../../utils/portfolioUtils';
import { mistakeLabel } from './labels';

export default function JournalStats({ stats }) {
    if (!stats) return null;
    const { byCurrency = [], process = {} } = stats;

    return (
        <div className="space-y-4">
            {byCurrency.map((c) => (
                <div key={c.currency} className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Stat label={`Net P/L (${c.currency})`}
                        value={formatCurrency(c.netPnL, c.currency, { signed: true })}
                        color={getPnLColorClass(c.netPnL)} />
                    <Stat label="Win Rate" value={formatPercent(c.winRate, 0)}
                        sub={`${c.wins}W / ${c.losses}L`} />
                    <Stat label="Profit Factor"
                        value={c.profitFactor != null ? c.profitFactor.toFixed(2) : '—'}
                        sub={c.profitFactor != null && c.profitFactor < 1 ? 'below breakeven' : ''} />
                    <Stat label="Avg R"
                        value={c.avgR != null ? `${c.avgR.toFixed(2)}R` : '—'}
                        sub={c.tradesWithR ? `${c.tradesWithR} of ${c.closedTrades} with a stop` : 'no stops recorded'} />
                    <Stat label="Expectancy"
                        value={formatCurrency(c.expectancy, c.currency, { signed: true })}
                        sub="per trade" color={getPnLColorClass(c.expectancy)} />
                </div>
            ))}

            {/* Process is judged apart from outcome — a loss that followed the plan is not a mistake. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Discipline label="Stop actually placed" rate={process.stopPlacedRate} />
                <Discipline label="Event calendar checked" rate={process.eventCheckedRate} />
                <Discipline label="Followed the plan" rate={process.followedPlanRate} />
            </div>

            {(process.goodProcessBadOutcome > 0 || process.badProcessGoodOutcome > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {process.goodProcessBadOutcome > 0 && (
                        <Callout icon={ShieldCheck} tone="green"
                            title={`${process.goodProcessBadOutcome} good decision${process.goodProcessBadOutcome > 1 ? 's' : ''}, bad outcome`}
                            body="Followed the plan and still lost. This is the cost of doing business, not a mistake to fix." />
                    )}
                    {process.badProcessGoodOutcome > 0 && (
                        <Callout icon={ShieldAlert} tone="amber"
                            title={`${process.badProcessGoodOutcome} lucky win${process.badProcessGoodOutcome > 1 ? 's' : ''}`}
                            body="Broke the plan and profited anyway. Repeating this eventually pays for itself." />
                    )}
                </div>
            )}

            {process.unconfirmedExits > 0 && (
                <Callout icon={AlertTriangle} tone="amber"
                    title={`${process.unconfirmedExits} unconfirmed exit${process.unconfirmedExits > 1 ? 's' : ''}`}
                    body="These prices came from memory, not a broker fill. Every figure above inherits that uncertainty until confirmed." />
            )}

            {/* Costs stay inside a currency; totalling them across markets would be meaningless. */}
            {byCurrency.filter((c) => c.byMistake?.length).map((c) => (
                <div key={`cost-${c.currency}`}
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                        What it cost ({c.currency})
                    </h3>
                    <div className="space-y-2">
                        {c.byMistake.map((m) => {
                            const worst = Math.abs(c.byMistake[0].cost) || 1;
                            return (
                                <div key={m.code} className="flex items-center gap-3">
                                    <div className="w-40 shrink-0 text-sm text-gray-700 dark:text-gray-300">
                                        {mistakeLabel(m.code)}
                                    </div>
                                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded h-5 overflow-hidden">
                                        <div className="bg-red-400 dark:bg-red-500 h-full"
                                            style={{ width: `${Math.min(100, (Math.abs(m.cost) / worst) * 100)}%` }} />
                                    </div>
                                    <div className="w-28 text-right text-sm font-semibold text-red-600 dark:text-red-400">
                                        {formatCurrency(m.cost, c.currency)}
                                    </div>
                                    <div className="w-10 text-right text-xs text-gray-500">×{m.count}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

function Stat({ label, value, sub, color }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            <div className={`text-xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</div>
            {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
        </div>
    );
}

function Discipline({ label, rate = 0 }) {
    const good = rate >= 80;
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                <span className={`text-sm font-bold ${good ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(rate, 0)}
                </span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded h-2 overflow-hidden">
                <div className={`h-full ${good ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
            </div>
        </div>
    );
}

function Callout({ icon: Icon, tone, title, body }) {
    const tones = {
        green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
        amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
    };
    return (
        <div className={`rounded-xl p-4 border flex gap-3 ${tones[tone]}`}>
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
                <div className="font-semibold">{title}</div>
                <div className="text-sm opacity-90">{body}</div>
            </div>
        </div>
    );
}
