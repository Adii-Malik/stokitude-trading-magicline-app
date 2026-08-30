import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, RefreshCw, Check, X, ArrowUpRight, ChevronDown } from 'lucide-react';
import { useWatchlist } from '../../contexts/WatchlistContext';
import { ChartUpload } from '../common/ChartUpload';
import { pct, tone, toSlug } from '../Heatmap/heatmapData';
import { TIMEFRAMES } from '../Heatmap/heatmapConfig';
import { order, dueText, daysSince, lastLookAt, meterFor } from './horizons';

const labelOf = (period) => TIMEFRAMES.find((t) => t.id === period)?.label || period;

const ago = (days) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

const TONE = {
    late: 'text-rose-600 dark:text-rose-400',
    soon: 'text-amber-600 dark:text-amber-400',
    calm: 'text-gray-400 dark:text-gray-500'
};

const STRIPE = {
    late: 'bg-rose-500',
    soon: 'bg-amber-500',
    calm: 'bg-transparent'
};

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
        <div className="mt-2 max-w-md">
            <div className="relative h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
                <span className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-gray-800 ${colour}`}
                    style={{ left: `${m.at * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-gray-400 dark:text-gray-500">
                <span>{m.lo.price.toFixed(2)} {m.lo.label}</span>
                <span className="text-gray-500 dark:text-gray-400">now {m.now.toFixed(2)}</span>
                <span>{m.hi.price.toFixed(2)} {m.hi.label}</span>
            </div>
        </div>
    );
}

/** Everything you thought about this name, newest first, with the charts. */
function Thread({ looks }) {
    if (!looks.length) {
        return (
            <p className="py-1 text-sm text-gray-400 dark:text-gray-500">
                Nothing written down yet.
            </p>
        );
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
                                {look.trigger && `wake me ${look.trigger.dir} ${look.trigger.price.toFixed(2)}`}
                                {look.trigger && look.invalidation && ' · '}
                                {look.invalidation && `dead ${look.invalidation.dir} ${look.invalidation.price.toFixed(2)}`}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * One name, and the one action the whole feature depends on you taking.
 *
 * Open the row, paste the chart, press Enter. Nothing is required - saving with
 * no note and no chart still records that you looked, which resets the clock and
 * is more than the screen knew before.
 */
function Row({ item, onLook, onDrop, onOpen, onTrade, openId, setOpenId }) {
    const [note, setNote] = useState('');
    const [chartUrl, setChartUrl] = useState(null);
    const [busy, setBusy] = useState(false);
    const [showThread, setShowThread] = useState(false);
    // Prefilled from what is armed, so opening a look and pressing Enter leaves
    // your levels alone rather than silently clearing them.
    const [trigger, setTrigger] = useState('');
    const [triggerDir, setTriggerDir] = useState('above');
    const [invalid, setInvalid] = useState('');
    const [invalidDir, setInvalidDir] = useState('below');
    const input = useRef(null);

    const open = openId === item.id;
    const due = dueText(item);
    const looks = item.looks || [];

    useEffect(() => {
        if (!open) return;
        setTrigger(item.trigger ? String(item.trigger.price) : '');
        setTriggerDir(item.trigger?.dir || 'above');
        setInvalid(item.invalidation ? String(item.invalidation.price) : '');
        setInvalidDir(item.invalidation?.dir || 'below');
        input.current?.focus();
    }, [open, item.trigger, item.invalidation]);

    const priceOf = (v) => (v.trim() === '' ? null : Number(v));

    const save = async () => {
        setBusy(true);
        try {
            const t = priceOf(trigger);
            const v = priceOf(invalid);
            await onLook(item, {
                note: note.trim(),
                chartUrl,
                trigger: t == null || Number.isNaN(t) ? null : { price: t, dir: triggerDir },
                invalidation: v == null || Number.isNaN(v) ? null : { price: v, dir: invalidDir }
            });
            setNote(''); setChartUrl(null); setOpenId(null);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="relative border-t border-gray-200 px-4 py-3 first:border-t-0 dark:border-gray-700">
            {/* The stripe hints; the words carry it. */}
            <span className={`absolute inset-y-0 left-0 w-[3px] ${STRIPE[due.tone]}`} />

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <button type="button" onClick={() => onOpen(item)}
                    className="font-mono font-semibold text-gray-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400">
                    {item.symbol}
                </button>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">{item.name}</span>
                <span className={`whitespace-nowrap text-sm font-semibold ${TONE[due.tone]}`}>{due.text}</span>
                <button type="button" onClick={() => onDrop(item)} title={`Not interested in ${item.symbol}`}
                    className="rounded p-1 text-gray-300 opacity-60 hover:bg-gray-100 hover:text-rose-600 hover:opacity-100 dark:text-gray-600 dark:hover:bg-gray-700">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                <button type="button" onClick={() => onOpen(item)}
                    className="underline decoration-gray-300 underline-offset-2 hover:text-cyan-600 dark:decoration-gray-600 dark:hover:text-cyan-400">
                    {item.sector} · {labelOf(item.period).toLowerCase()}
                </button>
                <span>
                    {looks.length
                        ? `${looks.length} look${looks.length === 1 ? '' : 's'} · last ${ago(daysSince(lastLookAt(item)))}`
                        : `flagged ${ago(daysSince(item.noticedAt))}, never looked at`}
                </span>
                <span className="ml-auto"><Drift item={item} /></span>
            </div>

            {!open && <Meter item={item} />}

            {open ? (
                <div className="mt-2.5 flex flex-col gap-2">
                    <ChartUpload value={chartUrl} onChange={setChartUrl} />
                    {/* Both optional, and skipping them is the common case. They
                        sit after the note because the note is the thing that
                        matters and a price is a convenience on top of it. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                            Wake me
                            <select value={triggerDir} onChange={(e) => setTriggerDir(e.target.value)}
                                aria-label={`Trigger direction for ${item.symbol}`}
                                className="rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                                <option value="above">above</option>
                                <option value="below">below</option>
                            </select>
                            <input type="text" inputMode="decimal" value={trigger}
                                onChange={(e) => setTrigger(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                                placeholder="price" aria-label={`Trigger price for ${item.symbol}`}
                                className="w-20 rounded border border-gray-300 bg-white px-2 py-1 font-mono tabular-nums dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            Dead
                            <select value={invalidDir} onChange={(e) => setInvalidDir(e.target.value)}
                                aria-label={`Invalidation direction for ${item.symbol}`}
                                className="rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                                <option value="below">below</option>
                                <option value="above">above</option>
                            </select>
                            <input type="text" inputMode="decimal" value={invalid}
                                onChange={(e) => setInvalid(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                                placeholder="price" aria-label={`Invalidation price for ${item.symbol}`}
                                className="w-20 rounded border border-gray-300 bg-white px-2 py-1 font-mono tabular-nums dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                        </span>
                        <span className="text-gray-400 dark:text-gray-500">both optional</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            ref={input}
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') save();
                                if (e.key === 'Escape') { setOpenId(null); setNote(''); setChartUrl(null); }
                            }}
                            maxLength={280}
                            placeholder="What did you see? Optional."
                            aria-label={`Note for ${item.symbol}`}
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <button type="button" onClick={save} disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:opacity-60">
                            <Check className="h-4 w-4" /> {busy ? 'Saving…' : 'Save look'}
                        </button>
                        <button type="button" onClick={() => { setOpenId(null); setNote(''); setChartUrl(null); }}
                            className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setOpenId(item.id)}
                        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-cyan-500 hover:text-cyan-600 dark:border-gray-600 dark:text-gray-300 dark:hover:text-cyan-400">
                        I looked at this
                    </button>
                    <button type="button" onClick={() => onTrade(item)}
                        className="rounded-lg border border-transparent px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400">
                        I bought it
                    </button>
                    {looks.length > 0 && (
                        <button type="button" onClick={() => setShowThread((v) => !v)}
                            aria-expanded={showThread}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 hover:text-cyan-600 dark:text-gray-500 dark:hover:text-cyan-400">
                            {showThread ? 'Hide' : 'What I thought before'}
                            <ChevronDown className={`h-3 w-3 transition-transform ${showThread ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
            )}

            {showThread && !open && (
                <div className="mt-1 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                    <Thread looks={looks} />
                </div>
            )}
        </div>
    );
}

/**
 * Everything you flagged and have not finished with.
 *
 * Most in need of you first, so the top of the screen is always the next thing
 * to do. The order is settled on load and does not move while you work: a queue
 * that re-sorts under the cursor is how you click the wrong row.
 */
export default function WatchlistPage() {
    const navigate = useNavigate();
    const { items, loading, error, reload, unflag, update, look, trade, counts } = useWatchlist();
    const [openId, setOpenId] = useState(null);

    // Settled once per load of the data, deliberately.
    const rows = useMemo(() => order(items), [items]);

    const onLook = (item, body) => look(item.id, body);
    const onDrop = (item) => (item.looks?.length ? update(item.id, { state: 'dropped' }) : unflag(item.id));
    const onOpen = (item) => navigate(`/heatmap/${toSlug(item.sector)}?over=${item.period}`);

    /**
     * The one place this screen hands over to the journal.
     *
     * It asks for the two numbers only the broker knows and invents neither -
     * putting a fill price in the journal that nobody paid is the mistake its
     * own comments warn about. The stop defaults to the price you already said
     * would kill the idea, which is usually the right answer and always editable.
     */
    const onTrade = async (item) => {
        const price = window.prompt(`What did you pay for ${item.symbol}?`, item.priceNow ?? '');
        if (price === null || price.trim() === '') return;
        const qty = window.prompt(`How many ${item.symbol}?`, '');
        if (qty === null || qty.trim() === '') return;
        try {
            await trade(item.id, { entryPrice: Number(price), quantity: Number(qty) });
            navigate('/journal');
        } catch (e) {
            window.alert(e.response?.data?.message || 'Could not log that trade');
        }
    };

    return (
        <div className="container mx-auto space-y-4 px-4 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                <div>
                    <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
                        <Bookmark className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                        Shortlist
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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

            {error && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-rose-600 dark:border-gray-700 dark:bg-gray-800 dark:text-rose-400">
                    {error}
                </div>
            )}

            {!error && !rows.length && (
                <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                    <p className="font-medium text-gray-900 dark:text-white">
                        {loading ? 'Reading your shortlist…' : 'Nothing flagged yet.'}
                    </p>
                    {!loading && (
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
                        <Row key={item.id} item={item}
                            onLook={onLook} onDrop={onDrop} onOpen={onOpen} onTrade={onTrade}
                            openId={openId} setOpenId={setOpenId} />
                    ))}
                </div>
            )}

            {rows.length > 0 && (
                <p className="px-1 text-xs text-gray-400 dark:text-gray-500">
                    A name asks for you when its horizon runs out since the last look — two
                    days on a weekly idea, two weeks on a monthly one, two months on a yearly
                    one. Looking at it resets the clock, whatever you conclude.
                </p>
            )}
        </div>
    );
}
