/**
 * Journal Service
 * Derives every metric from the stored decision. Nothing computed here is
 * persisted, so an edited entry can never disagree with its own statistics.
 */
import JournalEntry, { ranToPlan } from '../models/JournalEntry.js';

const round = (n) => Math.round(n * 100) / 100;
import { removeChart } from './chartStorage.js';
import { mintMissing, assertEditable, hydrate } from './journalLedger.js';
import { escapeRegex } from '../utils/escapeRegex.js';

// Never writable from a request body. The transaction ids are set by the ledger
// link alone: accepting them from a client would let one journal entry claim
// another's fills, or a transaction in someone else's portfolio.
const RESERVED = new Set(['user', '_id', 'entryTransactionId', 'exitTransactionId']);

/** Per-entry metrics. Returns nulls rather than guesses when inputs are missing. */
export function computeMetrics(entry) {
    const sign = entry.direction === 'short' ? -1 : 1;
    // An exit price closes the trade, whatever state says. Entries written before
    // the lifecycle existed get 'open' from the schema default on hydration, so
    // trusting state alone would reopen every historical trade.
    const state = entry.exitPrice != null ? 'closed'
        : entry.state === 'planned' || entry.state === 'cancelled' ? entry.state
            : 'open';
    const closed = state === 'closed';

    // targets[] is the store; plannedTarget is its single-value virtual.
    const target = entry.targets?.length ? entry.targets[0].price : entry.plannedTarget ?? null;

    // A trade never entered has no fill, so risk is measured against the zone it
    // was waiting for. Midpoint, because that is the honest expectation of a band.
    // Cancelled included: the R:R it was planned at says what you passed up.
    const zone = entry.entryFrom != null && entry.entryTo != null
        ? (entry.entryFrom + entry.entryTo) / 2
        : entry.entryFrom ?? entry.entryTo ?? null;
    const reference = state === 'planned' || state === 'cancelled' ? zone : entry.entryPrice;

    const riskPerShare = entry.plannedStop != null && reference != null
        ? Math.abs(reference - entry.plannedStop)
        : null;
    const riskAmount = riskPerShare != null && entry.quantity != null
        ? riskPerShare * entry.quantity
        : null;

    // Per-share, so a planned trade with no size still has a meaningful ratio.
    const rewardPerShare = target != null && reference != null
        ? Math.abs(target - reference)
        : null;
    const plannedRR = riskPerShare > 0 && rewardPerShare != null ? rewardPerShare / riskPerShare : null;

    // Process is judged on what was controllable, independent of the result.
    // Premature on a trade that has not been entered yet.
    const untaken = state === 'planned' || state === 'cancelled';
    // Nothing named as having gone wrong. Derived rather than asked: a checkbox
    // saying "I followed my plan" was answered on none of the entries, while the
    // reasons themselves were filled in - people will name a specific failure
    // long before they will grade themselves.
    // The plan held when nothing was recorded against it, or when everything
    // recorded describes a way out rather than a slip.
    const followedPlan = untaken
        ? null
        : (entry.whatHappened || []).every(ranToPlan);

    if (untaken) {
        return {
            status: state, grossPnL: null, netPnL: null, pnlPct: null,
            rMultiple: null, outcome: null, riskAmount, plannedRR, followedPlan,
            unrealizedPnL: null, unrealizedPct: null
        };
    }

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
            rMultiple: null, outcome: null, riskAmount, plannedRR, followedPlan,
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
        followedPlan,
        unrealizedPnL: null,
        unrealizedPct: null
    };
}

export function decorate(entry) {
    const plain = entry.toObject ? entry.toObject() : entry;
    return { ...plain, ...computeMetrics(plain) };
}

const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);

/** Stats for one currency's trades. Mixing PKR and USD into one figure is meaningless. */
export function statsFor(entries) {
    // A watched or cancelled level is not a trade taken. Counting either would
    // dilute every rate below with decisions that were never made.
    const untaken = (e) => e.status === 'planned' || e.status === 'cancelled';
    const taken = entries.filter(e => !untaken(e));
    const closed = taken.filter(e => e.status === 'closed');
    const wins = closed.filter(e => e.outcome === 'win');
    const losses = closed.filter(e => e.outcome === 'loss');

    const sum = (list, key) => list.reduce((t, e) => t + (e[key] || 0), 0);
    const grossWins = sum(wins, 'netPnL');
    const grossLosses = Math.abs(sum(losses, 'netPnL'));

    const withR = closed.filter(e => e.rMultiple != null);
    const confirmed = closed.filter(e => e.exitConfirmed);

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

    // Built from what was actually written, not from a list of reasons someone
    // thought of in advance. Ordered by what each one cost: frequency alone would
    // rank a habit you do often and survive above the one that empties the account.
    const byMistake = [...new Set(closed.flatMap(e => e.whatHappened || []))]
        .filter(tag => !ranToPlan(tag))
        .map(code => {
            const hit = closed.filter(e => (e.whatHappened || []).includes(code));
            return { code, count: hit.length, cost: sum(hit, 'netPnL') };
        })
        .sort((a, b) => a.cost - b.cost);

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

    // Follow-through on levels written down in advance. A planned trade keeps its
    // zone after it opens, so a recorded zone is what marks an entry as one that
    // started as a plan rather than an impulse. This is the number that keeping
    // cancelled levels buys: how selective you actually are, versus how selective
    // it feels.
    const fromPlan = entries.filter(e => e.entryFrom != null || e.entryTo != null);
    const levelsTaken = fromPlan.filter(e => e.status === 'open' || e.status === 'closed').length;
    const levelsAbandoned = fromPlan.filter(e => e.status === 'cancelled').length;
    const settled = levelsTaken + levelsAbandoned;

    // The single most expensive habit, and what the account looks like without it.
    const worst = byMistake[0];
    const headline = worst ? {
        mistake: worst.code,
        count: worst.count,
        cost: worst.cost,
        netWithout: closed
            .filter(e => !(e.whatHappened || []).includes(worst.code))
            .reduce((t, e) => t + (e.netPnL || 0), 0)
    } : null;

    return {
        totalTrades: taken.length,
        openTrades: taken.length - closed.length,
        plannedTrades: entries.filter(e => e.status === 'planned').length,
        // How often a level never triggered. Only a kept record can answer that.
        cancelledTrades: entries.filter(e => e.status === 'cancelled').length,
        levelsTaken,
        levelsAbandoned,
        // Null rather than 0 when nothing has settled, so the UI can stay quiet
        // instead of claiming a 0% follow-through on no evidence.
        triggerRate: settled ? pct(levelsTaken, settled) : null,
        headline,
        closedTrades: closed.length,
        wins: wins.length,
        losses: losses.length,
        winRate: pct(wins.length, closed.length),
        netPnL: sum(closed, 'netPnL'),
        grossWins,
        grossLosses,
        profitFactor: grossLosses > 0 ? grossWins / grossLosses : null,
        avgWin: wins.length ? grossWins / wins.length : 0,
        avgLoss: losses.length ? grossLosses / losses.length : 0,
        expectancy: closed.length ? sum(closed, 'netPnL') / closed.length : 0,
        avgR: withR.length ? sum(withR, 'rMultiple') / withR.length : null,
        tradesWithR: withR.length,
        bestTrade: closed.length ? Math.max(...closed.map(e => e.netPnL)) : null,
        worstTrade: closed.length ? Math.min(...closed.map(e => e.netPnL)) : null,
        bestStreak,
        worstStreak: Math.abs(worstStreak),

        // Process, tracked apart from outcome.
        followedPlanRate: pct(taken.filter(e => e.followedPlan).length, taken.length),


        // A loss that obeyed the plan is not a mistake; a win that broke it is luck.
        goodProcessBadOutcome: closed.filter(e => e.followedPlan && e.outcome === 'loss').length,
        badProcessGoodOutcome: closed.filter(e => !e.followedPlan && e.outcome === 'win').length,

        // Data quality: unconfirmed exits are recollection, not fills.
        unconfirmedExits: closed.length - confirmed.length,

        byMistake,
        bySetup: group('setupType'),
        // Grades recorded before the outcome, so this reads as a calibration check.
        byQuality: group('setupQuality'),
        byEmotion: group('emotionalState')
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
            query.$or = [{ symbol: rx }, { notes: rx }, { lesson: rx }, { tags: rx }];
        }

        // Hydrated from the ledger before anything is derived, or the metrics
        // would be computed from the journal's own stale copy of the numbers.
        const found = await JournalEntry.find(query);
        let entries = (await hydrate(found.map(e => e.toObject()))).map(decorate);

        // status/outcome are derived, so they filter after decoration.
        if (filters.status) entries = entries.filter(e => e.status === filters.status);
        if (filters.outcome) entries = entries.filter(e => e.outcome === filters.outcome);
        if (filters.mistake) entries = entries.filter(e => (e.whatHappened || []).includes(filters.mistake));
        if (filters.followedPlan != null) {
            const want = String(filters.followedPlan) === 'true';
            entries = entries.filter(e => Boolean(e.followedPlan) === want);
        }

        return entries.sort(SORTS[filters.sort] || SORTS.recent);
    }

    /** A page of entries plus the full match count, so the UI can say "20 of 137". */
    async list(userId, filters = {}) {
        const entries = await this.findAll(userId, filters);
        const skip = Math.max(0, parseInt(filters.skip, 10) || 0);
        const limit = Math.min(200, Math.max(1, parseInt(filters.limit, 10) || 25));
        return { total: entries.length, entries: entries.slice(skip, skip + limit) };
    }

    /**
     * What these words have done across every closed trade carrying them, so the
     * cost of a habit can be said at the moment it is being repeated rather than
     * found later in a report. Excludes the entry being written, which has no
     * result yet and would otherwise count itself.
     */
    async tagHistory(userId, tags, exceptId) {
        const wanted = (Array.isArray(tags) ? tags : [tags]).filter(Boolean);
        if (!wanted.length) return [];

        const query = { user: userId, whatHappened: { $in: wanted }, exitPrice: { $ne: null } };
        if (exceptId) query._id = { $ne: exceptId };

        const found = await JournalEntry.find(query).lean();
        const decorated = (await hydrate(found)).map(decorate).filter(e => e.status === 'closed');

        return wanted.map((tag) => {
            const hit = decorated.filter(e => (e.whatHappened || []).includes(tag));
            const withR = hit.filter(e => e.rMultiple != null);
            return {
                tag,
                ranToPlan: ranToPlan(tag),
                trades: hit.length,
                netPnL: round(hit.reduce((sum, e) => sum + (e.netPnL || 0), 0)),
                avgR: withR.length
                    ? Math.round((withR.reduce((sum, e) => sum + e.rMultiple, 0) / withR.length) * 100) / 100
                    : null,
                green: hit.filter(e => e.outcome === 'win').length
            };
        }).filter(x => x.trades > 0);
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

    /** Stats split by currency, plus an overall process view that is currency-free. */
    async stats(userId, filters = {}) {
        const entries = await this.findAll(userId, filters);

        const currencies = [...new Set(entries.map(e => e.currency || 'PKR'))];
        const byCurrency = currencies.map(currency => ({
            currency,
            ...statsFor(entries.filter(e => (e.currency || 'PKR') === currency))
        })).sort((a, b) => b.closedTrades - a.closedTrades);

        const all = statsFor(entries);
        return {
            byCurrency,
            process: {
                totalTrades: all.totalTrades,
                closedTrades: all.closedTrades,
                plannedTrades: all.plannedTrades,
                cancelledTrades: all.cancelledTrades,
                levelsTaken: all.levelsTaken,
                levelsAbandoned: all.levelsAbandoned,
                triggerRate: all.triggerRate,
                followedPlanRate: all.followedPlanRate,
                goodProcessBadOutcome: all.goodProcessBadOutcome,
                badProcessGoodOutcome: all.badProcessGoodOutcome,
                unconfirmedExits: all.unconfirmedExits,
                // Counts only. A cost here would sum currencies, so it lives in byCurrency.
                byMistake: all.byMistake.map(({ code, count }) => ({ code, count })),
                bySetup: all.bySetup.map(({ key, count, winRate }) => ({ key, count, winRate })),
                byQuality: all.byQuality.map(({ key, count, winRate }) => ({ key, count, winRate })),
                byEmotion: all.byEmotion.map(({ key, count, winRate }) => ({ key, count, winRate }))
            }
        };
    }
}

export default new JournalService();
