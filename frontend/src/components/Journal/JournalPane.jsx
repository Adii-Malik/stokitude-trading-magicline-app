import { Pencil, Trash2, BookMarked } from 'lucide-react';
import { formatCurrency, formatPercent, getPnLColorClass } from '../../utils/portfolioUtils';

/**
 * One trade, with room.
 *
 * The note, the lesson and the chart are the parts of a journal that a list can
 * never hold, and they used to be squeezed into a card or hidden behind a click.
 * Here they get the whole right-hand side, and the list beside them gets to be
 * thin because of it.
 */
const num = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n);
const longDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null);

/** Whole days held, or null while the trade is still running. */
function heldFor(entry) {
    if (!entry.exitDate || !entry.entryDate) return null;
    const days = Math.round((new Date(entry.exitDate) - new Date(entry.entryDate)) / 86400000);
    return days === 1 ? '1 day' : `${days} days`;
}

/**
 * The derived exit, spelled out with the evidence behind it.
 *
 * Shown as a sentence rather than a label because it is the app's reading of the
 * record, not a claim the trader made — and a conclusion that shows its working
 * can be argued with, which is the point.
 */
function exitStory(entry) {
    if (entry.status !== 'closed') return null;
    const hit = (entry.targets || []).filter((t) => t.isHit).pop();

    if (entry.exitReason === 'stop hit') {
        return <><b className="text-ink">Stop hit</b> — exited at {num(entry.exitPrice)} against your stop of {num(entry.plannedStop)}.</>;
    }
    if (entry.exitReason === 'target hit') {
        return <><b className="text-ink">Target hit</b> — exited at {num(entry.exitPrice)}, at or beyond the level you wrote.</>;
    }
    if (entry.exitReason === 'closed early') {
        return (
            <>
                <b className="text-ink">Closed early</b> — exited at {num(entry.exitPrice)}
                {hit ? <>. T{hit.level} was {num(hit.price)} and was reached{hit.hitDate ? ` on ${longDate(hit.hitDate)}` : ''}.</>
                    : entry.plannedStop != null ? <>, above your stop of {num(entry.plannedStop)} and short of your target.</> : '.'}
            </>
        );
    }
    return <><b className="text-ink">Closed</b> — no stop or target was recorded, so there is nothing to compare the exit against.</>;
}

export default function JournalPane({ entry, portfolioName, onEdit, onDelete, onClose }) {
    if (!entry) {
        return (
            <div className="bg-surface rounded-card ring-1 ring-hairline min-h-[300px]
                flex flex-col items-center justify-center gap-2 text-center p-8">
                <BookMarked className="w-7 h-7 text-ink-faint" />
                <p className="font-semibold text-ink-muted">Pick a trade to read it</p>
                <p className="text-sm text-ink-faint max-w-[36ch]">
                    The note, the lesson and the chart live here — the parts of a journal that
                    never fit in a list.
                </p>
            </div>
        );
    }

    const closed = entry.status === 'closed';
    const money = closed ? entry.netPnL : entry.unrealizedPnL;
    const pct = closed ? entry.pnlPct : entry.unrealizedPct;
    const held = heldFor(entry);

    return (
        <div className="bg-surface rounded-card ring-1 ring-hairline p-4 md:p-5 flex flex-col gap-4 min-w-0">
            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0">
                    <h2 className="text-2xl font-extrabold tracking-tight text-ink leading-none">{entry.symbol}</h2>
                    <p className="text-xs text-ink-faint mt-1">
                        {[entry.exchange, entry.direction === 'short' ? 'Short' : 'Long',
                            [longDate(entry.entryDate), longDate(entry.exitDate)].filter(Boolean).join(' → '),
                            held, portfolioName].filter(Boolean).join(' · ')}
                    </p>
                </div>
                <div className="ml-auto text-right">
                    <div className={`text-2xl font-extrabold tabular-nums tracking-tight leading-none ${money != null ? getPnLColorClass(money) : 'text-ink-faint'}`}>
                        {money != null ? formatCurrency(money, entry.currency, { signed: true }) : '—'}
                    </div>
                    <div className="text-xs text-ink-faint tabular-nums mt-1">
                        {pct != null && formatPercent(pct, 1, { signed: true })}
                        {entry.rMultiple != null ? ` · ${entry.rMultiple.toFixed(2)}R`
                            : entry.plannedStop == null ? ' · no R — no stop was set' : ''}
                        {!closed && ' · unrealized'}
                    </div>
                </div>
                <div className="flex gap-1.5">
                    {!closed && (
                        <button onClick={() => onClose(entry)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-control bg-cyan-500 text-white hover:bg-cyan-600">
                            Close it
                        </button>
                    )}
                    <button onClick={() => onEdit(entry)} title="Edit"
                        className="p-2 text-ink-faint hover:text-cyan-600 border border-hairline rounded-control">
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(entry)} title="Delete"
                        className="p-2 text-ink-faint hover:text-red-600 border border-hairline rounded-control">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {closed && (
                <p className="bg-surface-muted rounded-control px-3 py-2.5 text-sm text-ink-muted border-l-[3px] border-hairline">
                    {exitStory(entry)}
                </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Fact k="Entry" v={`${num(entry.quantity)} @ ${num(entry.entryPrice)}`} />
                <Fact k={closed ? 'Exit' : 'Last price'}
                    v={closed ? num(entry.exitPrice) : entry.lastPrice != null ? num(entry.lastPrice) : '—'} />
                <Fact k="Planned stop" v={entry.plannedStop != null ? num(entry.plannedStop) : 'none set'}
                    faint={entry.plannedStop == null} />
                <Fact k="Fees" v={[entry.fees, entry.exitFees].filter((f) => f).map(num).join(' · ') || '—'} />
            </div>

            {(entry.plannedStop != null || entry.targets?.length > 0) && (
                <Section label="Levels">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                        {entry.plannedStop != null && (
                            <Chip tone={entry.stopHit ? 'red' : 'plain'}>
                                SL {num(entry.plannedStop)}{entry.stopHit && ' ✓'}
                            </Chip>
                        )}
                        {(entry.targets || []).map((t) => (
                            <Chip key={t.level} tone={t.isHit ? 'green' : 'plain'}>
                                T{t.level} {num(t.price)}{t.isHit && ' ✓'}
                            </Chip>
                        ))}
                    </div>
                </Section>
            )}

            {entry.whatHappened?.length > 0 && (
                <Section label="Tracking">
                    <div className="flex flex-wrap gap-1.5">
                        {entry.whatHappened.map((t) => (
                            <span key={t} className="px-2.5 py-1 rounded-control text-xs bg-cyan-500 text-white font-medium">
                                {t}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {entry.chartUrl && (
                <a href={entry.chartUrl} target="_blank" rel="noreferrer" className="block">
                    <img src={entry.chartUrl} alt={`${entry.symbol} setup`}
                        className="w-full max-h-72 object-contain rounded-control ring-1 ring-hairline bg-surface-muted" />
                </a>
            )}

            {(entry.notes || entry.lesson) && (
                <div className="flex flex-col gap-2.5 text-sm text-ink-muted">
                    {entry.notes && <p className="whitespace-pre-wrap">{entry.notes}</p>}
                    {entry.lesson && (
                        <p className="border-l-2 border-cyan-400 pl-3 text-ink italic">{entry.lesson}</p>
                    )}
                </div>
            )}
        </div>
    );
}

function Fact({ k, v, faint }) {
    return (
        <div className="bg-surface-muted rounded-control px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{k}</div>
            <div className={`text-sm font-bold tabular-nums ${faint ? 'text-ink-faint' : 'text-ink'}`}>{v}</div>
        </div>
    );
}

function Section({ label, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">{label}</span>
            {children}
        </div>
    );
}

function Chip({ tone, children }) {
    const tones = {
        plain: 'bg-surface-muted text-ink-muted ring-hairline',
        green: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-green-500/35',
        red: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-red-500/35'
    };
    return <span className={`px-2 py-0.5 rounded ring-1 tabular-nums ${tones[tone]}`}>{children}</span>;
}
