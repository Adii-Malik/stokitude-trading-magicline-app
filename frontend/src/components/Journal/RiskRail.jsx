import { AlertTriangle } from 'lucide-react';
import { FIELD } from '../../ui/field';

/**
 * The book, what it holds, and what follows from it.
 *
 * One block in two placements: a column beside the form on a wide screen, and
 * dropped into the form right after the stop on a phone. Not two designs.
 *
 * It grades, never blocks. With entry, stop and size all given there is nothing
 * left to compute - what was missing is a yardstick, and "risk 4,000" means
 * nothing until it is said as a share of the account it sits against. A trade
 * that broke your own rule still saves: refusing it only means the entry most
 * worth re-reading never gets written.
 */
export function RiskRail({
    books, portfolioId, onPickBook, locked,
    capital, verdict, suggested, currency = 'PKR', onUseSuggested
}) {
    const money = (n) => Math.round(n).toLocaleString();
    const breached = verdict?.breaches
        && (verdict.breaches.risk || verdict.breaches.position || verdict.breaches.stopBackwards);

    return (
        <div className="flex flex-col gap-5">
            <section>
                <Head>Book</Head>
                <select
                    value={portfolioId} disabled={locked} className={FIELD}
                    onChange={(e) => onPickBook(e.target.value)}
                >
                    <option value="">Journal only — no book</option>
                    {books.map((b) => (
                        <option key={b._id} value={b._id}>{b.name} · {b.currency}</option>
                    ))}
                </select>
                {capital != null ? (
                    <>
                        <p className="mt-2 text-xl font-bold text-ink tabular-nums">{money(capital)}</p>
                        <p className="text-xs text-ink-faint">Valued now. The risk is measured against this.</p>
                    </>
                ) : (
                    <p className="mt-2 text-xs text-ink-faint">
                        Name a book and its balance becomes the yardstick.
                    </p>
                )}
            </section>

            {suggested && (
                <section>
                    <Head>Buy</Head>
                    <div className="rounded-card bg-surface ring-1 ring-green-600/40 dark:ring-green-400/40 px-3.5 py-3">
                        <p className="text-3xl font-extrabold tracking-tight tabular-nums
                                      text-green-700 dark:text-green-400 leading-none">
                            {suggested.shares.toLocaleString()}
                            <span className="ml-1.5 text-sm font-semibold text-ink-muted">shares</span>
                        </p>
                        {/* Which of the two rules bound is the useful half: it is the
                            one to argue with, and a single number cannot say. */}
                        <p className="mt-1.5 text-xs text-ink-muted">
                            {suggested.cappedBy === 'allocation'
                                ? `Held to your position cap. Risk alone would have allowed ${suggested.byRisk.toLocaleString()}.`
                                : `Sized to your risk per trade. Your cap would have allowed ${suggested.byAllocation.toLocaleString()}.`}
                        </p>
                        {onUseSuggested && (
                            <button type="button" onClick={() => onUseSuggested(suggested.shares)}
                                className="mt-2.5 px-3 py-1.5 rounded-control bg-cyan-500 hover:bg-cyan-600
                                           text-white text-xs font-bold">
                                Use {suggested.shares.toLocaleString()}
                            </button>
                        )}
                    </div>
                </section>
            )}

            {verdict?.capital != null && (verdict.risk != null || verdict.position != null) && (
                <section className="flex flex-col gap-3.5">
                    <Meter
                        label="If the stop hits, you lose" currency={currency}
                        amount={verdict.risk}
                        pct={verdict.riskPctOfCapital} limit={verdict.limits.riskPct}
                        breached={verdict.breaches.risk}
                    />
                    <Meter
                        label="Money in this one stock" currency={currency}
                        amount={verdict.position}
                        pct={verdict.positionPctOfCapital} limit={verdict.limits.maxPositionPct}
                        breached={verdict.breaches.position}
                    />
                    {/* Only when a target was set. A trailing stop has none, and a
                        made-up one would put fiction into every R:R reported. */}
                    {verdict.rr != null && (
                        <p className="flex justify-between text-xs">
                            <span className="text-ink-muted font-semibold">For every 1 risked, you make</span>
                            <span className={`font-bold tabular-nums ${verdict.rr >= 2 ? 'text-green-700 dark:text-green-400' : 'text-ink'}`}>
                                {verdict.rr.toFixed(2)}
                            </span>
                        </p>
                    )}
                </section>
            )}

            {breached && (
                <p className="flex gap-2 rounded-control bg-red-50 dark:bg-red-950/30
                              ring-1 ring-red-200 dark:ring-red-900 px-3 py-2.5
                              text-xs text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                    {/* Say the numbers rather than the rule. "Past your own limit"
                        makes you go back and work out which one and by how much. */}
                    <span>
                        <strong className="block font-bold">
                            {verdict.breaches.stopBackwards
                                ? 'The stop is on the wrong side of the entry'
                                : verdict.breaches.risk
                                    ? `This risks ${verdict.riskPctOfCapital.toFixed(1)}% of the book, not ${verdict.limits.riskPct}%`
                                    : `This puts ${verdict.positionPctOfCapital.toFixed(1)}% of the book in one stock, not ${verdict.limits.maxPositionPct}%`}
                        </strong>
                        {verdict.breaches.stopBackwards
                            ? 'A long stops below the entry, a short above it.'
                            : 'You can still save it — it will be marked as a trade you sized past your own rule.'}
                    </span>
                </p>
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

/**
 * One number said three ways: the money, the share of the book, and where that
 * share sits against the line you drew. The bar is the fastest of the three to
 * read, so the limit is drawn on it rather than described beneath it.
 */
function Meter({ label, amount, pct, limit, breached, currency }) {
    if (amount == null) return null;
    const span = Math.max(limit ?? 0, pct ?? 0, 1) * 1.15;
    const at = (v) => `${Math.min((v / span) * 100, 100)}%`;
    return (
        <div>
            <p className="text-xs text-ink-muted font-semibold">{label}</p>
            <p className="flex items-baseline justify-between gap-2 mt-0.5">
                <span className={`text-base font-bold tabular-nums ${breached ? 'text-red-600 dark:text-red-400' : 'text-ink'}`}>
                    {currency} {Math.round(amount).toLocaleString()}
                </span>
                {pct != null && (
                    <span className="text-xs text-ink-faint tabular-nums">
                        {pct.toFixed(1)}% of the book
                    </span>
                )}
            </p>
            <div className="relative h-2 mt-1.5 rounded-full bg-surface-muted ring-1 ring-hairline overflow-hidden">
                <span
                    className={`absolute inset-y-0 left-0 rounded-full ${breached ? 'bg-red-500' : 'bg-green-600 dark:bg-green-400'}`}
                    style={{ width: at(pct ?? 0) }}
                />
                {limit != null && (
                    <span className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-ink/60 rounded-sm" style={{ left: at(limit) }} />
                )}
            </div>
            {limit != null && (
                <p className={`mt-1 text-[11px] tabular-nums ${breached ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-ink-faint'}`}>
                    {breached
                        ? `Over the ${limit}% you allow yourself`
                        : `The mark is your ${limit}% limit`}
                </p>
            )}
        </div>
    );
}

export default RiskRail;
