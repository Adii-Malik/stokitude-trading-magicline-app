import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldAlert, Target, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWatchlist } from '../contexts/WatchlistContext';
import { hasFired, isLive } from './Watchlist/horizons';
import api from '../services/api';

/**
 * The first screen, and it gets about five seconds.
 *
 * Two rules hold the whole thing together, and both came out of the same
 * complaint: that reading it meant working out, column by column, which part of
 * the app you were looking at.
 *
 *   every fact has one owner   Ideas, Journal or Portfolios - the three doors -
 *                              and the detail below repeats that order, labelled.
 *                              Anything belonging to none of them is market
 *                              context and sits above the divider with the doors.
 *
 *   tiles are now, panels      A tile says what is live and whether it needs you.
 *   are over time              A panel says what that part of the app has produced
 *                              across everything you have ever done in it. The
 *                              moment a fact appears in both, one of them is wrong.
 *
 * Everything states a count or a comparison over the whole pool. No line here
 * names one flag or describes one trade: prose reads well at one item and falls
 * apart at a hundred.
 */

const money = (n, dp = 0) => (n == null ? '—' : Number(n).toLocaleString(undefined, {
    minimumFractionDigits: dp, maximumFractionDigits: dp
}));

const signed = (n) => (n == null ? '—' : `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`);
const pct = (n, dp = 1) => (n == null ? '—' : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(dp)}%`);

const LABEL = 'text-xs font-semibold text-gray-500 dark:text-gray-400';
const SUB = 'text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500';

/**
 * The window every sector figure is read over.
 *
 * A day of a sector's median is noise - a sector is not moving because it had a
 * morning. A month is the horizon a swing book is actually traded on, and long
 * enough that a rotation shows up as one.
 */
const MONTH = 'Perf.1M';

/** Below this, a sector's median is one company wearing a sector's name. */
const MIN_MEMBERS = 3;

/** One row, one problem, and never an example standing in for the rest. */
function Alert({ tone, icon: Icon, headline, detail, action, onAct }) {
    const skin = tone === 'fired'
        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
        : 'border-rose-500 bg-rose-50 dark:bg-rose-500/10';
    const ink = tone === 'fired' ? 'text-cyan-700 dark:text-cyan-300' : 'text-rose-600 dark:text-rose-400';
    const button = tone === 'fired'
        ? 'bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-400 dark:text-cyan-950 dark:hover:bg-cyan-300'
        : 'bg-rose-500 hover:bg-rose-600 dark:bg-rose-400 dark:text-rose-950 dark:hover:bg-rose-300';

    return (
        <div className={`flex flex-wrap items-center gap-4 rounded-xl border border-l-4 px-5 py-4 ${skin}`}>
            <Icon className={`h-5 w-5 shrink-0 ${ink}`} />
            <div className="min-w-72 flex-1">
                <p className="text-base text-gray-900 dark:text-white">{headline}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
            </div>
            <button type="button" onClick={onAct}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${button}`}>
                {action}
            </button>
        </div>
    );
}

/**
 * A door, carrying what is live behind it right now.
 *
 * The number has to be the thing the label names. "Portfolios / 5" over a book
 * of two portfolios and five holdings is not a shorthand, it is a wrong number -
 * and once one door lies the other two stop being read.
 */
function Door({ label, count, detail, hot, onClick }) {
    return (
        <button type="button" onClick={onClick}
            className={`rounded-xl border px-5 py-4 text-left transition hover:border-cyan-500 hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                hot ? 'border-amber-400 dark:border-amber-500/60' : 'border-gray-200 dark:border-gray-700'
            }`}>
            <span className={`flex items-center justify-between ${LABEL}`}>
                {label}<ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
            </span>
            <span className={`mt-2 block font-mono text-3xl font-semibold leading-none tracking-tight ${
                count == null ? 'text-gray-300 dark:text-gray-600'
                    : hot ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'
            }`}>
                {count == null ? '—' : count}
            </span>
            <span className="mt-2 block text-sm leading-snug text-gray-500 dark:text-gray-400">{detail}</span>
        </button>
    );
}

/** A sector line: name, one supporting figure, the move. */
function SectorRow({ name, note, change }) {
    return (
        <div className="flex items-baseline gap-4">
            <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-gray-900 dark:text-white">
                {name}
            </span>
            <span className="shrink-0 font-mono text-xs text-gray-400 dark:text-gray-500">{note}</span>
            <span className={`w-16 shrink-0 text-right font-mono text-sm ${
                change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
                {pct(change)}
            </span>
        </div>
    );
}

/**
 * The market, over a month. Above the divider because it belongs to none of the
 * three doors - it is the weather, not something you have done.
 */
function Sectors({ board, holdings, onOpen }) {
    const ranked = useMemo(() => rankSectors(board), [board]);
    const mine = useMemo(() => sectorsHeld(holdings, board), [holdings, board]);
    if (!ranked.length) return null;

    const up = ranked.filter((s) => s.change > 0).length;
    const inTrouble = Math.round(mine.filter((s) => s.change != null && s.change <= 0)
        .reduce((a, s) => a + s.share, 0));

    return (
        <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
            <div className="mb-4 flex items-baseline justify-between gap-4">
                <span className={LABEL}>Sectors · past month</span>
                <button type="button" onClick={onOpen}
                    className="text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                    Heatmap →
                </button>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-4">
                <span className="flex h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <i className="block h-full bg-emerald-500" style={{ width: `${(up / ranked.length) * 100}%` }} />
                    <i className="block h-full flex-1 bg-rose-500" />
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    <b className="font-semibold text-gray-900 dark:text-white">{up}</b> of{' '}
                    <b className="font-semibold text-gray-900 dark:text-white">{ranked.length}</b> up this month
                    {inTrouble > 0 && <> · <b className="font-semibold text-gray-900 dark:text-white">{inTrouble}%</b> of your book is in ones that are not</>}
                </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
                {mine.length > 0 && (
                    <div>
                        <p className={`${SUB} mb-3 border-b border-gray-200 pb-2 dark:border-gray-700`}>Where you are</p>
                        <div className="flex flex-col gap-2">
                            {mine.slice(0, 3).map((s) => (
                                <SectorRow key={s.sector} name={s.sector}
                                    note={`${Math.round(s.share)}%`} change={s.change} />
                            ))}
                        </div>
                    </div>
                )}
                <div>
                    <p className={`${SUB} mb-3 border-b border-gray-200 pb-2 dark:border-gray-700`}>What is running</p>
                    <div className="flex flex-col gap-2">
                        {ranked.slice(0, 3).map((s) => (
                            <SectorRow key={s.sector} name={s.sector}
                                note={`${s.up}/${s.count}`} change={s.change} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** One question, one comparison, one line of context. The same shape three times. */
function Pane({ label, tone, question, rows, footer }) {
    return (
        <div>
            <p className={`${SUB} border-b-2 pb-2 ${tone}`}>{label}</p>
            <p className="mb-4 mt-3 text-sm italic text-gray-500 dark:text-gray-400">{question}</p>
            {rows.map((r) => (
                <div key={r.key} className="mb-2 flex items-baseline justify-between gap-4">
                    <span className={SUB}>{r.key}</span>
                    <span className={`font-mono text-lg font-semibold ${r.tone || 'text-gray-900 dark:text-white'}`}>
                        {r.value}
                    </span>
                </div>
            ))}
            <p className="mt-4 border-t border-gray-200 pt-3 text-sm leading-snug text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {footer}
            </p>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { items, counts, loaded: ideasLoaded } = useWatchlist();
    const now = useClock();

    const [book, setBook] = useState(null);
    const [stats, setStats] = useState(null);
    const [open, setOpen] = useState([]);
    const [board, setBoard] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            // Everything that can be asked for at once, is. Each one fails on
            // its own: a slow morning at TradingView is not a reason for the
            // screen to have no numbers on it.
            const [ports, statsRes, openRes, boardRes] = await Promise.all([
                api.get('/portfolios').catch(() => null),
                api.get('/journal/stats').catch(() => null),
                // status, not state: the list endpoint filters on the derived
                // status and silently ignores anything it does not know, so
                // `state` asked for every trade ever written and the stop alert
                // counted closed ones. limit, because the default page is 25 and
                // a truncated page would understate the exposure without saying so.
                api.get('/journal', { params: { status: 'open', limit: 200 } }).catch(() => null),
                api.get('/heatmap/sectors').catch(() => null)
            ]);

            setStats(statsRes?.data?.data || null);
            setOpen(openRes?.data?.data || []);
            setBoard(boardRes?.data?.data || null);

            const list = ports?.data?.data || [];
            const boards = await Promise.all(
                list.map((p) => api.get(`/portfolios/${p._id}/dashboard`)
                    .then((r) => ({ ...r.data.data, currency: p.currency }))
                    .catch(() => null))
            );
            const live = boards.filter(Boolean);
            setBook(live.length ? { ...live.reduce(sumBooks), portfolios: live.length } : null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const account = book ? (book.totalValue || 0) + (book.cashBalance || 0) : null;
    const cashPct = account ? Math.round((book.cashBalance / account) * 100) : null;

    const fired = useMemo(() => items.filter(hasFired), [items]);
    const watching = useMemo(() => items.filter(isLive).length, [items]);
    const naked = useMemo(() => open.filter((t) => t.plannedStop == null), [open]);
    const exposure = naked.reduce((a, t) => a + (t.entryPrice || 0) * (t.quantity || 0), 0);

    /**
     * Both kinds, both shown.
     *
     * These were a ternary, so a printed level hid an unprotected position
     * entirely - the more that was wrong, the less you were told, which is the
     * one failure an alert cannot have. There are only two kinds and both are
     * rare, so two rows can never become noise.
     *
     * Neither headline picks an example. A single name is stated because it is
     * the whole set; several are listed while they fit and counted when they do
     * not, and the second line aggregates rather than describing whichever
     * happened to sort first.
     */
    const alerts = [];
    if (fired.length) {
        alerts.push({
            tone: 'fired', icon: Target,
            headline: fired.length === 1
                ? <><b className="font-mono">{fired[0].symbol}</b> hit{' '}
                    {fired[0].triggeredPrice == null ? 'your level' : money(fired[0].triggeredPrice, 2)}</>
                : <>{fired.length} levels printed</>,
            detail: fired.length === 1 ? 'a price you named' : names(fired),
            action: 'Open', onAct: () => navigate('/watchlist')
        });
    }
    if (naked.length) {
        alerts.push({
            tone: 'risk', icon: ShieldAlert,
            headline: naked.length === 1
                ? <><b className="font-mono">{naked[0].symbol}</b> has no stop</>
                : <>{naked.length} positions have no stop</>,
            detail: `${money(exposure)} exposed${
                book?.totalValue ? ` · ${Math.round((exposure / book.totalValue) * 100)}% of the book` : ''}`,
            action: naked.length === 1 ? 'Set a stop' : 'Set stops', onAct: () => navigate('/journal')
        });
    }

    /**
     * Was my filtering any good? Traded against passed, since the day each was
     * flagged. Medians, because one name that ran sixty percent would drag an
     * average until the panel called your screening brilliant on the strength
     * of a single trade.
     */
    const screening = useMemo(() => ({
        traded: drift(items.filter((i) => i.state === 'traded')),
        passed: drift(items.filter((i) => i.state === 'dropped')),
        flagged: items.length
    }), [items]);

    /**
     * Did it actually make money? Not the win rate alone - a losing hit rate
     * with a big enough edge is a working system, and either number on its own
     * would say the opposite of the truth.
     */
    const edge = useMemo(() => {
        const r = book?.results;
        if (!r?.won || !r?.lost) return null;
        return (r.wonSum / r.won) / (r.lostSum / r.lost);
    }, [book]);

    const firstName = (user?.username || '').split(' ')[0];

    if (loading && !book && !stats) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="rounded-xl border border-gray-200 bg-white p-10 dark:border-gray-700 dark:bg-gray-800">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-500" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {greeting(now)}{firstName ? `, ${firstName}` : ''}
                    </h1>
                    <button type="button" onClick={load}
                        className="flex items-center gap-2 font-mono text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {today(now)}
                    </button>
                </div>

                {/* One number, big enough that nothing competes to be seen first. */}
                <p className="mt-4 font-mono text-5xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white">
                    <span className="mr-2 text-lg font-medium text-gray-500 dark:text-gray-400">
                        {book?.currency || 'PKR'}
                    </span>
                    {account == null ? '—' : money(account)}
                </p>

                {book ? (
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>
                            <b className="font-mono font-semibold">{money(book.totalValue)}</b> invested ·{' '}
                            <b className="font-mono font-semibold">{money(book.cashBalance)}</b> cash
                        </span>
                        <span className={book.unrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            <b className="font-mono font-semibold">{signed(book.unrealizedPnL)}</b> unrealised
                        </span>
                        <span className={book.realizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            <b className="font-mono font-semibold">{signed(book.realizedPnL)}</b> booked
                        </span>

                        {/*
                            The figure above is the whole account, and until this
                            existed there was nothing to say when it wasn't. A US
                            book had no price feed at all, so every holding valued
                            at zero and the screen reported a fully invested
                            account as all cash - confidently, with no asterisk.
                            Naming the holdings makes the gap checkable.
                        */}
                        {book.unpriced?.length > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                                excludes{' '}
                                <b className="font-mono font-semibold">{book.unpriced.join(', ')}</b>
                                {' '}· no price
                            </span>
                        )}
                    </div>
                ) : (
                    <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
                        No portfolio on this market yet.
                    </p>
                )}

                {alerts.length > 0 && (
                    <div className="mt-6 flex flex-col gap-2">
                        {alerts.map((a) => <Alert key={a.tone} {...a} />)}
                    </div>
                )}

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <Door label="Ideas" hot={counts.due > 0}
                        count={ideasLoaded ? watching || null : null}
                        detail={!ideasLoaded ? '' : !watching ? 'nothing flagged'
                            : counts.due
                                ? <>watching · <b className="font-semibold text-gray-900 dark:text-white">
                                    {fired.length ? 'a level printed' : `${counts.due} never opened`}</b></>
                                : 'watching'}
                        onClick={() => navigate('/watchlist')} />
                    <Door label="Journal"
                        count={stats?.openTrades || null}
                        detail={stats?.openTrades
                            // The alert above is already shouting this one. A tile
                            // that shouts it too is the same fact three times over.
                            ? (stats.openWithoutStop && !naked.length
                                ? <>open · <b className="font-semibold text-gray-900 dark:text-white">none protected</b></>
                                : 'open')
                            : 'nothing open'}
                        onClick={() => navigate('/journal')} />
                    <Door label="Portfolios"
                        count={book?.portfolios || null}
                        detail={cashPct == null
                            ? 'no book yet'
                            : <><b className="font-semibold text-gray-900 dark:text-white">{book.holdingsCount}</b> holdings · <b className="font-semibold text-gray-900 dark:text-white">{cashPct}%</b> in cash</>}
                        onClick={() => navigate('/portfolios')} />
                </div>

                <Sectors board={board} holdings={book?.holdingValues} onOpen={() => navigate('/heatmap')} />
            </div>

            {/* The same three subjects, in the same order, each answering its own question. */}
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                <div className="grid gap-6 sm:grid-cols-3">
                    <Pane label="Ideas" tone="border-violet-500 text-violet-600 dark:text-violet-400"
                        question="Is my filtering any good?"
                        rows={[
                            { key: 'traded', value: pct(screening.traded, 0), tone: toneOf(screening.traded) },
                            { key: 'passed', value: pct(screening.passed, 0), tone: toneOf(screening.passed) }
                        ]}
                        footer={screening.flagged
                            ? `median move since the day you flagged them, over ${screening.flagged} flag${screening.flagged === 1 ? '' : 's'}`
                            : 'nothing flagged yet'} />

                    <Pane label="Journal" tone="border-cyan-500 text-cyan-600 dark:text-cyan-400"
                        question="Do I plan, or do I react?"
                        rows={[
                            { key: 'planned first', value: ratio(stats?.plannedFirst), tone: shortOf(stats?.plannedFirst) },
                            { key: 'stop before entry', value: ratio(stats?.stopBeforeEntry), tone: shortOf(stats?.stopBeforeEntry) }
                        ]}
                        footer={stats?.closedTrades
                            ? `${stats.closedTrades} closed here · expectancy ${money(stats.expectancy)}`
                            : 'nothing closed here yet'} />

                    <Pane label="Portfolios" tone="border-amber-500 text-amber-600 dark:text-amber-400"
                        question="Did it actually make money?"
                        rows={[
                            { key: 'won', value: book?.results?.decided ? `${book.results.won} of ${book.results.decided}` : '—' },
                            { key: 'edge', value: edge ? `${edge.toFixed(1)}×` : '—',
                                tone: edge && edge >= 1 ? 'text-emerald-600 dark:text-emerald-400' : undefined }
                        ]}
                        footer={book
                            ? <>{signed((book.realizedPnL || 0) + (book.totalDividends || 0))} earned,{' '}
                                {money((book.totalFees || 0) + (book.capitalGainsTax || 0))} of it back in fees and tax</>
                            : 'no book yet'} />
                </div>
            </div>
        </div>
    );
}

/** Green above zero, red below, grey when there is nothing to say. */
const toneOf = (n) => (n == null ? 'text-gray-300 dark:text-gray-600'
    : n >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');

/** Amber when most of the pool falls the wrong side of a habit worth keeping. */
const shortOf = (r) => (!r?.of ? 'text-gray-300 dark:text-gray-600'
    : r.n / r.of < 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white');

const ratio = (r) => (r?.of ? `${r.n} of ${r.of}` : '—');

/** Up to three names; past that the count has already said it. */
const names = (list) => (list.length <= 3
    ? list.map((i) => i.symbol).join(' · ')
    : `${list.slice(0, 3).map((i) => i.symbol).join(' · ')} and ${list.length - 3} more`);

/**
 * The median move since each was flagged, or null.
 *
 * Median rather than mean for the reason the panel exists: this is a claim
 * about most of your decisions, and a mean makes it a claim about the best one.
 */
function drift(list) {
    const moves = list
        .filter((i) => i.priceWhenNoticed > 0 && i.priceNow != null)
        .map((i) => ((i.priceNow - i.priceWhenNoticed) / i.priceWhenNoticed) * 100)
        .sort((a, b) => a - b);
    if (!moves.length) return null;
    const mid = Math.floor(moves.length / 2);
    return moves.length % 2 ? moves[mid] : (moves[mid - 1] + moves[mid]) / 2;
}

/**
 * Sectors ranked over the month, thin ones dropped rather than flagged.
 *
 * A sector of one company has a median that is simply that company, and it will
 * top or bottom the board on any day it moves. Ranking that against a
 * nineteen-company sector is not a comparison.
 */
function rankSectors(board) {
    return (board?.sectors || [])
        .filter((s) => s.count >= MIN_MEMBERS && s.periods?.[MONTH]?.median != null)
        .map((s) => ({
            sector: s.sector, count: s.count,
            change: s.periods[MONTH].median, up: s.periods[MONTH].up
        }))
        .sort((a, b) => b.change - a.change);
}

/**
 * Your money grouped by sector, weighted against the whole book.
 *
 * Against the combined total, not each book's own percentages: those have
 * different denominators, so adding them ranks a name at 30% of a small account
 * above one at 20% of a large one though it is a twentieth of the size.
 *
 * A holding the board does not carry - an ETF, a name below its cap - has no
 * sector and is left out, which understates the shares rather than inventing a
 * grouping for it.
 */
function sectorsHeld(holdings, board) {
    const total = (holdings || []).reduce((a, h) => a + (h.value || 0), 0);
    if (!total || !board?.sectors) return [];

    const sectorOf = new Map();
    const changeOf = new Map();
    for (const s of board.sectors) {
        changeOf.set(s.sector, s.periods?.[MONTH]?.median ?? null);
        for (const stock of s.stocks || []) sectorOf.set(stock.symbol, s.sector);
    }

    const bySector = new Map();
    for (const h of holdings) {
        const sector = sectorOf.get(h.symbol);
        if (!sector) continue;
        bySector.set(sector, (bySector.get(sector) || 0) + h.value);
    }

    return [...bySector.entries()]
        .map(([sector, value]) => ({ sector, share: (value / total) * 100, change: changeOf.get(sector) }))
        .sort((a, b) => b.share - a.share);
}

/** Sums the dashboards of every portfolio on this market. Usually there is one. */
function sumBooks(a, b) {
    const add = (k) => (a[k] || 0) + (b[k] || 0);
    const won = (k) => (a.results?.[k] || 0) + (b.results?.[k] || 0);
    return {
        currency: a.currency || b.currency,
        totalValue: add('totalValue'), cashBalance: add('cashBalance'),
        unrealizedPnL: add('unrealizedPnL'), realizedPnL: add('realizedPnL'),
        totalDividends: add('totalDividends'), totalFees: add('totalFees'),
        capitalGainsTax: add('capitalGainsTax'),
        holdingsCount: add('holdingsCount'), closedCount: add('closedCount'),
        // Names, not a count: two books can each be missing a price and the
        // reader wants to know which names, not that "2" of something is wrong.
        unpriced: [...(a.unpriced || []), ...(b.unpriced || [])],
        // Values, so every weight is worked out once against the combined total.
        holdingValues: [...(a.holdingValues || []), ...(b.holdingValues || [])],
        // Sums add; the averages are taken after the totals stop growing.
        results: {
            won: won('won'), lost: won('lost'), decided: won('decided'),
            wonSum: won('wonSum'), lostSum: won('lostSum')
        }
    };
}

/**
 * Four parts of the day, not three.
 *
 * This read "morning" from midnight, so anyone opening the screen at two in the
 * morning - which is when this app gets used - was wished good morning every
 * single time. The small hours belong to the evening that has not ended yet.
 */
const greeting = (at) => {
    const h = at.getHours();
    if (h < 5) return 'Good evening';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

const today = (at) => at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * The clock, so a tab left open does not keep yesterday's date and the wrong
 * greeting. Both were computed once at mount, which is correct for exactly as
 * long as you keep reloading.
 */
function useClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(id);
    }, []);
    return now;
}
