import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bookmark, RefreshCw, Check, ArrowUpRight, ChevronDown, Target, Search, Undo2
} from 'lucide-react';
import { useWatchlist } from '../../contexts/WatchlistContext';
import { ChartUpload } from '../common/ChartUpload';
import { pct, tone, toSlug } from '../Heatmap/heatmapData';
import { TIMEFRAMES } from '../Heatmap/heatmapConfig';
import { split, kindOf, matches, dueText, daysSince, lastLookAt, meterFor, hasFired } from './horizons';

const labelOf = (period) => TIMEFRAMES.find((t) => t.id === period)?.label || period;

const ago = (days) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

/**
 * When something happened, said once.
 *
 * The thread printed "31 Aug · today" on every entry - the date and the same
 * date in words, side by side. Recent things want the relative form because you
 * think in days; old things want the date because "173 days ago" is not a fact
 * you can place.
 */
const when = (at) => {
    const days = daysSince(at);
    if (days < 7) return ago(days);
    const d = new Date(at);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
};

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

/** The state of the row, said once, at a size you can read down a column. */
function Pill({ tone: t, children }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full py-[3px] pl-2.5 pr-3 text-[13px] font-semibold ${DUE_PILL[t]}`}>
            <span className="h-[7px] w-[7px] rounded-full bg-current" />
            {children}
        </span>
    );
}

const STRIPE = {
    fired: 'bg-cyan-500',
    late: 'bg-rose-500',
    soon: 'bg-amber-500',
    calm: 'bg-transparent'
};

const INPUT = 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

/**
 * Three ranks of button, and they have to look like three ranks.
 *
 * Every action on the row used to be an outline or bare text, so the one the
 * whole feature depends on you pressing read exactly like the disclosure toggle
 * next to it. Filled for that one, outline for the alternative, quiet for
 * everything that only reveals something.
 */
const BTN = 'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-[7px] text-[13.5px] font-semibold transition';
const PRIMARY = `${BTN} bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-60 dark:bg-cyan-400 dark:text-cyan-950 dark:hover:bg-cyan-300`;
const OUTLINE = `${BTN} border border-gray-300 font-medium text-gray-800 hover:border-cyan-500 hover:text-cyan-600 dark:border-gray-600 dark:text-gray-200 dark:hover:border-cyan-400 dark:hover:text-cyan-400`;
const QUIET = 'inline-flex items-center gap-1 rounded-lg px-2 py-[7px] text-[13.5px] font-medium text-gray-400 transition hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200';
const DANGER = 'inline-flex items-center gap-1 rounded-lg px-2 py-[7px] text-[13.5px] font-medium text-gray-400 transition hover:text-rose-600 dark:text-gray-500 dark:hover:text-rose-400';

/** The row splits: what you think on the left, what the market says on the right. */
const ROW = 'relative flex flex-col border-t border-gray-200 first:border-t-0 dark:border-gray-700 sm:flex-row';
const MAIN = 'min-w-0 flex-1 px-5 py-4 sm:pl-6';
const PANEL = 'flex w-full shrink-0 flex-col gap-3.5 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/40 sm:w-[262px] sm:border-l sm:border-t-0';
const PN_LABEL = 'text-[10.5px] font-semibold uppercase tracking-[0.09em] text-gray-400 dark:text-gray-500';

/**
 * How far the name has travelled since you flagged it.
 *
 * Both numbers, not a delta: "since flagged +7.6%" needs you to remember what it
 * was, and the whole point of this screen is that you should not have to.
 */
function Drift({ item }) {
    if (item.perfNow == null || item.perfWhenNoticed == null) {
        return <span className="text-[13px] text-gray-400 dark:text-gray-500">no quote</span>;
    }
    return (
        <span className="whitespace-nowrap font-mono text-[13.5px] tabular-nums text-gray-400 dark:text-gray-500">
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
        <div>
            <div className={PN_LABEL}>Your levels</div>
            <div className="relative mt-2 h-1.5 rounded-full bg-gradient-to-r from-rose-200 via-gray-200 to-cyan-200 dark:from-rose-500/30 dark:via-gray-700 dark:to-cyan-500/30">
                <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[2.5px] ring-gray-50 dark:ring-gray-900 ${colour}`}
                    style={{ left: `${m.at * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11.5px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                <span>{money(m.lo.price)}</span>
                <span>{money(m.hi.price)}</span>
            </div>
            {/* The numbers alone do not say which end means what, and getting
                that backwards is the one misreading that costs money. */}
            <div className="flex justify-between text-[10.5px] text-gray-400 dark:text-gray-500">
                <span>{m.lo.label}</span>
                <span>{m.hi.label}</span>
            </div>
        </div>
    );
}

/**
 * The right-hand column: what the market says, as opposed to what you think.
 *
 * This exists because the width existed. Today's price and the drift were the
 * only live data on the row and they sat at twelve pixels pinned to the far
 * edge, a thousand pixels from the name they described - so the eye had to cross
 * an empty field to pair them up. Giving them a bordered column of their own
 * pairs each number with a label and puts the whole of it under one glance.
 */
function Panel({ item, children }) {
    return (
        <aside className={PANEL}>
            <div>
                <div className={PN_LABEL}>Price now</div>
                <div className="mt-1 font-mono text-[25px] font-semibold leading-none tracking-tight tabular-nums text-gray-900 dark:text-white">
                    {item.priceNow == null ? <span className="text-base text-gray-400 dark:text-gray-500">—</span> : money(item.priceNow)}
                </div>
            </div>
            <div>
                <div className={PN_LABEL}>Since you flagged it</div>
                <div className="mt-1"><Drift item={item} /></div>
            </div>
            {children}
        </aside>
    );
}

/** One entry: when, what you thought, and what you were waiting for. */
function Look({ look }) {
    return (
        <div className="flex items-start gap-3">
            {/* No placeholder when there is no chart. An empty box per look was
                more of the row than the words were. */}
            {look.chartUrl && (
                <a href={look.chartUrl} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={look.chartUrl} alt={`Chart from ${new Date(look.at).toDateString()}`}
                        className="h-14 w-24 rounded border border-gray-200 object-cover dark:border-gray-600" />
                </a>
            )}
            <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] text-gray-400 dark:text-gray-500">{when(look.at)}</div>
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
    );
}

/**
 * Everything you thought about this name, newest first, in one list.
 *
 * The earlier round belongs in here, not in a box of its own above the buttons.
 * Two threads on one card, drawn identically, each with its own button reading
 * "Hide", left you unable to say which was which - and the answer is not a
 * second label, it is one chronology with the break marked in it. A name you
 * dropped and picked up again is still one continuous train of thought; only the
 * record underneath it restarted.
 */
function Thread({ looks, prior }) {
    const ENDED = { invalidated: 'the idea died here', dropped: 'you passed on it here', traded: 'you traded it here' };
    const earlier = prior?.looks || [];

    if (!looks.length && !earlier.length) {
        return <p className="py-1 text-sm text-gray-400 dark:text-gray-500">Nothing written down yet.</p>;
    }
    return (
        <div className="flex flex-col gap-2.5 py-1">
            {[...looks].reverse().map((look) => <Look key={look.id} look={look} />)}

            {earlier.length > 0 && (
                <div className="flex items-center gap-2.5 py-0.5 text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                    {ENDED[prior.state] || 'an earlier run'}
                    {prior.settledAt && <span className="font-mono normal-case tracking-normal">· {when(prior.settledAt)}</span>}
                    <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                </div>
            )}

            {[...earlier].reverse().map((look) => <Look key={look.id} look={look} />)}
        </div>
    );
}

/** The thread, behind a disclosure, wherever a row wants to offer it. */
function ThreadToggle({ looks, prior, label = 'What I thought before' }) {
    const [open, setOpen] = useState(false);
    if (!looks.length && !prior?.looks?.length) return null;
    return (
        <>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={QUIET}>
                {open ? 'Hide' : label}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="mt-1 w-full border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                    <Thread looks={looks} prior={prior} />
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
        <div className="mt-3 inline-flex max-w-full items-start gap-2.5 rounded-lg bg-cyan-50 px-3.5 py-2.5 text-[14px] leading-snug text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200">
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

/** Symbol and name, the head of every row whatever its state. */
function Head({ item, onOpen }) {
    return (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <button type="button" onClick={() => onOpen(item)}
                className="font-mono text-[19px] font-semibold tracking-tight text-gray-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400">
                {item.symbol}
            </button>
            <span className="min-w-0 flex-1 truncate text-[15px] text-gray-500 dark:text-gray-400">{item.name}</span>
        </div>
    );
}

/**
 * Back to the board you found it on.
 *
 * Drawn as a link, with the arrow, because it was drawn as a static grey chip
 * and nobody presses a label. A control that hides is a control you never use.
 */
function Origin({ item, onOpen }) {
    return (
        <button type="button" onClick={() => onOpen(item)}
            className="inline-flex items-center gap-1.5 border-b border-gray-300 text-[13px] text-gray-500 transition hover:border-cyan-500 hover:text-cyan-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-cyan-400 dark:hover:text-cyan-400">
            {item.sector} · {labelOf(item.period).toLowerCase()}
            <ArrowUpRight className="h-3 w-3" />
        </button>
    );
}

/** Sector, timeframe and how long since you last looked. */
function Status({ item, tone: t, label, onOpen, extra }) {
    return (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Pill tone={t}>{label}</Pill>
            <Origin item={item} onOpen={onOpen} />
            {extra && <span className="text-[13px] text-gray-400 dark:text-gray-500">{extra}</span>}
        </div>
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
    const hasLevels = item.trigger || item.invalidation;

    return (
        <div className={ROW}>
            <span className={`absolute inset-y-0 left-0 w-1 ${STRIPE[due.tone]}`} />

            <div className={MAIN}>
                <Head item={item} onOpen={onOpen} />
                <Status item={item} onOpen={onOpen} tone={due.tone} label={due.text}
                    extra={[
                        looks.length
                            ? `${looks.length} look${looks.length === 1 ? '' : 's'} · last ${ago(daysSince(lastLookAt(item)))}`
                            : `flagged ${ago(daysSince(item.noticedAt))}, never looked at`,
                        // Two words rather than a panel. That you have been here
                        // before matters when you open the thread, not while you
                        // are scanning past the row.
                        item.prior?.looks?.length ? 'watched before' : null
                    ].filter(Boolean).join(' · ')} />

                {hasFired(item) && <Fired item={item} />}

                {mode === 'look' && (
                    <LookForm item={item} onCancel={() => setOpen(null)}
                        onSave={async (body) => { await onLook(item, body); setOpen(null); }} />
                )}
                {mode === 'trade' && (
                    <TradeForm item={item} onCancel={() => setOpen(null)}
                        onSave={(body) => onTrade(item, body)} />
                )}

                {!mode && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setOpen({ id: item.id, mode: 'look' })} className={PRIMARY}>
                            I looked at this
                        </button>
                        <button type="button" onClick={() => setOpen({ id: item.id, mode: 'trade' })} className={OUTLINE}>
                            I bought it
                        </button>
                        <ThreadToggle looks={looks} prior={item.prior} />
                        {/* Held away from the others on purpose. It is the only
                            destructive control here, and a thumb's width from
                            "I bought it" is how you drop a name you meant to keep. */}
                        <button type="button" onClick={() => onDrop(item)} className={`${DANGER} ml-auto`}>
                            Not interested
                        </button>
                    </div>
                )}
            </div>

            <Panel item={item}>
                {hasLevels ? <Meter item={item} /> : (
                    <p className="text-[12.5px] leading-snug text-gray-400 dark:text-gray-500">
                        No level armed.{' '}
                        <button type="button" onClick={() => setOpen({ id: item.id, mode: 'look' })}
                            className="border-b border-current font-medium text-cyan-600 dark:text-cyan-400">
                            Set one
                        </button>
                    </p>
                )}
            </Panel>
        </div>
    );
}

/**
 * Anything you have finished with, in one shape.
 *
 * History used to draw a closed idea as a full row with its own data panel and
 * everything else as a one-liner, so scrolling it meant meeting two different
 * kinds of card with no rule for which was which. One shape, and the difference
 * between them lives where it belongs: in the sentence saying what happened.
 *
 * No price panel here. A panel is for a decision you are still making; a name
 * you passed on in March does not need today's quote in a bordered column.
 */
function PastRow({ item, onOpen, onRevive, onJournal }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const kind = kindOf(item);
    const level = item.looks?.slice().reverse().find((l) => l.invalidation)?.invalidation
        || item.invalidation;

    const BADGE = {
        dead: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
        passed: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
        traded: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    };
    const LABEL = { dead: 'Idea closed', passed: 'Passed on', traded: 'Became a trade' };

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
        <div className="relative border-t border-gray-200 px-5 py-4 first:border-t-0 dark:border-gray-700 sm:pl-6">
            {kind === 'dead' && <span className="absolute inset-y-0 left-0 w-1 bg-rose-500" />}

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <button type="button" onClick={() => onOpen(item)}
                    className="font-mono text-[17px] font-semibold tracking-tight text-gray-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400">
                    {item.symbol}
                </button>
                <span className="min-w-0 flex-1 truncate text-[14px] text-gray-500 dark:text-gray-400">{item.name}</span>
                <span className={`rounded-full px-3 py-[3px] text-[12.5px] font-semibold ${BADGE[kind]}`}>
                    {LABEL[kind]}
                </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Origin item={item} onOpen={onOpen} />
                {item.settledAt && (
                    <span className="text-[13px] text-gray-400 dark:text-gray-500">{when(item.settledAt)}</span>
                )}
            </div>

            {/* The one line that says what actually happened. It is the only
                thing that differs between a closed idea and a passed one, so it
                is the only thing allowed to differ. */}
            {kind === 'dead' && (
                <p className="mt-2.5 text-[14px] text-gray-600 dark:text-gray-300">
                    <span className="font-mono font-semibold tabular-nums">{money(item.invalidatedPrice)}</span>
                    {level
                        ? <> printed {level.dir === 'above' ? 'up through' : 'through'} the <span className="font-mono tabular-nums">{money(level.price)}</span> you said would kill it</>
                        : ' printed through the level you said would kill it'}
                </p>
            )}

            {error && <p className="mt-1.5 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {traded(item)
                    ? <button type="button" onClick={() => onJournal(item)} className={QUIET}>Open in the journal</button>
                    : (
                        <button type="button" onClick={revive} disabled={busy} className={QUIET}>
                            <Undo2 className="h-3.5 w-3.5" />
                            {busy ? 'Putting it back…' : kind === 'dead' ? 'I still like it' : 'Watch it again'}
                        </button>
                    )}
                <ThreadToggle looks={item.looks || []} label="What I thought" />
            </div>

            {kind === 'dead' && (
                <p className="mt-2 text-[12.5px] text-gray-400 dark:text-gray-500">
                    Putting it back clears that level — you name a new one on the next look.
                </p>
            )}
        </div>
    );
}

const traded = (item) => item.state === 'traded' && item.journalEntryId;

/** How a name ended, as a filter inside history. Absent when nothing ended that way. */
const KINDS = [
    { id: 'all', label: 'Everything' },
    { id: 'dead', label: 'Called dead' },
    { id: 'passed', label: 'Passed on' },
    { id: 'traded', label: 'Became trades' }
];

function Kinds({ items, value, onChange }) {
    const counts = useMemo(() => {
        const c = { all: items.length };
        for (const i of items) c[kindOf(i)] = (c[kindOf(i)] || 0) + 1;
        return c;
    }, [items]);

    // One kind of ending is not a filter, it is the list.
    const shown = KINDS.filter((k) => counts[k.id]);
    if (shown.length < 3) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-2.5 dark:border-gray-700">
            {shown.map((k) => (
                <button key={k.id} type="button" onClick={() => onChange(k.id)}
                    aria-pressed={value === k.id}
                    className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${
                        value === k.id
                            ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                            : 'bg-gray-100 text-gray-500 hover:text-gray-800 dark:bg-gray-700 dark:text-gray-300 dark:hover:text-white'
                    }`}>
                    {k.label} <span className="tabular-nums opacity-60">{counts[k.id]}</span>
                </button>
            ))}
        </div>
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
    const [kind, setKind] = useState('all');
    const [query, setQuery] = useState('');

    // Settled once per load of the data, deliberately.
    const groups = useMemo(() => split(items), [items]);

    const rows = useMemo(() => groups[tab]
        .filter((i) => tab !== 'past' || kind === 'all' || kindOf(i) === kind)
        .filter((i) => matches(i, query)),
    [groups, tab, kind, query]);

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

                {tab === 'past' && <Kinds items={groups.past} value={kind} onChange={setKind} />}
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
                                : tab === 'queue' ? 'Nothing flagged yet.' : 'Nothing here yet.'}
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
