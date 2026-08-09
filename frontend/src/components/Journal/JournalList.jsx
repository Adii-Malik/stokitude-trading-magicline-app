import { useState } from 'react';
import { Pencil, Trash2, ShieldCheck, HelpCircle } from 'lucide-react';
import { formatCurrency, formatPercent, getPnLColorClass } from '../../utils/portfolioUtils';
import { mistakeLabel } from './labels';

const shortDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

export default function JournalList({ entries, onEdit, onDelete, emptyHint }) {
    if (!entries.length) {
        return (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                {emptyHint || 'No trades journaled yet. Log one to start building the record.'}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {entries.map((e) => (
                <div key={e._id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 dark:text-white">{e.symbol}</span>
                                <Tag>{e.exchange}</Tag>
                                <Tag>{e.direction}</Tag>
                                {e.status === 'open'
                                    ? <Tag tone="blue">Open</Tag>
                                    : <Tag tone={e.outcome === 'win' ? 'green' : e.outcome === 'loss' ? 'red' : 'gray'}>
                                        {e.outcome}
                                    </Tag>}
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
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {e.quantity} @ {e.entryPrice} · {shortDate(e.entryDate)}
                                {e.status === 'closed'
                                    ? ` → ${e.exitPrice} · ${shortDate(e.exitDate)}`
                                    : e.markPrice != null && ` · marked ${e.markPrice}`}
                                {e.datesEstimated && <span className="text-amber-600 dark:text-amber-400"> · dates estimated</span>}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {e.status === 'closed' ? (
                                <div className="text-right">
                                    <div className={`font-bold ${getPnLColorClass(e.netPnL)}`}>
                                        {formatCurrency(e.netPnL, e.currency, { signed: true })}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatPercent(e.pnlPct, 2, { signed: true })}
                                        {e.rMultiple != null && ` · ${e.rMultiple.toFixed(2)}R`}
                                    </div>
                                </div>
                            ) : e.unrealizedPnL != null && (
                                <div className="text-right">
                                    <div className={`font-bold ${getPnLColorClass(e.unrealizedPnL)}`}>
                                        {formatCurrency(e.unrealizedPnL, e.currency, { signed: true })}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatPercent(e.unrealizedPct, 2, { signed: true })} · unrealized
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-1">
                                <button onClick={() => onEdit(e)} title="Edit"
                                    className="p-2 text-gray-500 hover:text-cyan-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => onDelete(e)} title="Delete"
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

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
                        <p className="text-sm mt-2 pl-3 border-l-2 border-cyan-400 text-gray-700 dark:text-gray-300 italic">
                            {e.lesson}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

/** Long notes are the point of a journal, but they shouldn't bury the list. */
function Notes({ text, limit = 150 }) {
    const [open, setOpen] = useState(false);
    const long = text.length > limit;

    return (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 whitespace-pre-wrap">
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
        gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
        green: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
        red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
        blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
    };
    return <span className={`px-2 py-0.5 rounded text-xs ${tones[tone]}`}>{children}</span>;
}
