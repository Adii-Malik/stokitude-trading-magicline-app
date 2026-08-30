import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bookmark, RefreshCw, Check, X, ArrowUpRight, ChevronDown, Target, Search, Undo2
} from 'lucide-react';
import { useWatchlist } from '../../contexts/WatchlistContext';
import { ChartUpload } from '../common/ChartUpload';
import { pct, tone, toSlug } from '../Heatmap/heatmapData';
import { TIMEFRAMES } from '../Heatmap/heatmapConfig';
import { split, matches, dueText, daysSince, lastLookAt, meterFor, hasFired } from './horizons';

const labelOf = (period) => TIMEFRAMES.find((t) => t.id === period)?.label || period;

const ago = (days) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

const money = (n) => (n == null ? '—' : Number(n).toFixed(2));

/**
 * Today, where you are.
 *
 * Not toISOString().slice(0, 10), which is today in UTC - five hours behind
 * Karachi, so an evening trade would default to yesterday's date and land in the
 * journal on the wrong day.
 */
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Words carry the state; colour only makes it findable at a glance. */
const DUE_PILL = {
    fired: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    late: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    soon: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    calm: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
};

const STRIPE = {
    fired: 'bg-cyan-500',
    late: 'bg-rose-500',
    soon: 'bg-amber-500',
    calm: 'bg-transparent'
};

const CHIP = 'rounded px-1.5 py-0.5 text-[11px] font-medium';
const INPUT = 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const GHOST = 'rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-cyan-500 hover:text-cyan-600 dark:border-gray-600 dark:text-gray-300 dark:hover:text-cyan-400';
const QUIET = 'rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400';

/**
 * How far the name has travelled since you flagged it.
 *
 * Both numbers, not a delta: "since flagged +7.6%" needs you to remember what it
 * was, and the whole point of this screen is that you should not have to.
 */
function Drift({ item }) {
    if (item.perfNow == null || item.perfWhenNoticed == null) {
        return <span className="text-xs text-gray-400 dark:text-gray-500">no quote</span>;
    }
    return (
        <span className="whitespace-nowrap font-mono text-xs tabular-nums text-gray-400 dark:text-gray-500">
            <span className="line-through opacity-70">{pct(item.perfWhenNoticed)}</span>
            {' → '}
            <span className={`font-semibold ${tone(item.perfNow)}`}>{pct(item.perfNow)}</span>
        </span>
    );
}

/**
 * Where price is between the price that kills the idea and the price you are
 * waiting for.
 *
 * Only drawn when both are set, which will be the minority of names. The point
 * of the picture is the case where price has walked past one end: a pin at the
 * edge in red says "this went the wrong way and kept going" faster than any
 * number does.
 */
function Meter({ item }) {
    const m = meterFor(item);
    if (!m) return null;

    const colour = m.past === 'invalidation' ? 'bg-rose-500'
        : m.past === 'trigger' ? 'bg-cyan-500' : 'bg-amber-500';

    return (
        <div className="mt-2.5 max-w-md">
            <div className="relative h-1.5 rounded-full bg-gradient-to-r from-rose-200 via-gray-100 to-cyan-200 dark:from-rose-500/25 dark:via-gray-700 dark:to-cyan-500/25">
                <span className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-gray-800 ${colour}`}
                    style={{ left: `${m.at * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                <span>{money(m.lo.price)} {m.lo.label}</span>
                <span className="font-semibold text-gray-600 dark:text-gray-300">now {money(m.now)}</span>
                <span>{money(m.hi.price)} {m.hi.label}</span>
            </div>
        </div>
    );
}

/** Everything you thought about this name, newest first, with the charts. */
function Thread({ looks }) {
    if (!looks.length) {
        return <p className="py-1 text-sm text-gray-400 dark:text-gray-500">Nothing written down yet.</p>;
    }
    return (
        <div className="flex flex-col gap-2.5 py-1">
            {[...looks].reverse().map((look) => (
                <div key={look.id} className="flex items-start gap-3">
                    {/* No placeholder when there is no chart. An empty box per
                        look was more of the row than the words were. */}
                    {look.chartUrl && (
                        <a href={look.chartUrl} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={look.chartUrl} alt={`Chart from ${new Date(look.at).toDateString()}`}
                                className="h-14 w-24 rounded border border-gray-200 object-cover dark:border-gray-600" />
                        </a>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="font-mono text-[11px] text-gray-400 dark:text-gray-500">
                            {new Date(look.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            {' · '}{ago(daysSince(look.at))}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            {look.note || <span className="italic text-gray-400 dark:text-gray-500">looked, wrote nothing</span>}
                        </p>
                        {(look.trigger || look.invalidation) && (
                            <p className="mt-0.5 font-mono text-[11px] text-gray-400 dark:text-gray-500">
                                {look.trigger && `wake me ${look.trigger.dir} ${money(look.trigger.price)}`}
                                {look.trigger && look.invalidation && ' · '}
                                {look.invalidation && `dead ${look.invalidation.dir} ${money(look.invalidation.price)}`}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

/** The thread, behind a disclosure, wherever a row wants to offer it. */
function ThreadToggle({ looks, label = 'What I thought before' }) {
    const [open, setOpen] = useState(false);
    if (!looks.length) return null;
    return (
        <>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 hover:text-cyan-600 dark:text-gray-500 dark:hover:text-cyan-400">
                {open ? 'Hide' : label}
                <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="mt-1 w-full border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                    <Thread looks={looks} />
                </div>
            )}
        </>
    );
}

/**
 * The alert you set, having gone off.
 *
 * Stated with both numbers because by the time you read it the notification is
 * gone and the price has moved again. "Your level printed" is a reminder; "88.40
 * printed through the 88.00 you named" is something you can act on.
 */
function Fired({ item }) {
    const look = [...(item.looks || [])].reverse().find((l) => l.trigger);
    return (
        <div className="mt-2 inline-flex max-w-full items-start gap-2 rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200">
            <Target className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
                <span className="font-mono font-semibold tabular-nums">{money(item.triggeredPrice)}</span>
                {look?.trigger
                    ? <> printed {look.trigger.dir === 'below' ? 'down through' : 'through'} the <span className="font-mono tabular-nums">{money(look.trigger.price)}</span> you named</>
                    : ' printed through the level you named'}
                {item.triggeredAt && <span className="opacity-70"> · {ago(daysSince(item.triggeredAt))}</span>}
            </span>
        </div>
    );
}

/** A price and a direction, the pair the watcher needs to mean anything. */
function Level({ label, dir, setDir, price, setPrice, first, symbol, onEnter }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            {label}
            <select value={dir} onChange={(e) => setDir(e.target.value)} aria-label={`${label} direction for ${symbol}`}
                className="rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <option value={first}>{first}</option>
                <option value={first === 'above' ? 'below' : 'above'}>{first === 'above' ? 'below' : 'above'}</option>
            </select>
            <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
                placeholder="price" aria-label={`${label} price for ${symbol}`}
                className="w-20 rounded border border-gray-300 bg-white px-2 py-1 font-mono tabular-nums dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
        </span>
    );
}

/**
 * You went and looked. Nothing here is required.
 *
 * Saving with no note and no chart still records that you looked, which resets
 * the clock and is more than the screen knew before. The levels are prefilled
 * from what is armed, so pressing Enter leaves them alone rather than silently
 * clearing them.
 */
function LookForm({ item, onSave, onCancel }) {
    const [note, setNote] = useState('');
    const [chartUrl, setChartUrl] = useState(null);
    const [busy, setBusy] = useState(false);
    const [trigger, setTrigger] = useState(item.trigger ? String(item.trigger.price) : '');
    const [triggerDir, setTriggerDir] = useState(item.trigger?.dir || 'above');
    const [invalid, setInvalid] = useState(item.invalidation ? String(item.invalidation.price) : '');
    const [invalidDir, setInvalidDir] = useState(item.invalidation?.dir || 'below');
    const input = useRef(null);

    useEffect(() => { input.current?.focus(); }, []);

    const levelOf = (v, dir) => {
        if (v.trim() === '') return null;
        const n = Number(v);
        return Number.isNaN(n) ? null : { price: n, dir };
    };

    const save = async () => {
        setBusy(true);
        try {
            await onSave({
                note: note.trim(),
                chartUrl,
                trigger: levelOf(trigger, triggerDir),
                invalidation: levelOf(invalid, invalidDir)
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-2.5 flex flex-col gap-2">
            <ChartUpload value={chartUrl} onChange={setChartUrl} />
            {/* Both optional, and skipping them is the common case. They sit
                after the chart because the record is the thing that matters and
                a price is a convenience on top of it. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                <Level label="Wake me" first="above" symbol={item.symbol} onEnter={save}
                    dir={triggerDir} setDir={setTriggerDir} price={trigger} setPrice={setTrigger} />
                <Level label="Dead" first="below" symbol={item.symbol} onEnter={save}
                    dir={invalidDir} setDir={setInvalidDir} price={invalid} setPrice={setInvalid} />
                <span className="text-gray-400 dark:text-gray-500">both optional</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <input ref={input} type="text" value={note} onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
                    maxLength={280} placeholder="What did you see? Optional."
                    aria-label={`Note for ${item.symbol}`} className={`min-w-0 flex-1 ${INPUT}`} />
                <button type="button" onClick={save} disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:opacity-60">
                    <Check className="h-4 w-4" /> {busy ? 'Saving…' : 'Save look'}
                </button>
                <button type="button" onClick={onCancel}
                    className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    Cancel
                </button>
            </div>
        </div>
    );
}

/**
 * The one place this screen hands over to the journal.
 *
 * It asks for the numbers only the broker knows and invents none of them -
 * putting a fill price in the journal that nobody paid is the mistake the
 * journal's own comments warn about. The stop is prefilled from the price you
 * already said would kill the idea, which is usually the right answer and always
 * editable; the quantity is deliberately blank, because a guess at size is the
 * one that would corrupt every number downstream of it.
 */
function TradeForm({ item, onSave, onCancel }) {
    const [price, setPrice] = useState(item.priceNow != null ? String(item.priceNow) : '');
    const [qty, setQty] = useState('');
    const [stop, setStop] = useState(item.invalidation ? String(item.invalidation.price) : '');
    const [date, setDate] = useState(today());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const first = useRef(null);

    useEffect(() => { first.current?.focus(); }, []);

    const ready = price.trim() !== '' && qty.trim() !== ''
        && Number(price) > 0 && Number(qty) > 0;

    const save = async () => {
        if (!ready) return;
        setBusy(true);
        setError(null);
        try {
            await onSave({
                entryPrice: Number(price),
                quantity: Number(qty),
                entryDate: date,
                plannedStop: stop.trim() === '' ? null : Number(stop)
            });
        } catch (e) {
            setError(e.response?.data?.message || 'Could not log that trade');
            setBusy(false);
        }
    };

    const field = (label, value, set, opts = {}) => (
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            {label}
            <input ref={opts.ref} type={opts.type || 'text'} inputMode={opts.type ? undefined : 'decimal'}
                value={value} onChange={(e) => set(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
                placeholder={opts.placeholder} aria-label={`${label} for ${item.symbol}`}
                className={`w-full font-mono tabular-nums ${INPUT}`} />
        </label>
    );

    return (
        <div className="mt-2.5 max-w-2xl rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/40">
            <p className="mb-2.5 text-xs text-gray-500 dark:text-gray-400">
                The journal takes it from here. Give it what the broker gave you.
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {field('What you paid', price, setPrice, { ref: first, placeholder: '0.00' })}
                {field('How many', qty, setQty, { placeholder: 'shares' })}
                {field('Stop', stop, setStop, { placeholder: 'optional' })}
                {field('When', date, setDate, { type: 'date' })}
            </div>
            {stop.trim() !== '' && item.invalidation && Number(stop) === item.invalidation.price && (
                <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                    Stop taken from the price you said would kill the idea.
                </p>
            )}
            {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={save} disabled={!ready || busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:opacity-50">
                    <Check className="h-4 w-4" /> {busy ? 'Logging…' : 'Log the trade'}
                </button>
                <button type="button" onClick={onCancel}
                    className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    Cancel
                </button>
                {!ready && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        Needs the price and the size.
                    </span>
                )}
            </div>
        </div>
    );
}

/** Symbol, name and today's number - the head of every row, whatever its state. */
function Head({ item, onOpen, right }) {
    return (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <button type="button" onClick={() => onOpen(item)}
                className="font-mono text-[15px] font-semibold tracking-tight text-gray-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400">
                {item.symbol}
            </button>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">{item.name}</span>
            {right}
        </div>
    );
}

/** Sector and timeframe, as the chips that took you here. */
function Origin({ item, onOpen }) {
    return (
        <button type="button" onClick={() => onOpen(item)}
            className="inline-flex items-center gap-1.5 text-gray-400 transition hover:text-cyan-600 dark:text-gray-500 dark:hover:text-cyan-400">
            <span className={`${CHIP} bg-gray-100 dark:bg-gray-700`}>{item.sector}</span>
            <span className={`${CHIP} bg-gray-100 dark:bg-gray-700`}>{labelOf(item.period).toLowerCase()}</span>
        </button>
    );
}

/**
 * One name in the queue, and the one action the whole feature depends on you
 * taking. Open it, paste the chart, press Enter.
 */
function QueueRow({ item, open, setOpen, onLook, onDrop, onOpen, onTrade }) {
    const due = dueText(item);
    const looks = item.looks || [];
    const mode = open?.id === item.id ? open.mode : null;

    return (
        <div className="relative border-t border-gray-200 px-4 py-3 first:border-t-0 dark:border-gray-700">
            <span className={`absolute inset-y-0 left-0 w-[3px] ${STRIPE[due.tone]}`} />

            <Head item={item} onOpen={onOpen} right={
                <>
                    <Drift item={item} />
                    <button type="button" onClick={() => onDrop(item)} title={`Not interested in ${item.symbol}`}
                        className="rounded p-1 text-gray-300 opacity-60 hover:bg-gray-100 hover:text-rose-600 hover:opacity-100 dark:text-gray-600 dark:hover:bg-gray-700">
                        <X className="h-4 w-4" />
                    </button>
                </>
            } />

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <span className={`${CHIP} ${DUE_PILL[due.tone]}`}>{due.text}</span>
                <Origin item={item} onOpen={onOpen} />
                <span className="text-gray-400 dark:text-gray-500">
                    {looks.length
                        ? `${looks.length} look${looks.length === 1 ? '' : 's'} · last ${ago(daysSince(lastLookAt(item)))}`
                        : `flagged ${ago(daysSince(item.noticedAt))}, never looked at`}
                </span>
            </div>

            {hasFired(item) && <Fired item={item} />}
            {!mode && <Meter item={item} />}

            {mode === 'look' && (
                <LookForm item={item} onCancel={() => setOpen(null)}
                    onSave={async (body) => { await onLook(item, body); setOpen(null); }} />
            )}
            {mode === 'trade' && (
                <TradeForm item={item} onCancel={() => setOpen(null)}
                    onSave={(body) => onTrade(item, body)} />
            )}

            {!mode && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setOpen({ id: item.id, mode: 'look' })} className={GHOST}>
                        I looked at this
                    </button>
                    <button type="button" onClick={() => setOpen({ id: item.id, mode: 'trade' })} className={QUIET}>
                        I bought it
                    </button>
                    <ThreadToggle looks={looks} />
                </div>
            )}
        </div>
    );
}

/**
 * A name the watcher closed for you.
 *
 * This row exists because the notification links here. Being told an idea died
 * and finding nothing on the screen is worse than not being told, so the verdict
 * lands where you can read it, with the number that caused it and the thread
 * that led up to it still attached.
 */
function DeadRow({ item, onRevive, onOpen }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const level = item.looks?.slice().reverse().find((l) => l.invalidation)?.invalidation;

    const revive = async () => {
        setBusy(true);
        setError(null);
        try {
            await onRevive(item);
        } catch (e) {
            setError(e.response?.data?.message || 'Could not put that one back');
            setBusy(false);
        }
    };

    return (
        <div className="relative border-t border-gray-200 px-4 py-3 first:border-t-0 dark:border-gray-700">
            <span className="absolute inset-y-0 left-0 w-[3px] bg-rose-500" />
            <Head item={item} onOpen={onOpen} right={<Drift item={item} />} />

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <span className={`${CHIP} ${DUE_PILL.late}`}>idea closed</span>
                <Origin item={item} onOpen={onOpen} />
            </div>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-mono font-semibold tabular-nums">{money(item.invalidatedPrice)}</span>
                {level ? <> printed {level.dir === 'above' ? 'up through' : 'through'} the <span className="font-mono tabular-nums">{money(level.price)}</span> you said would kill it</>
                    : ' printed through the level you said would kill it'}
                {item.invalidatedAt && <span className="text-gray-400 dark:text-gray-500"> · {ago(daysSince(item.invalidatedAt))}</span>}
            </p>

            {error && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={revive} disabled={busy} className={`inline-flex items-center gap-1.5 ${GHOST} disabled:opacity-60`}>
                    <Undo2 className="h-3.5 w-3.5" /> {busy ? 'Putting it back…' : 'I still like it'}
                </button>
                <ThreadToggle looks={item.looks || []} label="Why I liked it" />
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                Putting it back clears that level — you name a new one on the next look.
            </p>
        </div>
    );
}

/** What you passed on, and what you bought. Read, not worked. */
function PastRow({ item, onOpen, onRevive, onJournal }) {
    const traded = item.state === 'traded';
    return (
        <div className="border-t border-gray-200 px-4 py-2.5 first:border-t-0 dark:border-gray-700">
            <Head item={item} onOpen={onOpen} right={
                <span className={`${CHIP} ${traded ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {traded ? 'became a trade' : 'passed on'}
                </span>
            } />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <Origin item={item} onOpen={onOpen} />
                {item.settledAt && (
                    <span className="text-gray-400 dark:text-gray-500">{ago(daysSince(item.settledAt))}</span>
                )}
                {traded && item.journalEntryId ? (
                    <button type="button" onClick={() => onJournal(item)} className={QUIET}>Open in the journal</button>
                ) : (
                    <button type="button" onClick={() => onRevive(item)} className={QUIET}>Watch it again</button>
                )}
                <ThreadToggle looks={item.looks || []} label="What I thought" />
            </div>
        </div>
    );
}

/** One tab. Absent rather than zero: an empty tab is a thing to rule out. */
function Tab({ id, label, count, active, onClick, tone: t }) {
    return (
        <button type="button" onClick={() => onClick(id)} aria-current={active}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}>
            {label}
            <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${t || 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-200'}`}>
                {count}
            </span>
        </button>
    );
}

/**
 * Everything you flagged and have not finished with.
 *
 * The queue is the screen; the other two tabs are answers you look back at. Most
 * in need of you leads, so the top is always the next thing to do, and the order
 * is settled once per load - a queue that re-sorts under the cursor is how you
 * click the wrong row.
 */
export default function WatchlistPage() {
    const navigate = useNavigate();
    const { items, loading, error, reload, unflag, update, look, trade, counts } = useWatchlist();
    const [open, setOpen] = useState(null);
    const [tab, setTab] = useState('queue');
    const [query, setQuery] = useState('');

    // Settled once per load of the data, deliberately.
    const groups = useMemo(() => split(items), [items]);

    const rows = useMemo(
        () => groups[tab].filter((i) => matches(i, query)),
        [groups, tab, query]
    );

    // A tab that empties under you would leave the screen blank with no
    // explanation, so fall back to the queue, which always exists.
    useEffect(() => {
        if (!groups[tab].length && tab !== 'queue') setTab('queue');
    }, [groups, tab]);

    const onLook = (item, body) => look(item.id, body);
    const onDrop = (item) => (item.looks?.length ? update(item.id, { state: 'dropped' }) : unflag(item.id));
    const onRevive = (item) => update(item.id, { state: 'watching' });
    const onOpen = (item) => navigate(`/heatmap/${toSlug(item.sector)}?over=${item.period}`);
    const onJournal = () => navigate('/journal');

    const onTrade = async (item, body) => {
        await trade(item.id, body);
        setOpen(null);
        navigate('/journal');
    };

    const searchable = items.length > 5;

    return (
        <div className="container mx-auto space-y-4 px-4 py-6">
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-4">
                    <div>
                        <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
                            <Bookmark className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                            Shortlist
                        </h1>
                        <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                            Names you flagged off the heatmap, the ones needing a look first.
                            Paste the chart and it remembers what you were looking at.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {counts.due > 0 && (
                            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                                {counts.due} due
                            </span>
                        )}
                        <button type="button" onClick={reload}
                            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 px-4 py-2.5 dark:border-gray-700">
                    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900/50">
                        <Tab id="queue" label="Queue" count={groups.queue.length}
                            active={tab === 'queue'} onClick={setTab} />
                        {groups.dead.length > 0 && (
                            <Tab id="dead" label="Called dead" count={groups.dead.length}
                                active={tab === 'dead'} onClick={setTab}
                                tone="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" />
                        )}
                        {groups.past.length > 0 && (
                            <Tab id="past" label="History" count={groups.past.length}
                                active={tab === 'past'} onClick={setTab} />
                        )}
                    </div>
                    {searchable && (
                        <label className="relative ml-auto">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                                placeholder="Symbol or sector" aria-label="Filter the shortlist"
                                className={`w-48 py-1 pl-8 ${INPUT}`} />
                        </label>
                    )}
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-rose-600 dark:border-gray-700 dark:bg-gray-800 dark:text-rose-400">
                    {error}
                </div>
            )}

            {!error && !rows.length && (
                <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                    <p className="font-medium text-gray-900 dark:text-white">
                        {loading ? 'Reading your shortlist…'
                            : query ? `Nothing here matches “${query}”.`
                                : tab === 'queue' ? 'Nothing flagged yet.' : 'Nothing here.'}
                    </p>
                    {!loading && !query && tab === 'queue' && (
                        <>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Flag a name from a sector and it waits here.
                            </p>
                            <button type="button" onClick={() => navigate('/heatmap')}
                                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                                Open the heatmap <ArrowUpRight className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>
            )}

            {rows.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    {rows.map((item) => (
                        tab === 'queue' ? (
                            <QueueRow key={item.id} item={item} open={open} setOpen={setOpen}
                                onLook={onLook} onDrop={onDrop} onOpen={onOpen} onTrade={onTrade} />
                        ) : tab === 'dead' ? (
                            <DeadRow key={item.id} item={item} onRevive={onRevive} onOpen={onOpen} />
                        ) : (
                            <PastRow key={item.id} item={item} onOpen={onOpen}
                                onRevive={onRevive} onJournal={onJournal} />
                        )
                    ))}
                </div>
            )}

            {tab === 'queue' && rows.length > 0 && (
                <p className="px-1 text-xs text-gray-400 dark:text-gray-500">
                    A name asks for you when its horizon runs out since the last look — two
                    days on a weekly idea, two weeks on a monthly one, two months on a yearly
                    one. Looking at it resets the clock, whatever you conclude.
                </p>
            )}
        </div>
    );
}
