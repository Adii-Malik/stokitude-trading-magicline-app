import express from 'express';
import Watchlist from '../models/Watchlist.js';
import JournalEntry from '../models/JournalEntry.js';
import { authenticate } from '../middleware/auth.js';
import { sectorPerformance } from '../services/sectorPerformance.js';
import { currentMarket } from '../config/marketStore.js';

const router = express.Router();
router.use(authenticate);

/**
 * What the screen gets.
 *
 * `watching` is the queue. Everything else is history, and history includes the
 * ideas the watcher closed - which is not a detail, because it pushes you a
 * notification whose link is this screen, and a list that excluded them sent you
 * to a page that did not contain the thing it had just told you about.
 *
 * A closed idea gets no separate inbox and no button to acknowledge it. The
 * notification already told you; a badge you clear by hand is a chore invented
 * to make itself go away. History sorts by when each name settled, so one the
 * watcher closed on Tuesday sits at the top on Wednesday and sinks on its own.
 */
const LIVE = ['watching'];
const PAST = ['invalidated', 'dropped', 'traded'];

// History is browsed, not worked. Enough to recognise a pattern in what you
// keep passing on; not so much that the first paint waits on years of it.
const PAST_LIMIT = 50;

/**
 * Today's number for every flagged name, or an empty map.
 *
 * The board already fetches every listed company's performance over all eight
 * periods and holds it for five minutes, so drift is a subtraction rather than a
 * second data source. When the scanner is unreachable the list still renders -
 * a shortlist without today's price is worth much more than an error page,
 * because the verdicts and the reasons are the part you came back for.
 */
async function quotes() {
    try {
        const board = await sectorPerformance();
        const map = new Map();
        for (const sector of board.sectors) {
            for (const stock of sector.stocks) map.set(stock.symbol, stock);
        }
        return map;
    } catch {
        return new Map();
    }
}

/**
 * Everything you already thought about these names, from before.
 *
 * Flagging a name you once dropped makes a fresh record - deliberately, because
 * carrying the old levels forward would arm the watcher against a price you
 * named six months ago, and the horizon clock has to restart. But a fresh record
 * that also forgets you were ever here is the exact failure this whole feature
 * exists to fix: you study a stock, walk away, and study it again from nothing.
 *
 * So the thread comes back read-only. One query for the lot, keyed on symbol
 * rather than symbol-and-period - the same company noticed on two different
 * boards is still a company you have opinions about.
 */
async function priorsFor(userId, symbols) {
    const priors = new Map();
    if (!symbols.length) return priors;

    const docs = await Watchlist.find({
        user: userId,
        symbol: { $in: symbols },
        state: { $ne: 'watching' }
    }).sort({ noticedAt: 1 }).lean();

    for (const doc of docs) {
        if (!priors.has(doc.symbol)) priors.set(doc.symbol, { count: 0, looks: [], state: null, settledAt: null });
        const p = priors.get(doc.symbol);
        p.count += 1;
        p.state = doc.state;
        p.settledAt = doc.invalidatedAt || doc.updatedAt || null;
        for (const l of doc.looks || []) {
            p.looks.push({ id: l._id, at: l.at, note: l.note, chartUrl: l.chartUrl, trigger: l.trigger || null, invalidation: l.invalidation || null });
        }
    }
    return priors;
}

/**
 * When you last put eyes on it. The lean documents this route reads do not carry
 * the model's virtual, so the rule lives here too - and the two have to agree.
 */
function lastLookOf(doc) {
    const last = doc.looks?.length ? doc.looks[doc.looks.length - 1].at : doc.noticedAt;
    return doc.resumedAt && doc.resumedAt > last ? doc.resumedAt : last;
}

const shape = (doc, quote, prior) => ({
    id: doc._id,
    symbol: doc.symbol,
    name: doc.name,
    sector: doc.sector,
    period: doc.period,
    noticedAt: doc.noticedAt,
    perfWhenNoticed: doc.perfWhenNoticed,
    priceWhenNoticed: doc.priceWhenNoticed,
    state: doc.state,
    trigger: doc.trigger || null,
    invalidation: doc.invalidation || null,
    triggeredAt: doc.triggeredAt || null,
    triggeredPrice: doc.triggeredPrice ?? null,
    invalidatedAt: doc.invalidatedAt || null,
    invalidatedPrice: doc.invalidatedPrice ?? null,
    journalEntryId: doc.journalEntryId || null,
    looks: (doc.looks || []).map((l) => ({
        id: l._id,
        at: l.at,
        note: l.note,
        chartUrl: l.chartUrl,
        trigger: l.trigger || null,
        invalidation: l.invalidation || null
    })),
    lastLookAt: lastLookOf(doc),
    tag: doc.tag,
    // When this one stopped being live. Only history reads it, and only to say
    // how long ago you settled the question.
    settledAt: doc.state === 'watching' ? null : (doc.invalidatedAt || doc.updatedAt || null),
    // Null rather than absent when the scanner is down, so the screen can say
    // "no quote" instead of drawing a drift of zero.
    perfNow: quote ? quote.perf?.[doc.period] ?? null : null,
    priceNow: quote ? quote.close ?? null : null,
    prior: prior || null
});

// GET /api/watchlist - the live list, plus recent history to look back over
router.get('/', async (req, res) => {
    try {
        const [live, past, quote] = await Promise.all([
            Watchlist.find({ user: req.user._id, state: { $in: LIVE } })
                .sort({ noticedAt: -1 })
                .lean(),
            Watchlist.find({ user: req.user._id, state: { $in: PAST } })
                .sort({ invalidatedAt: -1, updatedAt: -1 })
                .limit(PAST_LIMIT)
                .lean(),
            quotes()
        ]);

        const priors = await priorsFor(req.user._id, live.map(d => d.symbol));

        res.json({
            success: true,
            data: [
                ...live.map(d => shape(d, quote.get(d.symbol), priors.get(d.symbol))),
                ...past.map(d => shape(d, quote.get(d.symbol)))
            ]
        });
    } catch (error) {
        console.error('Error listing watchlist:', error);
        res.status(500).json({ success: false, message: 'Failed to load the shortlist' });
    }
});

/**
 * POST /api/watchlist - flag a name.
 *
 * Idempotent by the same key the index enforces, because the caller is a toggle
 * button and a double click is a double click, not two observations.
 */
router.post('/', async (req, res) => {
    try {
        const { symbol, name, sector, period, perf, price, tag } = req.body || {};
        if (!symbol || !sector || !period) {
            return res.status(400).json({
                success: false,
                message: 'symbol, sector and period are required'
            });
        }

        const key = {
            user: req.user._id,
            market: currentMarket(),
            symbol: String(symbol).toUpperCase().trim(),
            period,
            state: 'watching'
        };

        const existing = await Watchlist.findOne(key).lean();
        if (existing) {
            const quote = (await quotes()).get(existing.symbol);
            return res.json({ success: true, data: shape(existing, quote) });
        }

        const doc = await Watchlist.create({
            user: req.user._id,
            market: currentMarket(),
            symbol,
            name,
            sector,
            period,
            perfWhenNoticed: perf ?? null,
            priceWhenNoticed: price ?? null,
            tag: tag || undefined
        });

        const quote = (await quotes()).get(doc.symbol);
        res.status(201).json({ success: true, data: shape(doc.toObject(), quote) });
    } catch (error) {
        // The partial unique index is the last word if two clicks race past the
        // findOne above.
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Already on the shortlist' });
        }
        console.error('Error flagging symbol:', error);
        res.status(500).json({ success: false, message: 'Failed to flag this name' });
    }
});

/**
 * POST /api/watchlist/:id/looks - you went and looked at the chart.
 *
 * Everything is optional, including all of it. Saving a look with no note and
 * no chart still records the date and that you looked, which resets the clock
 * and is more than the screen knew before. Requiring anything here would put a
 * decision in front of the one action this whole feature depends on you taking.
 */
router.post('/:id/looks', async (req, res) => {
    try {
        const { note, chartUrl, trigger, invalidation } = req.body || {};

        // A level is only a level with both halves. Half of one is a typo, and
        // storing it would arm a watcher against a price with no direction.
        const level = (l) => (l && l.price != null && ['above', 'below'].includes(l.dir)
            ? { price: Number(l.price), dir: l.dir }
            : null);

        const t = level(trigger);
        const v = level(invalidation);

        /**
         * The look keeps the levels as they stood; the entry carries the live
         * ones. Passing null clears what was armed - which is how you say "never
         * mind" about a price you set last week without dropping the name.
         */
        const doc = await Watchlist.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            {
                $push: {
                    looks: {
                        at: new Date(),
                        note: note || undefined,
                        chartUrl: chartUrl || undefined,
                        trigger: t,
                        invalidation: v
                    }
                },
                $set: {
                    state: 'watching',
                    ...(trigger !== undefined ? { trigger: t, triggeredAt: null } : {}),
                    ...(invalidation !== undefined ? { invalidation: v } : {})
                }
            },
            { new: true, runValidators: true }
        ).lean();

        if (!doc) return res.status(404).json({ success: false, message: 'Not on your shortlist' });

        res.status(201).json({ success: true, data: shape(doc, (await quotes()).get(doc.symbol)) });
    } catch (error) {
        console.error('Error recording a look:', error);
        res.status(500).json({ success: false, message: 'Failed to record that look' });
    }
});

/**
 * PATCH /api/watchlist/:id - let an idea go, put one back, or tag it.
 *
 * Dropping keeps the row and its looks. It is the record of an idea you watched
 * and passed on, which is worth more than a deletion - and it frees the unique
 * key so the same name can be flagged again later without inheriting the old
 * thread.
 *
 * Putting one back is the other direction, and it has to disarm the level that
 * closed it. Reviving a name with its invalidation still armed hands it straight
 * back to the watcher, which finds price on the wrong side of the same number
 * that night and kills it again - so the button would appear to do nothing, once
 * a day, forever. Disagreeing with the verdict means the old level was the part
 * that was wrong; you set a new one on the next look.
 */
router.patch('/:id', async (req, res) => {
    try {
        const { state, tag } = req.body || {};
        const update = {};

        if (state === 'dropped') update.state = 'dropped';
        else if (state === 'watching') {
            update.state = 'watching';
            update.invalidation = null;
            update.invalidatedAt = null;
            update.invalidatedPrice = null;
            // Deciding it is worth watching again is itself a look at it.
            // Without this the name returns already overdue by however long it
            // sat in history - the screen scolding you for the pause it offered.
            update.resumedAt = new Date();
        } else if (state !== undefined) {
            return res.status(400).json({ success: false, message: 'state must be watching or dropped' });
        }
        if (tag !== undefined) update.tag = tag;

        const doc = await Watchlist.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            update,
            { new: true, runValidators: true }
        ).lean();

        if (!doc) return res.status(404).json({ success: false, message: 'Not on your shortlist' });

        res.json({ success: true, data: shape(doc, (await quotes()).get(doc.symbol)) });
    } catch (error) {
        // Reviving collides when the same name was flagged again on the same
        // board after this one died. The live flag is the current thinking, so
        // say so rather than resurrecting a stale thread on top of it.
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'That name is already back on the shortlist'
            });
        }
        console.error('Error updating watchlist entry:', error);
        res.status(500).json({ success: false, message: 'Failed to update this name' });
    }
});

/**
 * POST /api/watchlist/:id/trade - this one is ready.
 *
 * Creates the journal entry and links the two, so the thread that led to a
 * trade stays attached to it and the name stops asking for looks. The journal
 * owns the numbers from here: this hands over a symbol, a date and whatever the
 * last look said as the setup, and nothing else. Inventing a fill price the
 * broker never gave is exactly what the journal's own comments warn against.
 */
router.post('/:id/trade', async (req, res) => {
    try {
        const { entryPrice, quantity, entryDate, plannedStop } = req.body || {};
        if (entryPrice == null || quantity == null) {
            return res.status(400).json({
                success: false,
                message: 'A trade needs the price you paid and how many'
            });
        }

        const doc = await Watchlist.findOne({ _id: req.params.id, user: req.user._id });
        if (!doc) return res.status(404).json({ success: false, message: 'Not on your shortlist' });

        const last = doc.looks?.[doc.looks.length - 1];
        const entry = await JournalEntry.create({
            user: req.user._id,
            symbol: doc.symbol,
            exchange: currentMarket() === 'US' ? 'NASDAQ' : 'PSX',
            direction: 'long',
            state: 'open',
            entryDate: entryDate ? new Date(entryDate) : new Date(),
            entryPrice: Number(entryPrice),
            quantity: Number(quantity),
            plannedStop: plannedStop != null ? Number(plannedStop) : (doc.invalidation?.price ?? undefined),
            setupType: doc.sector?.slice(0, 40),
            notes: last?.note || undefined
        });

        doc.state = 'traded';
        doc.journalEntryId = entry._id;
        doc.trigger = null;
        await doc.save();

        res.status(201).json({
            success: true,
            data: { watchlist: shape(doc.toObject(), (await quotes()).get(doc.symbol)), journalEntryId: entry._id }
        });
    } catch (error) {
        console.error('Error promoting to a trade:', error);
        res.status(400).json({ success: false, message: error.message || 'Could not log that trade' });
    }
});

/**
 * DELETE /api/watchlist/:id - unflag.
 *
 * A real delete, unlike dropping: this is the undo for a mis-click, and a
 * mis-click is not a decision worth keeping.
 */
router.delete('/:id', async (req, res) => {
    try {
        const doc = await Watchlist.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!doc) return res.status(404).json({ success: false, message: 'Not on your shortlist' });
        res.json({ success: true, data: { id: doc._id } });
    } catch (error) {
        console.error('Error removing watchlist entry:', error);
        res.status(500).json({ success: false, message: 'Failed to remove this name' });
    }
});

export default router;
