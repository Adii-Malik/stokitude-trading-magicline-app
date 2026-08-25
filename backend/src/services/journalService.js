/**
 * Journal Service
 * Derives every metric from the stored decision. Nothing computed here is
 * persisted, so an edited entry can never disagree with its own statistics.
 */
import JournalEntry from '../models/JournalEntry.js';
import RiskProfile from '../models/RiskProfile.js';
import { DEFAULT_EXCHANGE, currencyOf } from '../config/exchanges.js';
import { capitalFor } from './riskContext.js';

import { removeChart } from './chartStorage.js';
import { mintMissing, assertEditable, hydrate } from './journalLedger.js';
import { escapeRegex } from '../utils/escapeRegex.js';

// Never writable from a request body. The transaction ids are set by the ledger
// link alone: accepting them from a client would let one journal entry claim
// another's fills, or a transaction in someone else's portfolio.
const RESERVED = new Set(['user', '_id', 'entryTransactionId', 'exitTransactionId']);

/** Per-entry metrics. Returns nulls rather than guesses when inputs are missing. */
/**
 * How a trade ended, worked out rather than asked for.
 *
 * The app can see the exit price and the levels that were written down, so the
 * label is a reading of those two - never a claim the trader made. It is derived
 * on every read, which means editing a stop months later corrects the label
 * instead of leaving a stale answer behind.
 *
 * Null when neither a stop nor a target was recorded: with nothing to compare
 * the exit against, "closed early" would be an accusation rather than a fact.
 */
function exitReasonFor(entry) {
    if (entry.exitPrice == null) return null;

    const long = entry.direction !== 'short';
    const exit = entry.exitPrice;
    const stop = entry.plannedStop;
    const targets = entry.targets || [];

    const past = (level) => (long ? exit <= level : exit >= level);
    const reached = (level) => (long ? exit >= level : exit <= level);

    if (stop != null && past(stop)) return 'stop hit';
    if (targets.some(t => reached(t.price))) return 'target hit';
    if (stop != null || targets.length) return 'closed early';
    return null;
}

export function computeMetrics(entry) {
    const sign = entry.direction === 'short' ? -1 : 1;
    // An exit price closes the trade, whatever state says. Entries written before
    // the lifecycle existed get 'open' from the schema default on hydration, so
    // trusting state alone would reopen every historical trade.
    const closed = entry.exitPrice != null;

    // targets[] is the store; plannedTarget is its single-value virtual.
    const target = entry.targets?.length ? entry.targets[0].price : entry.plannedTarget ?? null;

    const riskPerShare = entry.plannedStop != null && entry.entryPrice != null
        ? Math.abs(entry.entryPrice - entry.plannedStop)
        : null;
    const riskAmount = riskPerShare != null && entry.quantity != null
        ? riskPerShare * entry.quantity
        : null;

    // Per-share, so the ratio holds whatever size was taken.
    const rewardPerShare = target != null && entry.entryPrice != null
        ? Math.abs(target - entry.entryPrice)
        : null;
    const plannedRR = riskPerShare > 0 && rewardPerShare != null ? rewardPerShare / riskPerShare : null;

    const exitReason = exitReasonFor(entry);

    if (!closed) {
        // Marked to the last polled price, kept out of realized totals. Read from
        // the price feed rather than typed: it was a field on the form, filled on
        // two entries out of eight, for a number the poller already knows.
        const last = entry.lastPrice;
        const marked = last != null
            ? (last - entry.entryPrice) * entry.quantity * sign
            : null;
        const cost = entry.entryPrice * entry.quantity;
        return {
            status: 'open', grossPnL: null, netPnL: null, pnlPct: null,
            rMultiple: null, outcome: null, riskAmount, plannedRR, exitReason,
            unrealizedPnL: marked,
            unrealizedPct: marked != null && cost > 0 ? (marked / cost) * 100 : null
        };
    }

    const grossPnL = (entry.exitPrice - entry.entryPrice) * entry.quantity * sign;
    // Both legs. Fees are charged on the way in and on the way out.
    const totalFees = (entry.fees || 0) + (entry.exitFees || 0);
    const netPnL = grossPnL - totalFees;
    const cost = entry.entryPrice * entry.quantity;
    const pnlPct = cost > 0 ? (netPnL / cost) * 100 : null;
    const rMultiple = riskAmount > 0 ? netPnL / riskAmount : null;

    return {
        status: 'closed',
        grossPnL,
        netPnL,
        pnlPct,
        rMultiple,
        outcome: netPnL > 0 ? 'win' : netPnL < 0 ? 'loss' : 'breakeven',
        riskAmount,
        plannedRR,
        exitReason,
        unrealizedPnL: null,
        unrealizedPct: null
    };
}

export function decorate(entry) {
    const plain = entry.toObject ? entry.toObject() : entry;
    return { ...plain, ...computeMetrics(plain) };
}

const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);

/** The currency this app is built around: PSX settlement, slabs, holding-period CGT. */
export const HOME = currencyOf(DEFAULT_EXCHANGE);

/**
 * Home market first, the rest behind it by weight.
 *
 * Ordering by weight alone opened the journal on whichever market happened to
 * have more closed trades that month - so a run of US trades quietly demoted
 * PSX, which is the book everything else in this app is built for.
 */
export function orderByHome(rows) {
    return [...rows].sort((a, b) => {
        if (a.currency === b.currency) return 0;
        if (a.currency === HOME) return -1;
        if (b.currency === HOME) return 1;
        return b.closedTrades - a.closedTrades;
    });
}

/** Stats for one currency's trades. Mixing PKR and USD into one figure is meaningless. */
export function statsFor(entries) {
    const closed = entries.filter(e => e.status === 'closed');
    const open = entries.filter(e => e.status === 'open');
    const wins = closed.filter(e => e.outcome === 'win');
    const losses = closed.filter(e => e.outcome === 'loss');

    const sum = (list, key) => list.reduce((t, e) => t + (e[key] || 0), 0);
    const grossWins = sum(wins, 'netPnL');
    const grossLosses = Math.abs(sum(losses, 'netPnL'));

    const withR = closed.filter(e => e.rMultiple != null);

    const avgWin = wins.length ? grossWins / wins.length : 0;
    const avgLoss = losses.length ? grossLosses / losses.length : 0;

    // Longest streaks, oldest trade first.
    let bestStreak = 0, worstStreak = 0, run = 0;
    const when = (e) => new Date(e.exitDate || e.entryDate).getTime();
    for (const e of [...closed].sort((a, b) => when(a) - when(b))) {
        if (e.outcome === 'win') run = run > 0 ? run + 1 : 1;
        else if (e.outcome === 'loss') run = run < 0 ? run - 1 : -1;
        else continue;
        bestStreak = Math.max(bestStreak, run);
        worstStreak = Math.min(worstStreak, run);
    }

    // What the user chose to count about themselves. The system reads no meaning
    // from these beyond the count and the total - a tracker is a label, not a
    // judgement, which is exactly what the vocabulary this replaced got wrong.
    const byTracker = [...new Set(closed.flatMap(e => e.whatHappened || []))]
        .map(name => {
            const hit = closed.filter(e => (e.whatHappened || []).includes(name));
            return { name, count: hit.length, netPnL: sum(hit, 'netPnL') };
        })
        .sort((a, b) => a.netPnL - b.netPnL);

    const group = (key) => {
        const out = {};
        for (const e of closed) {
            const k = e[key] || 'unknown';
            out[k] = out[k] || { count: 0, netPnL: 0, wins: 0 };
            out[k].count++;
            out[k].netPnL += e.netPnL || 0;
            if (e.outcome === 'win') out[k].wins++;
        }
        return Object.entries(out).map(([k, v]) => ({
            key: k, ...v, winRate: pct(v.wins, v.count)
        })).sort((a, b) => a.netPnL - b.netPnL);
    };

    // Whether a stop existed at all, which is the one thing about a stop this
    // record can actually answer. Whether it was *honoured* cannot be computed:
    // knowing that needs the price to have reached the level, and all we store
    // is where the trade got out. A winner never tests its stop, so counting one
    // as honoured made the rate true by default - the same fault as the
    // followedPlan it replaced.
    const withStop = closed.filter(e => e.plannedStop != null);

    return {
        totalTrades: entries.length,
        openTrades: open.length,
        closedTrades: closed.length,
        wins: wins.length,
        losses: losses.length,
        winRate: pct(wins.length, closed.length),
        netPnL: sum(closed, 'netPnL'),
        grossWins,
        grossLosses,
        profitFactor: grossLosses > 0 ? grossWins / grossLosses : null,
        avgWin,
        avgLoss,
        // How much bigger a winner is than a loser. Null rather than zero when
        // there is nothing to divide by: one side missing is not a ratio.
        payoffRatio: avgLoss > 0 && avgWin > 0 ? avgWin / avgLoss : null,
        expectancy: closed.length ? sum(closed, 'netPnL') / closed.length : 0,
        avgR: withR.length ? sum(withR, 'rMultiple') / withR.length : null,
        tradesWithR: withR.length,
        bestTrade: closed.length ? Math.max(...closed.map(e => e.netPnL)) : null,
        worstTrade: closed.length ? Math.min(...closed.map(e => e.netPnL)) : null,
        bestStreak,
        worstStreak: Math.abs(worstStreak),

        // What is at stake right now: entry to stop, times size, over every open
        // position. The one figure here about the present rather than the past,
        // and the only one that can stop you doing something today.
        openRisk: open.reduce((t, e) => t + (e.riskAmount || 0), 0),
        openWithoutStop: open.filter(e => e.plannedStop == null).length,

        stopSet: { n: withStop.length, of: closed.length },

        byTracker,
        byExit: group('exitReason'),
        bySetup: group('setupType')
    };
}

// A planned trade has no entry date yet, so fall back to when it was written down.
const dateOf = (e) => new Date(e.entryDate || e.createdAt || 0);

const SORTS = {
    recent: (a, b) => dateOf(b) - dateOf(a),
    oldest: (a, b) => dateOf(a) - dateOf(b),
    best: (a, b) => (b.netPnL ?? -Infinity) - (a.netPnL ?? -Infinity),
    worst: (a, b) => (a.netPnL ?? Infinity) - (b.netPnL ?? Infinity),
    symbol: (a, b) => a.symbol.localeCompare(b.symbol)
};

/**
 * How many closed trades were sized within the rule of the book they were logged
 * against, and how many could be checked at all.
 *
 * Only trades naming a portfolio that has a risk profile can be judged; the rest
 * are left out of both numbers rather than counted as passes, so the ratio never
 * flatters a book with no rule set. Capital is fetched once per portfolio.
 */
async function sizeInRule(userId, entries) {
    const closed = entries.filter(e => e.status === 'closed' && e.portfolioId && e.riskAmount != null);
    if (!closed.length) return { n: 0, of: 0 };

    const ids = [...new Set(closed.map(e => String(e.portfolioId)))];
    const profiles = await RiskProfile.find({ user: userId, portfolioId: { $in: ids } }).lean();
    const ruleOf = new Map(profiles.map(p => [String(p.portfolioId), p]));

    const capitals = new Map();
    for (const id of ids) {
        if (ruleOf.has(id)) capitals.set(id, await capitalFor(userId, id));
    }

    let n = 0, of = 0;
    for (const e of closed) {
        const id = String(e.portfolioId);
        const rule = ruleOf.get(id);
        const capital = capitals.get(id);
        if (!rule || !capital) continue;
        of++;
        if ((e.riskAmount / capital) * 100 <= rule.defaultRiskPct) n++;
    }
    return { n, of };
}

class JournalService {
    /** Every match, decorated. Stats need the full set, never a page of it. */
    async findAll(userId, filters = {}) {
        const query = { user: userId };
        if (filters.symbol) query.symbol = filters.symbol.toUpperCase();
        if (filters.exchange) query.exchange = filters.exchange.toUpperCase();
        if (filters.setupType) query.setupType = filters.setupType;
        if (filters.from || filters.to) {
            query.entryDate = {};
            if (filters.from) query.entryDate.$gte = new Date(filters.from);
            if (filters.to) query.entryDate.$lte = new Date(filters.to);
        }
        if (filters.q) {
            const rx = new RegExp(escapeRegex(filters.q.trim()), 'i');
            query.$or = [{ symbol: rx }, { notes: rx }, { lesson: rx }];
        }

        // Hydrated from the ledger before anything is derived, or the metrics
        // would be computed from the journal's own stale copy of the numbers.
        const found = await JournalEntry.find(query);
        let entries = (await hydrate(found.map(e => e.toObject()))).map(decorate);

        // status/outcome are derived, so they filter after decoration.
        if (filters.status) entries = entries.filter(e => e.status === filters.status);
        if (filters.outcome) entries = entries.filter(e => e.outcome === filters.outcome);
        if (filters.tracker) entries = entries.filter(e => (e.whatHappened || []).includes(filters.tracker));
        if (filters.exitReason) entries = entries.filter(e => e.exitReason === filters.exitReason);

        return entries.sort(SORTS[filters.sort] || SORTS.recent);
    }

    /** A page of entries plus the full match count, so the UI can say "20 of 137". */
    async list(userId, filters = {}) {
        const entries = await this.findAll(userId, filters);
        const skip = Math.max(0, parseInt(filters.skip, 10) || 0);
        const limit = Math.min(200, Math.max(1, parseInt(filters.limit, 10) || 25));
        return { total: entries.length, entries: entries.slice(skip, skip + limit) };
    }

    async get(id, userId) {
        const entry = await JournalEntry.findOne({ _id: id, user: userId });
        if (!entry) throw new Error('Journal entry not found');
        const [hydrated] = await hydrate([entry.toObject()]);
        return decorate(hydrated);
    }

    async create(userId, data) {
        const entry = new JournalEntry({ ...data, user: userId });
        // Booked before the first save, so a rejected link - a currency mismatch,
        // say - leaves no half-linked entry behind.
        await mintMissing(entry, userId);
        await entry.save();
        return this.get(entry._id, userId);
    }

    async update(id, userId, data) {
        const entry = await JournalEntry.findOne({ _id: id, user: userId });
        if (!entry) throw new Error('Journal entry not found');

        assertEditable(entry, data);

        // null clears a field. Without this, an emptied exit price is simply
        // dropped from the JSON body and a closed trade can never be reopened.
        for (const [key, value] of Object.entries(data)) {
            if (RESERVED.has(key)) continue;
            entry[key] = value === null ? undefined : value;
        }

        await mintMissing(entry, userId);
        await entry.save();
        return this.get(entry._id, userId);
    }

    async remove(id, userId) {
        const entry = await JournalEntry.findOne({ _id: id, user: userId });
        if (!entry) throw new Error('Journal entry not found');

        // The ledger rows outlive the note about them. Deleting the journal entry
        // must not silently remove real transactions from a portfolio that
        // reconciles to a broker balance.
        await JournalEntry.deleteOne({ _id: id, user: userId });

        // The chart belongs to the note, not to the ledger, so it goes with it.
        await removeChart(entry.chartUrl);

        return {
            keptTransactions: [entry.entryTransactionId, entry.exitTransactionId].filter(Boolean).length
        };
    }

    /**
     * Stats split by currency, plus the process view, which is currency-free.
     *
     * The size check lives here rather than in statsFor because it is the one
     * that needs the world outside the entry: the book's rule, and what the book
     * is worth. Capital is today's value, not the value on the day of the trade -
     * the honest approximation, and stated as such rather than quietly implied.
     */
    async stats(userId, filters = {}) {
        const entries = await this.findAll(userId, filters);

        const currencies = [...new Set(entries.map(e => e.currency || HOME))];
        const byCurrency = orderByHome(currencies.map(currency => ({
            currency,
            ...statsFor(entries.filter(e => (e.currency || HOME) === currency))
        })));

        const all = statsFor(entries);
        return {
            byCurrency,
            process: {
                totalTrades: all.totalTrades,
                openTrades: all.openTrades,
                closedTrades: all.closedTrades,
                stopSet: all.stopSet,
                sizeInRule: await sizeInRule(userId, entries),
                openWithoutStop: all.openWithoutStop,
                // Counts only. A total here would sum currencies, so money stays
                // inside byCurrency.
                byTracker: all.byTracker.map(({ name, count }) => ({ name, count })),
                byExit: all.byExit.map(({ key, count, winRate }) => ({ key, count, winRate })),
                bySetup: all.bySetup.map(({ key, count, winRate }) => ({ key, count, winRate }))
            }
        };
    }
}

export default new JournalService();
