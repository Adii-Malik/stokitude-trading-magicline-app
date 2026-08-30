import express from 'express';
import Watchlist from '../models/Watchlist.js';
import JournalEntry from '../models/JournalEntry.js';
import { authenticate } from '../middleware/auth.js';
import { sectorPerformance } from '../services/sectorPerformance.js';
import { currentMarket } from '../config/marketStore.js';

const router = express.Router();
router.use(authenticate);

const LIVE = ['watching'];

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

const shape = (doc, quote) => ({
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
    invalidatedAt: doc.invalidatedAt || null,
    journalEntryId: doc.journalEntryId || null,
    looks: (doc.looks || []).map((l) => ({
        id: l._id,
        at: l.at,
        note: l.note,
        chartUrl: l.chartUrl,
        trigger: l.trigger || null,
        invalidation: l.invalidation || null
    })),
    lastLookAt: doc.looks?.length ? doc.looks[doc.looks.length - 1].at : doc.noticedAt,
    tag: doc.tag,
    // Null rather than absent when the scanner is down, so the screen can say
    // "no quote" instead of drawing a drift of zero.
    perfNow: quote ? quote.perf?.[doc.period] ?? null : null,
    priceNow: quote ? quote.close ?? null : null
});

// GET /api/watchlist - everything still live, newest flag first
router.get('/', async (req, res) => {
    try {
        const [docs, quote] = await Promise.all([
            Watchlist.find({ user: req.user._id, state: { $in: LIVE } })
                .sort({ noticedAt: -1 })
                .lean(),
            quotes()
        ]);

        res.json({ success: true, data: docs.map(d => shape(d, quote.get(d.symbol))) });
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
 * PATCH /api/watchlist/:id - let an idea go, or tag it.
 *
 * Dropping keeps the row and its looks. It is the record of an idea you watched
 * and passed on, which is worth more than a deletion - and it frees the unique
 * key so the same name can be flagged again later without inheriting the old
 * thread.
 */
router.patch('/:id', async (req, res) => {
    try {
        const { state, tag } = req.body || {};
        const update = {};

        if (state === 'dropped') update.state = 'dropped';
        else if (state === 'watching') update.state = 'watching';
        else if (state !== undefined) {
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
