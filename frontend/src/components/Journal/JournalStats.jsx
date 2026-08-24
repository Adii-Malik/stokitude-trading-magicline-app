import { formatCurrency, formatPercent, getPnLColorClass } from '../../utils/portfolioUtils';

/**
 * The deeper read, one tab down from the four figures on the main screen.
 *
 * Four panels used to live here reporting on fields that no longer exist — stop
 * placed, event checked, setup grade, unconfirmed exits — and every one of them
 * had settled at zero. Nothing here is asked of the trader: how a trade ended is
 * derived from the exit against the levels, and a tracker is only counted
 * because they named it themselves.
 */
export default function JournalStats({ stats }) {
    if (!stats) return null;
    const { byCurrency = [] } = stats;

    if (!byCurrency.length) {
        return <p className="text-sm text-ink-faint py-8 text-center">Nothing closed yet.</p>;
    }

    return (
        <div className="space-y-4">
            {byCurrency.map((c) => (
                <div key={c.currency} className="space-y-4">
                    {byCurrency.length > 1 && (
                        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">
                            {c.currency}
                        </h3>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Stat label="Profit factor"
                            value={c.profitFactor != null ? c.profitFactor.toFixed(2) : '—'}
                            sub={c.profitFactor != null && c.profitFactor < 1 ? 'below breakeven' : 'gross wins ÷ gross losses'} />
                        <Stat label="Average win"
                            value={formatCurrency(c.avgWin, c.currency)}
                            sub={`${c.wins} win${c.wins === 1 ? '' : 's'}`}
                            color="text-green-600 dark:text-green-400" />
                        <Stat label="Average loss"
                            value={formatCurrency(c.avgLoss, c.currency)}
                            sub={`${c.losses} loss${c.losses === 1 ? '' : 'es'}`}
                            color="text-red-600 dark:text-red-400" />
                        <Stat label="Longest run"
                            value={`${c.bestStreak}W / ${c.worstStreak}L`}
                            sub="back to back" />
                    </div>

                    {/* Derived from the exit against the stop and targets, so this
                        groups a fact rather than a claim. Usually the row worth
                        reading is "closed early". */}
                    <Grouping title="How trades ended" rows={c.byExit} currency={c.currency}
                        empty="Nothing closed yet."
                        labels={{ unknown: 'no levels recorded' }} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Grouping title="By setup" rows={c.bySetup} currency={c.currency}
                            empty="No closed trades to group yet." />
                        {/* Only the things this user chose to count about
                            themselves. Absent entirely when they chose none. */}
                        {c.byTracker?.length > 0 && (
                            <Grouping title="What you're tracking" rows={c.byTracker.map(
                                ({ name, count, netPnL }) => ({ key: name, count, netPnL })
                            )} currency={c.currency} empty="" />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * A group's count and what it made. Money rather than win rate: a group can win
 * often and still be where the account leaks, and the whole point of grouping is
 * to find that.
 */
function Grouping({ title, rows = [], currency, empty, labels = {} }) {
    if (!rows.length && !empty) return null;
    const worst = Math.max(...rows.map((r) => Math.abs(r.netPnL || 0)), 1);

    return (
        <div className="bg-surface rounded-card p-4 shadow-card ring-1 ring-hairline">
            <h3 className="font-semibold text-ink mb-3">{title}</h3>
            {rows.length === 0 ? (
                <p className="text-sm text-ink-faint">{empty}</p>
            ) : (
                <div className="space-y-2">
                    {rows.map((r) => (
                        <div key={r.key} className="flex items-center gap-3">
                            <div className="w-32 shrink-0 text-sm text-ink-muted truncate">
                                {labels[r.key] || r.key}
                            </div>
                            <div className="flex-1 bg-surface-muted rounded h-5 overflow-hidden">
                                <div className={`h-full ${r.netPnL >= 0 ? 'bg-green-400 dark:bg-green-500' : 'bg-red-400 dark:bg-red-500'}`}
                                    style={{ width: `${Math.max(2, (Math.abs(r.netPnL || 0) / worst) * 100)}%` }} />
                            </div>
                            <div className={`w-28 text-right text-sm font-semibold tabular-nums ${getPnLColorClass(r.netPnL)}`}>
                                {formatCurrency(r.netPnL, currency, { signed: true })}
                            </div>
                            <div className="w-16 text-right text-xs text-ink-faint tabular-nums">
                                {r.winRate != null ? formatPercent(r.winRate, 0) : ''}
                            </div>
                            <div className="w-10 text-right text-xs text-ink-faint">×{r.count}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, sub, color }) {
    return (
        <div className="bg-surface rounded-card p-4 shadow-card ring-1 ring-hairline">
            <div className="text-xs text-ink-faint">{label}</div>
            <div className={`text-xl font-bold tabular-nums ${color || 'text-ink'}`}>{value}</div>
            {sub && <div className="text-xs text-ink-faint mt-0.5">{sub}</div>}
        </div>
    );
}
