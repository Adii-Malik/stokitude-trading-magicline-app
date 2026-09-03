import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bookmark, RefreshCw, Check, ArrowUpRight, ChevronDown, Target, Search, Undo2, Plus
} from 'lucide-react';
import { useWatchlist } from '../../contexts/WatchlistContext';
import { ChartUpload } from '../common/ChartUpload';
import { pct, tone, toSlug } from '../Heatmap/heatmapData';
import { split, kindOf, matches, statusOf, daysSince, daysIdle, meterFor, hasFired } from './horizons';

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
    soon: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
};

/** The state of the row, said once, at a size you can read down a column. */
function Pill({ tone: t, children }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-sm font-semibold ${DUE_PILL[t]}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {children}
        </span>
    );
}

// Only a row with something to say gets a stripe. A colour down every row is a
// colour that means nothing.
const INPUT = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

/**
 * Three ranks of button, and they have to look like three ranks.
 *
 * Every action on the row used to be an outline or bare text, so the one the
 * whole feature depends on you pressing read exactly like the disclosure toggle
 * next to it. Filled for that one, outline for the alternative, quiet for
 * everything that only reveals something.
 */
const BTN = 'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition';
const PRIMARY = `${BTN} bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-60 dark:bg-cyan-400 dark:text-cyan-950 dark:hover:bg-cyan-300`;
const OUTLINE = `${BTN} border border-gray-300 font-medium text-gray-800 hover:border-cyan-500 hover:text-cyan-600 dark:border-gray-600 dark:text-gray-200 dark:hover:border-cyan-400 dark:hover:text-cyan-400`;
const QUIET = 'inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-gray-400 transition hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200';
const DANGER = 'inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-gray-400 transition hover:text-rose-600 dark:text-gray-500 dark:hover:text-rose-400';

/** The row splits: what you think on the left, what the market says on the right. */
const ROW = 'relative flex flex-col border-t border-gray-200 first:border-t-0 dark:border-gray-700 sm:flex-row';
const MAIN = 'min-w-0 flex-1 px-5 py-4 sm:pl-6';
const PANEL = 'flex w-full shrink-0 flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/40 sm:w-64 sm:border-l sm:border-t-0';
const PN_LABEL = 'text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500';

/**
 * How far the name has travelled since you flagged it.
 *
 * Both numbers, not a delta: "since flagged +7.6%" needs you to remember what it
 * was, and the whole point of this screen is that you should not have to.
 */
function Drift({ item }) {
    if (item.perfNow == null || item.perfWhenNoticed == null) {
        return <span className="text-sm text-gray-400 dark:text-gray-500">no quote</span>;
    }
    return (
        <span className="whitespace-nowrap font-mono text-sm tabular-nums text-gray-400 dark:text-gray-500">
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
                <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-gray-50 dark:ring-gray-900 ${colour}`}
                    style={{ left: `${m.at * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                <span>{money(m.lo.price)}</span>
                <span>{money(m.hi.price)}</span>
            </div>
            {/* The numbers alone do not say which end means what, and getting
                that backwards is the one misreading that costs money. */}
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
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
                <div className="mt-1 font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums text-gray-900 dark:text-white">
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
                <div className="font-mono text-xs text-gray-400 dark:text-gray-500">{when(look.at)}</div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    {look.note || <span className="italic text-gray-400 dark:text-gray-500">looked, wrote nothing</span>}
                </p>
                {(look.trigger || look.invalidation) && (
                    <p className="mt-0.5 font-mono text-xs text-gray-400 dark:text-gray-500">
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
        <div className="flex flex-col gap-2 py-1">
            {[...looks].reverse().map((look) => <Look key={look.id} look={look} />)}

            {earlier.length > 0 && (
                <div className="flex items-center gap-2 py-0.5 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
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
        <div className="mt-3 inline-flex max-w-full items-start gap-2 rounded-lg bg-cyan-50 px-3.5 py-2.5 text-sm leading-snug text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200">
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

    /**
     * A level price has already passed is armed, not waiting.
     *
     * Said before you save rather than in a notification that night. Naming a
     * number price is already through fires on the next check, and the alert is
     * technically correct and completely useless - you get told about something
     * that had already happened when you typed it. TradingView warns about the
     * same case; this is that warning, with your own number in it.
     */
    const alreadyTrue = (v, dir) => {
        const level = levelOf(v, dir);
        if (!level || item.priceNow == null) return false;
        return dir === 'above' ? item.priceNow >= level.price : item.priceNow <= level.price;
    };

    const armed = [
        alreadyTrue(trigger, triggerDir) && 'Wake me',
        alreadyTrue(invalid, invalidDir) && 'Dead'
    ].filter(Boolean);

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
        <div className="mt-2 flex flex-col gap-2">
            <ChartUpload value={chartUrl} onChange={setChartUrl} />
            {/* Both optional, and skipping them is the common case. They sit
                after the chart because the record is the thing that matters and
                a price is a convenience on top of it. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                <Level label="Wake me" first="above" symbol={item.symbol} onEnter={save}
                    dir={triggerDir} setDir={setTriggerDir} price={trigger} setPrice={setTrigger} />
                <Level label="Dead" first="below" symbol={item.symbol} onEnter={save}
                    dir={invalidDir} setDir={setInvalidDir} price={invalid} setPrice={setInvalid} />
                <span className="text-gray-400 dark:text-gray-500">
                    both optional
                    {item.priceNow != null && <> · <span className="font-mono tabular-nums">{money(item.priceNow)}</span> now</>}
                </span>
            </div>

            {armed.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    {armed.join(' and ')} {armed.length > 1 ? 'are' : 'is'} already true at{' '}
                    <span className="font-mono tabular-nums">{money(item.priceNow)}</span> — it fires on the next check.
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <input ref={input} type="text" value={note} onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
                    maxLength={280} placeholder="What did you see? Optional."
                    aria-label={`Note for ${item.symbol}`} className={`min-w-0 flex-1 ${INPUT}`} />
                <button type="button" onClick={save} disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:opacity-60">
                    <Check className="h-4 w-4" /> {busy ? 'Saving…' : 'Save look'}
                </button>
                <button type="button" onClick={onCancel}
                    className="rounded-lg px-2 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
        <div className="mt-2 max-w-2xl rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/40">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                The journal takes it from here. Give it what the broker gave you.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {field('What you paid', price, setPrice, { ref: first, placeholder: '0.00' })}
                {field('How many', qty, setQty, { placeholder: 'shares' })}
                {field('Stop', stop, setStop, { placeholder: 'optional' })}
                {field('When', date, setDate, { type: 'date' })}
            </div>
            {stop.trim() !== '' && item.invalidation && Number(stop) === item.invalidation.price && (
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Stop taken from the price you said would kill the idea.
                </p>
            )}
            {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={save} disabled={!ready || busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:opacity-50">
                    <Check className="h-4 w-4" /> {busy ? 'Logging…' : 'Log the trade'}
                </button>
                <button type="button" onClick={onCancel}
                    className="rounded-lg px-2 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
/**
 * Back to the sector you found it in.
 *
 * The board's timeframe used to be printed here too. It stopped meaning
 * anything the moment a flag became one per stock: it is not the identity, it
 * no longer sets a deadline, and a name flagged off the monthly board is the
 * same name you would have flagged off the yearly one. Printing it implied a
 * distinction the record does not make. It still decides which board this
 * opens, and which column the drift is read from - both jobs it can do without
 * being on screen.
 *
 * Drawn as a link, with the arrow, because it was a static grey chip and nobody
 * presses a label. A control that hides is a control you never use.
 */
function Origin({ item, onOpen }) {
    return (
        <button type="button" onClick={() => onOpen(item)}
            className="inline-flex items-center gap-1.5 border-b border-gray-300 text-sm text-gray-500 transition hover:border-cyan-500 hover:text-cyan-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-cyan-400 dark:hover:text-cyan-400">
            {item.sector}
            <ArrowUpRight className="h-3 w-3" />
        </button>
    );
}

/** Where it came from, how long it has been, and a pill only if one is earned. */
function Status({ item, status, onOpen, extra }) {
    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            {status && <Pill tone={status.tone}>{status.text}</Pill>}
            <Origin item={item} onOpen={onOpen} />
            {extra && <span className="text-sm text-gray-400 dark:text-gray-500">{extra}</span>}
        </div>
    );
}

/**
 * Three orders, named in words rather than in this feature's own vocabulary.
 *
 * The default is the one the list has always used - a level that printed, then
 * anything you have never opened, then longest since you looked.
 *
 * There was a chip beside this reading "not opened yet", and it had to go: the
 * default order already floats those to the top, so the two controls were the
 * same idea wearing different hats. Sorting and filtering earn separate places
 * only when they answer separate questions.
 */
const SORTS = [
    { id: 'needs', label: 'What needs me' },
    { id: 'idle', label: 'Longest since a look' },
    { id: 'drift', label: 'Move since I flagged it' }
];

/** How far price has come since you flagged it, as a percentage or null. */
function driftPct(item) {
    if (!(item.priceWhenNoticed > 0) || item.priceNow == null) return null;
    return ((item.priceNow - item.priceWhenNoticed) / item.priceWhenNoticed) * 100;
}

/**
 * One line per name, so fifteen of them can be scanned rather than read.
 *
 * The card this replaces is about a hundred and forty pixels tall, which is
 * right for the five names it was designed for and two thousand pixels of
 * scrolling at fifteen. Everything that decides whether you open a row is now a
 * column, so the eye runs down one column instead of reading each line:
 *
 *   ○ or ●     never opened, or opened. The one you asked for.
 *   looks      glanced at once and studied four times are different states.
 *   watching   a level, or a dash. The dash is the useful half.
 *
 * The card is not gone - it is what a row expands into.
 */
function ListRow({ item, open, onExpand }) {
    const looks = item.looks?.length || 0;
    const level = item.trigger || item.invalidation;
    const fired = hasFired(item);

    return (
        <button type="button" onClick={() => onExpand(open ? null : item.id)}
            aria-expanded={open}
            className={`flex w-full items-center gap-4 border-t px-6 py-3 text-left transition ${
                open
                    ? 'border-cyan-200 bg-cyan-50 dark:border-cyan-500/30 dark:bg-cyan-500/10'
                    : 'border-gray-100 hover:bg-gray-50 dark:border-gray-700/60 dark:hover:bg-gray-700/40'
            }`}>
            {/* A chevron needs no legend. The circle it replaced was a symbol
                with two colours and no key anywhere on the screen - and the
                Looks column, which has a heading, already said the same thing. */}
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${
                open ? 'rotate-0 text-cyan-600 dark:text-cyan-400' : '-rotate-90 text-gray-300 dark:text-gray-600'
            }`} />
            <span className="w-20 shrink-0 truncate font-mono text-sm font-bold text-gray-900 dark:text-white">
                {item.symbol}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">
                {item.sector}
            </span>
            <span className={`w-16 shrink-0 text-right font-mono text-sm ${
                looks ? 'text-gray-600 dark:text-gray-300' : 'font-semibold text-rose-600 dark:text-rose-400'
            }`}>
                {looks || 'none'}
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-sm text-gray-400 dark:text-gray-500">
                {looks ? `${daysIdle(item)}d` : '—'}
            </span>
            <span className={`w-32 shrink-0 truncate text-right font-mono text-sm ${
                fired ? 'font-semibold text-rose-600 dark:text-rose-400'
                    : level ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-300 dark:text-gray-600'
            }`}>
                {fired ? `printed ${money(item.triggeredPrice)}`
                    : level ? `${item.trigger ? '▲' : '▼'} ${money(level.price)}` : '—'}
            </span>
            <span className="w-24 shrink-0 text-right font-mono text-base font-semibold text-gray-900 dark:text-white">
                {money(item.priceNow)}
            </span>
        </button>
    );
}

/** The column names, once, so the row's numbers are not a guess. */
function ListHead() {
    // Widths and gaps match ListRow exactly. They have to be read together, so
    // they are kept next to each other rather than in a shared constant that
    // hides which column is which.
    const H = 'shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500';
    return (
        <div className="flex items-center gap-4 border-b border-gray-200 px-6 pb-3 dark:border-gray-700">
            <span className="h-4 w-4 shrink-0" />
            <span className={`w-20 ${H}`}>Symbol</span>
            <span className={`min-w-0 flex-1 ${H}`}>Sector</span>
            <span className={`w-16 text-right ${H}`}>Looks</span>
            <span className={`w-16 text-right ${H}`}>Last</span>
            <span className={`w-32 text-right ${H}`}>Watching</span>
            <span className={`w-24 text-right ${H}`}>Now</span>
        </div>
    );
}

/**
 * Narrowing, for when the list is long enough that scanning is not enough.
 *
 * Deliberately orthogonal to the groups above it. The groups answer "what needs
 * me"; these answer "where is that one name" and "how are my refinery ideas
 * doing" - questions the sort order can never reach. Sector offers only the
 * sectors you actually hold names in, because a dropdown of every sector on the
 * exchange is a worse search box.
 */
function Filters({ query, setQuery, sectors, sector, setSector, sort, setSort, onClear }) {
    const SELECT = 'rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-cyan-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200';

    return (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-2 dark:border-gray-700">
            <label className="relative min-w-40 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Symbol or sector" aria-label="Filter the shortlist"
                    className={`w-full py-1 pl-8 ${INPUT}`} />
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                Sector
                <select value={sector} onChange={(e) => setSector(e.target.value)} className={SELECT}>
                    <option value="">All</option>
                    {sectors.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.n})</option>)}
                </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value)} className={SELECT}>
                    {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
            </label>

            {/* Only when there is something to clear. A permanently visible
                Clear on an unfiltered list is a button that does nothing. */}
            {(query || sector || sort !== 'needs') && (
                <button type="button" onClick={onClear}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-gray-400 underline-offset-2 transition hover:text-gray-700 hover:underline dark:text-gray-500 dark:hover:text-gray-200">
                    Clear
                </button>
            )}
        </div>
    );
}

/**
 * One name in the queue, and the one action the whole feature depends on you
 * taking. Open it, paste the chart, press Enter.
 */
function QueueRow({ item, open, setOpen, onLook, onDrop, onOpen, onTrade }) {
    const status = statusOf(item);
    const looks = item.looks || [];
    const mode = open?.id === item.id ? open.mode : null;
    const hasLevels = item.trigger || item.invalidation;

    return (
        <div className={ROW}>
            <div className={MAIN}>
                {/* No symbol here. The row above is still on screen with its
                    columns intact, so repeating the name would say it twice and
                    the detail would stop looking attached to anything. */}
                <span className="sr-only">{item.symbol}</span>
                <Status item={item} onOpen={onOpen} status={status}
                    extra={[
                        looks.length
                            ? `${looks.length} look${looks.length === 1 ? '' : 's'} · last ${ago(daysIdle(item))}`
                            : `flagged ${ago(daysSince(item.noticedAt))}`,
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
                    <div className="mt-4 flex flex-wrap items-center gap-2">
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
                    <p className="text-xs leading-snug text-gray-400 dark:text-gray-500">
                        Nothing is watching this price.{' '}
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
    // Shorter than the filter above it, but naming the same actor. "Idea
    // closed" said something happened and not who did it.
    const LABEL = { dead: 'Level killed it', passed: 'You passed', traded: 'You traded it' };

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
        <div className="border-t border-gray-200 px-5 py-4 first:border-t-0 dark:border-gray-700 sm:pl-6">

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <button type="button" onClick={() => onOpen(item)}
                    className="font-mono text-lg font-semibold tracking-tight text-gray-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400">
                    {item.symbol}
                </button>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">{item.name}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE[kind]}`}>
                    {LABEL[kind]}
                </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Origin item={item} onOpen={onOpen} />
                {item.settledAt && (
                    <span className="text-sm text-gray-400 dark:text-gray-500">{when(item.settledAt)}</span>
                )}
            </div>

            {/* The one line that says what actually happened. It is the only
                thing that differs between a closed idea and a passed one, so it
                is the only thing allowed to differ. */}
            {kind === 'dead' && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-mono font-semibold tabular-nums">{money(item.invalidatedPrice)}</span>
                    {level
                        ? <> printed {level.dir === 'above' ? 'up through' : 'through'} the <span className="font-mono tabular-nums">{money(level.price)}</span> you said would kill it</>
                        : ' printed through the level you said would kill it'}
                </p>
            )}

            {error && <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-2">
                {traded(item)
                    ? <button type="button" onClick={() => onJournal(item)} className={QUIET}>Open in the journal</button>
                    : (
                        <button type="button" onClick={revive} disabled={busy} className={QUIET}
                            title={kind === 'dead'
                                ? 'Puts it back on the queue and clears that level — you name a new one on the next look'
                                : `Put ${item.symbol} back on the queue`}>
                            <Undo2 className="h-3.5 w-3.5" />
                            {busy ? 'Putting it back…' : kind === 'dead' ? 'I still like it' : 'Watch it again'}
                        </button>
                    )}
                <ThreadToggle looks={item.looks || []} label="What I thought" />
            </div>

        </div>
    );
}

const traded = (item) => item.state === 'traded' && item.journalEntryId;

/**
 * Flag a name you are already looking at, without going to find it first.
 *
 * The button used to live only on a sector row, so recording "I like this chart"
 * meant working out the sector, opening that board and hunting the row down -
 * three steps between the thought and the record, at exactly the moment the
 * thought is worth keeping. Type the symbol instead.
 */
function AddByName({ onAdd }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [hits, setHits] = useState([]);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const { search } = useWatchlist();
    const box = useRef(null);

    useEffect(() => { if (open) box.current?.focus(); }, [open]);

    // Debounced, because the board is searched on every keystroke otherwise and
    // the answers would arrive out of order.
    useEffect(() => {
        if (!q.trim()) { setHits([]); return; }
        let live = true;
        const t = setTimeout(async () => {
            try {
                const found = await search(q);
                if (live) setHits(found);
            } catch { if (live) setHits([]); }
        }, 180);
        return () => { live = false; clearTimeout(t); };
    }, [q, search]);

    const add = async (hit) => {
        setBusy(hit.symbol);
        setError(null);
        try {
            await onAdd(hit);
            setQ(''); setHits([]); setOpen(false);
        } catch (e) {
            setError(e.response?.data?.message || `Could not flag ${hit.symbol}`);
        } finally {
            setBusy(null);
        }
    };

    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)} className={OUTLINE}>
                <Plus className="h-4 w-4" /> Add a name
            </button>
        );
    }

    return (
        <div className="relative">
            <input ref={box} type="text" value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') { setOpen(false); setQ(''); }
                    if (e.key === 'Enter' && hits.length) add(hits[0]);
                }}
                placeholder="Symbol or company" aria-label="Find a name to flag"
                className={`w-56 ${INPUT}`} />

            {(hits.length > 0 || q.trim()) && (
                <div className="absolute right-0 z-30 mt-1 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {hits.map((hit) => (
                        <button key={hit.symbol} type="button" onClick={() => add(hit)} disabled={busy === hit.symbol}
                            className="flex w-full items-baseline gap-2 px-3.5 py-2.5 text-left transition hover:bg-gray-50 disabled:opacity-60 dark:hover:bg-gray-700">
                            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{hit.symbol}</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">{hit.name}</span>
                            <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{hit.sector}</span>
                        </button>
                    ))}
                    {!hits.length && (
                        <p className="px-3.5 py-3 text-sm text-gray-400 dark:text-gray-500">
                            Nothing on this market matches “{q.trim()}”.
                        </p>
                    )}
                </div>
            )}
            {error && <p className="absolute right-0 mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
    );
}

/** One tab. Absent rather than zero: an empty tab is a thing to rule out. */
function Tab({ id, label, count, active, onClick }) {
    return (
        <button type="button" onClick={() => onClick(id)} aria-current={active}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}>
            {label}
            <span className="rounded-full bg-gray-200 px-1.5 text-xs tabular-nums text-gray-600 dark:bg-gray-600 dark:text-gray-200">
                {count}
            </span>
        </button>
    );
}

/** How a name ended, as a filter inside history. Absent when nothing ended that way. */
/**
 * Named for who ended the idea, because that is the only axis that separates
 * them - and the one the old labels hid.
 *
 * "Called dead" read as a verdict with no author: nothing in the words said
 * whether you killed it or the market did. One of these three is not your
 * decision at all, which is the thing worth seeing while you are reading back
 * what happened to your ideas.
 */
const KINDS = [
    { id: 'all', label: 'Everything' },
    { id: 'dead', label: 'Your level killed it' },
    { id: 'passed', label: 'You passed on it' },
    { id: 'traded', label: 'You traded it' }
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
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
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
    const { items, loading, error, reload, flag, remove, update, look, trade, counts } = useWatchlist();
    const [open, setOpen] = useState(null);
    const [tab, setTab] = useState('queue');
    const [sector, setSector] = useState('');
    const [sort, setSort] = useState('needs');
    // Which row is showing its card. One at a time: two open cards is the
    // wall of text the dense list exists to replace.
    const [expanded, setExpanded] = useState(null);
    const [kind, setKind] = useState('all');
    const [query, setQuery] = useState('');

    // Settled once per load of the data, deliberately.
    const groups = useMemo(() => split(items), [items]);

    /** Only the sectors you hold names in, with counts. */
    const sectors = useMemo(() => {
        const n = new Map();
        for (const i of groups[tab]) if (i.sector) n.set(i.sector, (n.get(i.sector) || 0) + 1);
        return [...n.entries()].map(([name, count]) => ({ name, n: count }))
            .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    }, [groups, tab]);

    const rows = useMemo(() => {
        const list = groups[tab]
            .filter((i) => tab !== 'past' || kind === 'all' || kindOf(i) === kind)
            .filter((i) => !sector || i.sector === sector)
            .filter((i) => matches(i, query));

        if (tab !== 'queue' || sort === 'needs') return list;

        // A copy: split() hands back the array it sorted, and re-sorting it in
        // place would reorder the queue behind every other reader of it.
        const by = {
            idle: (a, b) => daysIdle(b) - daysIdle(a),
            drift: (a, b) => (driftPct(b) ?? -Infinity) - (driftPct(a) ?? -Infinity)
        }[sort];
        return by ? [...list].sort(by) : list;
    }, [groups, tab, kind, query, sector, sort]);

    const onLook = (item, body) => look(item.id, body);
    const onDrop = (item) => remove(item);
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
                            Names worth a second look — flagged off a sector board or typed in
                            from wherever you found them. Paste the chart and it remembers what
                            you were looking at.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <AddByName onAdd={(hit) => flag({
                            symbol: hit.symbol, name: hit.name, sector: hit.sector, price: hit.close, perf: hit.perf
                        })} />
                        {counts.due > 0 && (
                            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                                {counts.due} need{counts.due === 1 ? 's' : ''} you
                            </span>
                        )}
                        <button type="button" onClick={reload}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 px-4 py-2.5 dark:border-gray-700">
                    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900/50">
                        <Tab id="queue" label="Queue" count={groups.queue.length}
                            active={tab === 'queue'} onClick={setTab} />
                        {/* Shown at zero on purpose. Hidden until something
                            settled there, you never learned the second half of
                            the model existed. */}
                        <Tab id="past" label="History" count={groups.past.length}
                            active={tab === 'past'} onClick={setTab} />
                    </div>
                </div>

                {searchable && (
                    <Filters query={query} setQuery={setQuery}
                        sectors={sectors} sector={sector} setSector={setSector}
                        sort={sort} setSort={setSort}
                        onClear={() => { setQuery(''); setSector(''); setSort('needs'); }} />
                )}

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
                    {tab === 'queue' ? (
                        <div className="py-3">
                            <ListHead />
                            {rows.map((item) => (
                                <div key={item.id} className={expanded === item.id
                                    ? 'border-l-2 border-cyan-500 dark:border-cyan-400' : ''}>
                                    <ListRow item={item} open={expanded === item.id}
                                        onExpand={(id) => { setExpanded(id); setOpen(null); }} />
                                    {expanded === item.id && (
                                        <div className="bg-cyan-50/40 dark:bg-cyan-500/5">
                                            <QueueRow item={item} open={open} setOpen={setOpen}
                                                onLook={onLook} onDrop={onDrop} onOpen={onOpen} onTrade={onTrade} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : rows.map((item) => (
                        <PastRow key={item.id} item={item} onOpen={onOpen}
                            onRevive={onRevive} onJournal={onJournal} />
                    ))}
                </div>
            )}
        </div>
    );
}
