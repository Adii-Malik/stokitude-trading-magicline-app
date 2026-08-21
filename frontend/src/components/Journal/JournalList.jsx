import { useState } from 'react';
import { Pencil, Trash2, ShieldCheck, HelpCircle, Bell, AlertTriangle, BookMarked } from 'lucide-react';
import { formatCurrency, formatPercent, getPnLColorClass } from '../../utils/portfolioUtils';
import { mistakeLabel } from './labels';

const shortDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

export default function JournalList({ entries, onEdit, onDelete, onTake, onClose, onCancel, emptyHint }) {
    if (!entries.length) {
        return (
            <div className="text-center py-12 text-ink-muted">
                {emptyHint || 'No trades journaled yet. Log one to start building the record.'}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {entries.map((e) => (
                <div key={e._id}
                    className="bg-surface rounded-card shadow-card ring-1 ring-hairline p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-ink">{e.symbol}</span>
                                <Tag>{e.exchange}</Tag>
                                <Tag>{e.direction}</Tag>
                                {e.status === 'planned'
                                    ? <Tag tone="amber">Watching</Tag>
                                    : e.status === 'cancelled'
                                        ? <Tag tone="gray">Never triggered</Tag>
                                        : e.status === 'open'
                                            ? <Tag tone="blue">Open</Tag>
                                            : <Tag tone={e.outcome === 'win' ? 'green' : e.outcome === 'loss' ? 'red' : 'gray'}>
                                                {e.outcome}
                                            </Tag>}
                                {e.status === 'planned' && e.entryZoneHit && (
                                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                        <Bell className="w-3.5 h-3.5" /> zone reached
                                    </span>
                                )}
                                {e.status === 'open' && e.stopHit && (
                                    <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                                        <AlertTriangle className="w-3.5 h-3.5" /> stop reached
                                    </span>
                                )}
                                {/* Booked means the numbers came from the ledger, not from memory. */}
                                {e.entryTransactionId && (
                                    <span className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400"
                                        title="Recorded in a portfolio ledger">
                                        <BookMarked className="w-3.5 h-3.5" /> booked
                                    </span>
                                )}
                                {e.followedPlan && (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                        <ShieldCheck className="w-3.5 h-3.5" /> followed plan
                                    </span>
                                )}
                                {e.status === 'closed' && !e.exitConfirmed && (
                                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                        <HelpCircle className="w-3.5 h-3.5" /> unconfirmed
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-ink-muted mt-1">
                                {e.status === 'cancelled' ? (
                                    <>Watched {zoneLabel(e)} · never entered</>
                                ) : e.status === 'planned' ? (
                                    <>
                                        Waiting for {zoneLabel(e)}
                                        {e.quantity ? ` · ${e.quantity} planned` : ''}
                                        {e.plannedRR != null && ` · ${e.plannedRR.toFixed(1)}:1`}
                                    </>
                                ) : (
                                    <>
                                        {e.quantity} @ {e.entryPrice} · {shortDate(e.entryDate)}
                                        {e.status === 'closed'
                                            ? ` → ${e.exitPrice} · ${shortDate(e.exitDate)}`
                                            : e.lastPrice != null && ` · last ${e.lastPrice}`}
                                        {e.datesEstimated && <span className="text-amber-600 dark:text-amber-400"> · dates estimated</span>}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {e.status === 'closed' ? (
                                <div className="text-right">
                                    <div className={`font-bold ${getPnLColorClass(e.netPnL)}`}>
                                        {formatCurrency(e.netPnL, e.currency, { signed: true })}
                                    </div>
                                    <div className="text-xs text-ink-faint">
                                        {formatPercent(e.pnlPct, 2, { signed: true })}
                                        {e.rMultiple != null && ` · ${e.rMultiple.toFixed(2)}R`}
                                    </div>
                                </div>
                            ) : e.unrealizedPnL != null && (
                                <div className="text-right">
                                    <div className={`font-bold ${getPnLColorClass(e.unrealizedPnL)}`}>
                                        {formatCurrency(e.unrealizedPnL, e.currency, { signed: true })}
                                    </div>
                                    <div className="text-xs text-ink-faint">
                                        {formatPercent(e.unrealizedPct, 2, { signed: true })} · unrealized
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-1">
                                {/* The one action each stage actually needs next. */}
                                {e.status === 'planned' && (
                                    <>
                                        <button onClick={() => onTake(e)} className={actionPrimary}>
                                            I took it
                                        </button>
                                        <button onClick={() => onCancel(e)} title="Never triggered — keep the record"
                                            className={actionQuiet}>
                                            Didn&apos;t trigger
                                        </button>
                                    </>
                                )}
                                {e.status === 'open' && (
                                    <button onClick={() => onClose(e)} className={actionPrimary}>
                                        Close it
                                    </button>
                                )}
                                <button onClick={() => onEdit(e)} title="Edit"
                                    className="p-2 text-ink-faint hover:text-cyan-600 hover:bg-surface-muted rounded-control">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => onDelete(e)} title="Delete"
                                    className="p-2 text-ink-faint hover:text-red-600 hover:bg-surface-muted rounded-control">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {(e.status === 'planned' || e.status === 'open') && <Levels entry={e} />}

                    {e.mistakes?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {e.mistakes.map((m) => (
                                <span key={m} className="px-2 py-0.5 rounded-full text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                    {mistakeLabel(m)}
                                </span>
                            ))}
                        </div>
                    )}

                    {e.notes && <Notes text={e.notes} />}
                    {e.lesson && (
                        <p className="text-sm mt-2 pl-3 border-l-2 border-cyan-400 text-ink-muted italic">
                            {e.lesson}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

const actionPrimary = 'px-2.5 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300 border ' +
    'border-cyan-300 dark:border-cyan-700 rounded-control hover:bg-cyan-50 dark:hover:bg-cyan-900/30 whitespace-nowrap';
const actionQuiet = 'px-2.5 py-1 text-xs text-ink-muted border border-hairline rounded-control ' +
    'hover:bg-surface-muted whitespace-nowrap';

const num = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n);

/** The zone a planned trade waits for. One bound means an exact level. */
function zoneLabel(e) {
    const bounds = [e.entryFrom, e.entryTo].filter((n) => n != null);
    if (!bounds.length) return 'no level set';
    const [lo, hi] = [Math.min(...bounds), Math.max(...bounds)];
    return lo === hi ? num(lo) : `${num(lo)} – ${num(hi)}`;
}

/**
 * The stop and targets, and which of them price has already reached. This is the
 * whole reason the poll watches these entries, so it belongs on the card rather
 * than behind an edit click.
 */
function Levels({ entry }) {
    const { plannedStop, stopHit, targets = [] } = entry;
    if (plannedStop == null && !targets.length) return null;

    return (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {plannedStop != null && (
                <span className={`px-2 py-0.5 rounded text-xs ${stopHit
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                    : 'bg-surface-muted text-ink-muted'}`}>
                    SL {num(plannedStop)}{stopHit && ' ✓'}
                </span>
            )}
            {targets.map((t) => (
                <span key={t.level}
                    className={`px-2 py-0.5 rounded text-xs ${t.isHit
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : 'bg-surface-muted text-ink-muted'}`}>
                    T{t.level} {num(t.price)}{t.isHit && ' ✓'}
                </span>
            ))}
        </div>
    );
}

/** Long notes are the point of a journal, but they shouldn't bury the list. */
function Notes({ text, limit = 150 }) {
    const [open, setOpen] = useState(false);
    const long = text.length > limit;

    return (
        <p className="text-sm text-ink-muted mt-3 whitespace-pre-wrap">
            {open || !long ? text : `${text.slice(0, limit).trimEnd()}…`}
            {long && (
                <button onClick={() => setOpen(!open)}
                    className="ml-1 text-cyan-600 dark:text-cyan-400 hover:underline">
                    {open ? 'less' : 'more'}
                </button>
            )}
        </p>
    );
}

function Tag({ children, tone = 'gray' }) {
    const tones = {
        gray: 'bg-surface-muted text-ink-muted',
        green: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
        red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
        blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
        amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
    };
    return <span className={`px-2 py-0.5 rounded text-xs ${tones[tone]}`}>{children}</span>;
}
