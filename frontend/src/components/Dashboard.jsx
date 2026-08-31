import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldAlert, Target, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWatchlist } from '../contexts/WatchlistContext';
import { hasFired } from './Watchlist/horizons';
import api from '../services/api';

/**
 * The first screen, and it gets about five seconds.
 *
 * What was here answered "what are my numbers" out of a single endpoint - three
 * counts, a panel repeating two of them, and a gradient describing the product
 * to the person already using it. It knew nothing about the book, the shortlist
 * or the board.
 *
 * What replaced it answers "what do I do now", in the order you would ask it:
 * what am I worth, is anything wrong, which door do I walk through. Anything
 * that is detail rather than a decision moved below the fold, because a screen
 * answering every question at once is a report, and a report does not get read
 * at eight in the morning.
 */

const money = (n, dp = 0) => (n == null ? '—' : Number(n).toLocaleString(undefined, {
    minimumFractionDigits: dp, maximumFractionDigits: dp
}));

const signed = (n) => (n == null ? '—' : `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`);

const LABEL = 'text-xs font-semibold text-gray-500 dark:text-gray-400';

/** One thing being wrong, said with the number that makes it matter. */
function Alert({ tone, icon: Icon, headline, detail, action, onAct }) {
    const skin = tone === 'fired'
        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
        : 'border-rose-500 bg-rose-50 dark:bg-rose-500/10';
    const ink = tone === 'fired' ? 'text-cyan-700 dark:text-cyan-300' : 'text-rose-600 dark:text-rose-400';

    return (
        <div className={`mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-l-4 px-5 py-4 ${skin}`}>
            <Icon className={`h-5 w-5 shrink-0 ${ink}`} />
            <div className="min-w-72 flex-1">
                <p className="text-base text-gray-900 dark:text-white">{headline}</p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
            </div>
            <button type="button" onClick={onAct}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 dark:bg-cyan-400 dark:text-cyan-950 dark:hover:bg-cyan-300">
                {action}
            </button>
        </div>
    );
}

/** A door, carrying the one number that says whether to walk through it. */
function Door({ label, count, detail, hot, onClick }) {
    return (
        <button type="button" onClick={onClick}
            className={`rounded-xl border px-5 py-4 text-left transition hover:border-cyan-500 hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                hot ? 'border-amber-400 dark:border-amber-500/60' : 'border-gray-200 dark:border-gray-700'
            }`}>
            <span className={`flex items-center justify-between ${LABEL}`}>
                {label}<ArrowRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
            </span>
            <span className={`mt-2 block font-mono text-3xl font-semibold leading-none tracking-tight ${
                count == null ? 'text-gray-300 dark:text-gray-600'
                    : hot ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'
            }`}>
                {count == null ? '—' : count}
            </span>
            <span className="mt-1.5 block text-sm leading-snug text-gray-500 dark:text-gray-400">{detail}</span>
        </button>
    );
}

/** The only thing on the screen that changes daily. */
function Sectors({ rows, onOpen }) {
    if (!rows.length) return null;
    const biggest = Math.max(...rows.map((r) => Math.abs(r.change)));
    return (
        <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
            <div className="mb-4 flex items-baseline justify-between">
                <span className={LABEL}>Sectors moving today</span>
                <button type="button" onClick={onOpen}
                    className="text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                    Heatmap →
                </button>
            </div>
            <div className="flex flex-col gap-2">
                {rows.map((r) => (
                    <div key={r.sector} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 truncate font-mono text-xs font-semibold text-gray-900 dark:text-white">
                            {r.sector}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                            <i className={`block h-full rounded-full ${r.change >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                style={{ width: `${Math.max(4, (Math.abs(r.change) / biggest) * 100)}%` }} />
                        </span>
                        <span className={`w-16 shrink-0 text-right font-mono text-sm ${
                            r.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                            {r.change >= 0 ? '+' : '−'}{Math.abs(r.change).toFixed(2)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** A panel below the fold: a figure, the proportion drawn, one sentence. */
function Deeper({ title, figure, unit, segments, children }) {
    return (
        <div>
            <p className={`${LABEL} mb-3`}>{title}</p>
            <p className="font-mono text-3xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white">
                {figure}
                {unit && <span className="ml-1.5 font-sans text-sm font-medium text-gray-500 dark:text-gray-400">{unit}</span>}
            </p>
            {segments && (
                <span className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    {segments.map((seg, i) => (
                        <i key={i} className={`block h-full ${seg.c}`} style={{ width: `${seg.w}%` }} />
                    ))}
                </span>
            )}
            <p className="mt-2 text-sm leading-snug text-gray-500 dark:text-gray-400">{children}</p>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { items, counts } = useWatchlist();

    const [book, setBook] = useState(null);
    const [stats, setStats] = useState(null);
    const [open, setOpen] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            /**
             * Everything that can be asked for at once, is.
             *
             * The board used to be fetched after the portfolio dashboards even
             * though it depends on neither - three waves of waiting where only
             * one is forced, since the per-portfolio call is the sole request
             * that needs an answer first. Each one still fails on its own: a
             * slow morning at TradingView is not a reason for the screen to
             * have no numbers on it.
             */
            const [ports, statsRes, openRes, board] = await Promise.all([
                api.get('/portfolios').catch(() => null),
                api.get('/journal/stats').catch(() => null),
                api.get('/journal', { params: { state: 'open' } }).catch(() => null),
                api.get('/heatmap/sectors').catch(() => null)
            ]);

            setStats(statsRes?.data?.data || null);
            setOpen(openRes?.data?.data || []);
            setSectors(topMovers(board?.data?.data?.sectors || []));

            const list = ports?.data?.data || [];
            const boards = await Promise.all(
                list.map((p) => api.get(`/portfolios/${p._id}/dashboard`)
                    .then((r) => ({ ...r.data.data, currency: p.currency }))
                    .catch(() => null))
            );
            const live = boards.filter(Boolean);
            setBook(live.length ? live.reduce(sumBooks) : null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const account = book ? (book.totalValue || 0) + (book.cashBalance || 0) : null;
    const cashPct = account ? Math.round((book.cashBalance / account) * 100) : null;

    const fired = useMemo(() => items.filter(hasFired), [items]);
    const naked = useMemo(() => open.filter((t) => t.plannedStop == null), [open]);
    const exposure = naked.reduce((a, t) => a + (t.entryPrice || 0) * (t.quantity || 0), 0);

    /**
     * One alert, and only when something is actually wrong.
     *
     * A level printing outranks an unguarded position: you asked to be
     * interrupted for that number, where the open trade has been sitting there
     * all along. Everything quieter is left to the doors - a banner reading
     * "nothing needs you" is a reward once and furniture by the third morning.
     */
    const alert = fired.length ? {
        tone: 'fired', icon: Target,
        headline: <>A level you named on <b className="font-mono">{fired[0].symbol}</b> printed</>,
        detail: fired.length > 1
            ? `and ${fired.length - 1} more since you last looked`
            : 'you asked to be told when it got there',
        action: 'Go and look', onAct: () => navigate('/watchlist')
    } : naked.length ? {
        tone: 'risk', icon: ShieldAlert,
        headline: <>
            <b className="font-mono">{money(exposure)}</b> of {naked.map((t) => t.symbol).join(', ')} has no stop under it
        </>,
        detail: naked.length === 1
            ? `${money(naked[0].quantity)} shares in at ${money(naked[0].entryPrice, 2)}${
                book?.totalValue ? ` — ${Math.round((exposure / book.totalValue) * 100)}% of the book` : ''}`
            : `${naked.length} positions with nothing defending them`,
        action: 'Set a stop', onAct: () => navigate('/journal')
    } : null;

    const concentration = useMemo(() => {
        const top = (book?.topHoldings || []).slice(0, 3);
        return { top, pct: Math.round(top.reduce((a, h) => a + (h.weightPct || 0), 0)) };
    }, [book]);

    const funnel = useMemo(() => ({
        total: items.length,
        traded: items.filter((i) => i.state === 'traded').length,
        passed: items.filter((i) => i.state === 'dropped').length,
        killed: items.filter((i) => i.state === 'invalidated').length
    }), [items]);

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
                        {greeting()}{firstName ? `, ${firstName}` : ''}
                    </h1>
                    <button type="button" onClick={load}
                        className="flex items-center gap-2 font-mono text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {today()}
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
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-gray-500 dark:text-gray-400">
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
                    </div>
                ) : (
                    <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
                        No portfolio on this market yet.
                    </p>
                )}

                {alert && <Alert {...alert} />}

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <Door label="Ideas" hot={counts.due > 0}
                        count={counts.due || null}
                        detail={counts.due
                            ? (fired.length ? 'a level printed' : 'flagged, never opened')
                            : 'nothing waiting'}
                        onClick={() => navigate('/watchlist')} />
                    <Door label="Journal"
                        count={stats?.openTrades || null}
                        detail={stats?.openTrades
                            ? (stats.openWithoutStop
                                ? <>open · <b className="font-semibold text-gray-900 dark:text-white">none protected</b></>
                                : 'open · stop set')
                            : 'nothing open'}
                        onClick={() => navigate('/journal')} />
                    <Door label="Portfolios"
                        count={book?.holdingsCount || null}
                        detail={cashPct == null
                            ? 'no book yet'
                            : <>holdings · <b className="font-semibold text-gray-900 dark:text-white">{cashPct}%</b> in cash</>}
                        onClick={() => navigate('/portfolios')} />
                </div>

                <Sectors rows={sectors} onOpen={() => navigate('/heatmap')} />
            </div>

            {/* Detail, where detail belongs: a scroll further down. */}
            {(book || items.length > 0) && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-white px-7 py-6 dark:border-gray-700 dark:bg-gray-800">
                    <div className="grid gap-7 sm:grid-cols-3">
                        {concentration.top.length > 0 && (
                            <Deeper title="Risk you did not choose" figure={concentration.pct} unit="% in your top three"
                                segments={concentration.top.map((h, i) => ({
                                    w: h.weightPct, c: ['bg-cyan-500', 'bg-cyan-500/70', 'bg-cyan-500/45'][i]
                                }))}>
                                <b className="font-semibold text-gray-900 dark:text-white">
                                    {concentration.top[0].symbol} alone is {Math.round(concentration.top[0].weightPct)}%
                                </b>
                                {book.holdingsCount > 1 && ` — against an even ${Math.round(100 / book.holdingsCount)}% across ${book.holdingsCount} names.`}
                            </Deeper>
                        )}

                        {funnel.total > 0 && (
                            <Deeper title="Whether your screening works" figure={funnel.traded}
                                unit={`of ${funnel.total} flags became positions`}
                                segments={[
                                    { w: (funnel.traded / funnel.total) * 100, c: 'bg-cyan-500' },
                                    { w: (funnel.passed / funnel.total) * 100, c: 'bg-gray-400 dark:bg-gray-500' },
                                    { w: (funnel.killed / funnel.total) * 100, c: 'bg-rose-500' }
                                ]}>
                                <b className="font-semibold text-gray-900 dark:text-white">{funnel.passed} you passed on</b>
                                {funnel.killed > 0 && `, ${funnel.killed} a level killed for you`}.
                            </Deeper>
                        )}

                        {book && book.closedCount > 0 && (
                            <Deeper title="What holding pays, what trading costs"
                                figure={signed(book.totalDividends)} unit="in dividends"
                                segments={[{
                                    w: book.realizedPnL > 0
                                        ? Math.min(100, (book.totalDividends / book.realizedPnL) * 100) : 0,
                                    c: 'bg-emerald-500'
                                }]}>
                                About <b className="font-semibold text-gray-900 dark:text-white">{money(book.totalFees / book.closedCount)}</b>
                                {' '}a round trip across {book.closedCount} closed positions
                                {book.capitalGainsTax > 0 && <>, and <b className="font-semibold text-gray-900 dark:text-white">{money(book.capitalGainsTax)}</b> of tax owed on the rest</>}.
                            </Deeper>
                        )}
                    </div>

                    {/* The honest empty state, once, rather than four dashes in a card. */}
                    {stats && !stats.closedTrades && (
                        <p className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
                            Expectancy, profit factor and average R stay blank until the journal has
                            closed trades — <b className="font-mono text-gray-500 dark:text-gray-400">0 so far</b>.
                            {book?.closedCount > 0 && ` The ledger's ${book.closedCount} closed positions are a different book.`}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

/** Sums the dashboards of every portfolio on this market. Usually there is one. */
function sumBooks(a, b) {
    const add = (k) => (a[k] || 0) + (b[k] || 0);
    return {
        currency: a.currency || b.currency,
        totalValue: add('totalValue'), cashBalance: add('cashBalance'),
        unrealizedPnL: add('unrealizedPnL'), realizedPnL: add('realizedPnL'),
        totalDividends: add('totalDividends'), totalFees: add('totalFees'),
        capitalGainsTax: add('capitalGainsTax'),
        holdingsCount: add('holdingsCount'), closedCount: add('closedCount'),
        topHoldings: [...(a.topHoldings || []), ...(b.topHoldings || [])]
            .sort((x, y) => y.weightPct - x.weightPct).slice(0, 5)
    };
}

/**
 * The top three, ranked exactly as the heatmap ranks them.
 *
 * This showed the best two and the worst one, on the theory that "what moved"
 * includes what moved down. It reads as a bug instead: the row sits under a
 * link to the heatmap, and the heatmap's daily board leads with the top three -
 * so the third name here disagreed with the screen it points at, every day.
 * A summary that ranks differently from the thing it summarises is wrong even
 * when both numbers are right.
 *
 * Same field as the board uses, too: the median of the sector, not the mean or
 * the cap-weighted figure.
 */
function topMovers(sectors) {
    return sectors
        .map((s) => ({ sector: s.sector, change: s.periods?.change?.median }))
        .filter((r) => typeof r.change === 'number')
        .sort((a, b) => b.change - a.change)
        .slice(0, 3);
}

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const today = () => new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
