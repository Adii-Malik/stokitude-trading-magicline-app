import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * The rail while a trade is being closed.
 *
 * Sizing is history by now, so it stops advising and starts reporting: what the
 * trade made, what that was worth against what was risked, and the plan set on
 * the way in beside the trade actually taken.
 *
 * The thesis comes back rather than a second note being asked for. It was
 * written before the outcome was known, which is the only reason it is worth
 * reading now, and a fresh text box here was a worse version of the lesson.
 */
export function ResultRail({ metrics, plan, thesis, currency = 'PKR' }) {
    const pnl = metrics?.netPnL;
    const up = pnl != null && pnl >= 0;
    const money = (n) => `${currency} ${Math.abs(Math.round(n)).toLocaleString()}`;

    return (
        <div className="flex flex-col gap-5">
            {pnl != null && (
                <section>
                    <Head>{up ? 'Made' : 'Lost'}</Head>
                    <div className={`rounded-card bg-surface px-3.5 py-3 ring-1
                        ${up ? 'ring-green-600/40' : 'ring-red-500/40'}`}>
                        <p className={`flex items-center gap-1.5 text-2xl font-extrabold tracking-tight
                            tabular-nums leading-none ${up ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {up ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                            {up ? '+' : '−'}{money(pnl)}
                        </p>
                        {metrics.pnlPct != null && (
                            <p className="mt-1.5 text-xs text-ink-muted tabular-nums">
                                {metrics.pnlPct >= 0 ? '+' : ''}{metrics.pnlPct.toFixed(1)}% on what you put in
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* The one number that compares this trade with a smaller one. */}
            {metrics?.rMultiple != null && (
                <p className="flex items-baseline justify-between gap-2 rounded-control
                              bg-surface ring-1 ring-hairline px-3 py-2.5">
                    <span className="text-xs font-semibold text-ink-muted">Against what you risked</span>
                    <span className={`text-lg font-extrabold tabular-nums ${metrics.rMultiple >= 0
                        ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {metrics.rMultiple >= 0 ? '+' : ''}{metrics.rMultiple.toFixed(2)}R
                    </span>
                </p>
            )}

            {plan?.length > 0 && (
                <section>
                    <Head>Against the plan</Head>
                    <dl className="flex flex-col">
                        {plan.map(({ k, v, mute }) => (
                            <div key={k} className="flex justify-between gap-3 py-1.5 text-xs
                                                    border-b border-hairline last:border-b-0">
                                <dt className="text-ink-muted">{k}</dt>
                                <dd className={`tabular-nums ${mute ? 'text-ink-faint' : 'font-semibold text-ink'}`}>{v}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}

            {thesis && (
                <section>
                    <Head>You wrote on the way in</Head>
                    <p className="rounded-control bg-surface ring-1 ring-hairline px-3 py-2.5
                                  text-xs italic leading-relaxed text-ink-muted">
                        {thesis}
                    </p>
                </section>
            )}

        </div>
    );
}

function Head({ children }) {
    return (
        <h4 className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-faint mb-1.5">
            {children}
        </h4>
    );
}

export default ResultRail;
