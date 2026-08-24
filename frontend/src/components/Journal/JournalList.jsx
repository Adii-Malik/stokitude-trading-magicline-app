import { formatCurrency, getPnLColorClass } from '../../utils/portfolioUtils';

/**
 * The finding column, not the whole trade.
 *
 * Everything a trade knows now lives in the pane beside this, so a row carries
 * only what you need to pick one out: the symbol, one line of context, the
 * money and the date. Height is uniform on purpose - when every row was a card
 * that grew to fit its notes, a live position with a stop about to trigger
 * rendered the same size as a level nobody had looked at since January.
 *
 * State is the colour of the left edge rather than a pill. Amber means a level
 * has printed and it wants a decision today; green and red are simply won and
 * lost, which the signed number already said - the edge is what makes it
 * scannable without reading.
 */
const shortDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—');
const num = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n);

/** Amber: price has reached a level on this trade and nothing has been decided. */
export const needsYou = (e) => e.status === 'open' && (e.stopHit || e.targets?.some((t) => t.isHit));

const edge = (e) => {
    if (needsYou(e)) return 'border-l-amber-500';
    if (e.status === 'open') return 'border-l-cyan-500';
    if (e.outcome === 'win') return 'border-l-green-500';
    if (e.outcome === 'loss') return 'border-l-red-500';
    return 'border-l-hairline';
};

/** One line of why this row looks the way it does. */
function context(e) {
    if (needsYou(e)) {
        if (e.stopHit) return 'stop reached — still open';
        const hit = e.targets.filter((t) => t.isHit).pop();
        return `target ${hit.level} reached`;
    }
    if (e.status === 'open') {
        return `${num(e.quantity)} @ ${num(e.entryPrice)}`
            + (e.rMultiple != null ? ` · ${e.rMultiple.toFixed(1)}R` : '');
    }
    // exitReason is derived from the exit against the levels, so it is a reading
    // of the record rather than something anyone typed.
    return [e.exitReason, e.rMultiple != null ? `${e.rMultiple.toFixed(1)}R` : null]
        .filter(Boolean).join(' · ') || 'closed';
}

export default function JournalList({ entries, selectedId, onSelect, emptyHint, grouped }) {
    if (!entries.length) {
        return (
            <div className="p-10 text-center text-sm text-ink-faint">
                {emptyHint || 'No trades journaled yet. Log one to start building the record.'}
            </div>
        );
    }

    // A filter pill already says what you are looking at, so headings only earn
    // their space when every state is on screen at once.
    const groups = grouped
        ? [
            ['Open', entries.filter((e) => e.status === 'open')],
            ['Closed', entries.filter((e) => e.status === 'closed')]
        ].filter(([, list]) => list.length)
        : [[null, entries]];

    return (
        <div>
            {groups.map(([heading, list]) => (
                <div key={heading || 'all'}>
                    {heading && (
                        <div className="flex items-center px-4 py-2 text-xs font-bold uppercase
                            tracking-wider text-ink-faint bg-surface-muted border-y border-hairline">
                            {heading}
                            <span className="ml-auto tracking-normal opacity-70">{list.length}</span>
                        </div>
                    )}
                    {list.map((e) => {
                        const money = e.status === 'closed' ? e.netPnL : e.unrealizedPnL;
                        return (
                            <button key={e._id} onClick={() => onSelect(e)}
                                className={`w-full text-left grid grid-cols-[1fr_auto] gap-x-3 px-4 py-3
                                    border-b border-hairline/70 border-l-[3px] items-baseline
                                    hover:bg-surface-muted transition-colors ${edge(e)}
                                    ${selectedId === e._id ? 'bg-cyan-500/10' : ''}`}>
                                <span className={`font-bold text-base ${selectedId === e._id ? 'text-cyan-600 dark:text-cyan-400' : 'text-ink'}`}>
                                    {e.symbol}
                                </span>
                                <span className={`text-right font-bold text-sm tabular-nums ${money != null ? getPnLColorClass(money) : 'text-ink-faint'}`}>
                                    {money != null ? formatCurrency(money, e.currency, { signed: true }) : '—'}
                                </span>
                                <span className={`text-xs truncate mt-0.5 ${needsYou(e) ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-ink-faint'}`}>
                                    {context(e)}
                                </span>
                                <span className="text-xs text-ink-faint text-right tabular-nums whitespace-nowrap mt-0.5">
                                    {shortDate(e.exitDate || e.entryDate)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
