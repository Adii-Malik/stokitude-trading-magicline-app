import { AlertTriangle } from 'lucide-react';

/**
 * What the trade risks, against what you said you would risk.
 *
 * It states, never blocks. A trade that breaks your own rule still has to be
 * recordable, or the entry you most need to look back on is the one that never
 * gets written. Lines are omitted rather than zeroed when a number is unknown -
 * a dash reads as "nothing", which is a different claim from "not yet known".
 */
export function RiskVerdict({ verdict, currency = 'PKR', needsBook }) {
    // Silence would read as "nothing to worry about". Say which piece is missing.
    if (needsBook) {
        return (
            <p className="mt-3 text-xs text-ink-faint">
                Name the portfolio this trade belongs to and its balance becomes the
                yardstick for the risk.
            </p>
        );
    }
    if (!verdict || verdict.capital == null) return null;

    const { risk, riskPctOfCapital, position, positionPctOfCapital, rr, limits, breaches } = verdict;
    const money = (n) => `${currency} ${Math.round(n).toLocaleString()}`;
    const breached = breaches.risk || breaches.position || breaches.stopBackwards;

    return (
        <div className={`mt-3 rounded-control px-3 py-2 text-sm ring-1 ${breached
            ? 'bg-red-50 dark:bg-red-950/30 ring-red-300 dark:ring-red-900'
            : 'bg-surface-muted ring-hairline'}`}>

            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="text-ink-faint text-xs">
                    on {money(verdict.capital)}
                </span>

                {risk != null && (
                    <Stat label="Risk" value={money(risk)} pct={riskPctOfCapital}
                        limit={limits.riskPct} breached={breaches.risk} />
                )}
                {position != null && (
                    <Stat label="Position" value={money(position)} pct={positionPctOfCapital}
                        limit={limits.maxPositionPct} breached={breaches.position} />
                )}
                {/* Only when a target was actually set. A trailing stop has none. */}
                {rr != null && (
                    <span className="text-ink-muted">
                        R:R <span className={`font-semibold tabular-nums ${rr >= 2 ? 'text-green-600 dark:text-green-400' : 'text-ink'}`}>
                            {rr.toFixed(2)}:1
                        </span>
                    </span>
                )}
            </div>

            {breaches.stopBackwards && (
                <Warn>The stop is on the wrong side of the entry.</Warn>
            )}
            {breaches.risk && (
                <Warn>
                    This risks {riskPctOfCapital.toFixed(1)}% of the account. You set {limits.riskPct}%.
                </Warn>
            )}
            {breaches.position && !breaches.risk && (
                <Warn>
                    {positionPctOfCapital.toFixed(1)}% of the account in one name. Your cap is {limits.maxPositionPct}%.
                </Warn>
            )}
        </div>
    );
}

function Stat({ label, value, pct, limit, breached }) {
    return (
        <span className="text-ink-muted">
            {label}{' '}
            <span className={`font-semibold tabular-nums ${breached ? 'text-red-600 dark:text-red-400' : 'text-ink'}`}>
                {value}
            </span>
            {pct != null && (
                <span className="text-ink-faint tabular-nums">
                    {' '}· {pct.toFixed(1)}%{limit != null && ` of ${limit}%`}
                </span>
            )}
        </span>
    );
}

function Warn({ children }) {
    return (
        <p className="flex items-start gap-1.5 mt-1.5 text-xs text-red-700 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{children}</span>
        </p>
    );
}

export default RiskVerdict;
