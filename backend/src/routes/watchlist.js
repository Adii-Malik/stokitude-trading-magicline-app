import express from 'express';
import Watchlist from '../models/Watchlist.js';
import { authenticate } from '../middleware/auth.js';
import { sectorPerformance } from '../services/sectorPerformance.js';
import { currentMarket } from '../config/marketStore.js';

const router = express.Router();
router.use(authenticate);

const LIVE = ['noticed', 'analysed'];

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
    verdict: doc.verdict,
    analysedAt: doc.analysedAt,
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
            state: { $in: LIVE }
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
 * PATCH /api/watchlist/:id - record what the analysis concluded, or let it go.
 *
 * Dropping keeps the row. It is the record of an idea you looked at and passed
 * on, which is worth more than a deletion - and it frees the unique key so the
 * same name can be noticed again later without carrying the old verdict.
 */
router.patch('/:id', async (req, res) => {
    try {
        const { state, verdict, tag } = req.body || {};
        const update = {};

        if (state === 'analysed') {
            update.state = 'analysed';
            update.analysedAt = new Date();
            if (verdict !== undefined) update.verdict = verdict;
        } else if (state === 'dropped') {
            update.state = 'dropped';
        } else if (state !== undefined) {
            return res.status(400).json({ success: false, message: 'state must be analysed or dropped' });
        } else {
            if (verdict !== undefined) update.verdict = verdict;
            if (tag !== undefined) update.tag = tag;
        }

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
