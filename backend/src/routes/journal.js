/**
 * Journal Routes
 * REST API for the trading journal and its derived statistics.
 */
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import journalService from '../services/journalService.js';
import RiskProfile from '../models/RiskProfile.js';
import { contextFor, judge, suggestSize } from '../services/riskContext.js';
import { chartUpload, URL_PREFIX } from '../services/chartStorage.js';
import Portfolio from '../models/Portfolio.js';
import { SETUP_SUGGESTIONS, MISTAKE_SUGGESTIONS, EMOTIONS, MARKET_CONDITIONS } from '../models/JournalEntry.js';
import JournalEntry from '../models/JournalEntry.js';
import { EXCHANGE_CODES, EXCHANGES } from '../config/exchanges.js';

const router = express.Router();

router.use(authenticate);

const fail = (res, error) => {
    const notFound = error.message.includes('not found');
    res.status(notFound ? 404 : 400).json({ success: false, message: error.message });
};

/** Enum vocabulary, so the UI never hardcodes a list that drifts from the model. */
router.get('/options', async (req, res) => {
    // Portfolios a trade can be booked into, with just enough to populate the
    // picker and price the commission. Deliberately not /api/portfolios, which
    // computes a full dashboard per portfolio - fifteen of those to fill a
    // dropdown is a lot of work for a list of names.
    const portfolios = await Portfolio.find({
        $or: [{ owner: req.user._id }, { 'sharedWith.user': req.user._id }],
        isActive: true
    }).select('name currency commissionSlabs charges').sort({ name: 1 }).lean();

    // Your own words first, most used first, with the seed list filling in behind.
    // A fixed vocabulary put 7 of 8 trades in "other"; this one is learned.
    const used = async (field) => {
        const rows = await JournalEntry.aggregate([
            { $match: { user: req.user._id } },
            { $unwind: `$${field}` },
            { $match: { [field]: { $nin: [null, ''] } } },
            { $group: { _id: `$${field}`, n: { $sum: 1 } } },
            { $sort: { n: -1 } },
            { $limit: 40 }
        ]);
        return rows.map(r => r._id);
    };
    const merge = (mine, seed) => [...mine, ...seed.filter(x => !mine.includes(x))];
    const [setupsUsed, mistakesUsed] = await Promise.all([used('setupType'), used('mistakes')]);

    res.json({
        success: true,
        data: {
            portfolios,
            setupTypes: merge(setupsUsed, SETUP_SUGGESTIONS),
            emotions: EMOTIONS,
            marketConditions: MARKET_CONDITIONS,
            mistakes: merge(mistakesUsed, MISTAKE_SUGGESTIONS),
            exchanges: EXCHANGE_CODES,
            // Currency and fractional-share rules per market, so sizing matches the venue.
            exchangeRules: Object.values(EXCHANGES).map(x => ({
                code: x.code, currency: x.currency, fractionalShares: x.fractionalShares
            }))
        }
    });
});

/**
 * What this trade risks against the line you drew, for the modal to show while
 * you type. Capital is read from the portfolios, never stored, so it cannot go
 * stale. Informational only: it never refuses a trade.
 */
router.get('/risk-context', async (req, res) => {
    try {
        const { currency, portfolioId, entryPrice, stopPrice, quantity, targetPrice, direction } = req.query;
        const ctx = await contextFor(req.user._id, { currency, portfolioId });
        res.json({
            success: true,
            data: {
                ...ctx,
                verdict: judge({ ...ctx, entryPrice, stopPrice, quantity, targetPrice, direction }),
                suggested: suggestSize({ ...ctx, entryPrice, stopPrice })
            }
        });
    } catch (error) {
        fail(res, error);
    }
});

/** Risk tolerance, one profile per currency. Capital is not stored - see the model. */
router.get('/risk-profiles', async (req, res) => {
    try {
        const profiles = await RiskProfile.find({ user: req.user._id }).lean();
        res.json({ success: true, data: profiles });
    } catch (error) {
        fail(res, error);
    }
});

router.put('/risk-profiles/:portfolioId', async (req, res) => {
    try {
        const { defaultRiskPct, maxPositionPct } = req.body;
        const profile = await RiskProfile.findOneAndUpdate(
            { user: req.user._id, portfolioId: req.params.portfolioId },
            { defaultRiskPct, maxPositionPct },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, data: profile });
    } catch (error) {
        fail(res, error);
    }
});

/**
 * Store a chart and hand back its path. Separate from saving the entry so a
 * screenshot can be pasted into a trade that does not exist yet.
 */
router.post('/chart', (req, res) => {
    chartUpload.single('chart')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (!req.file) return res.status(400).json({ success: false, message: 'No image received' });
        res.json({ success: true, data: { chartUrl: `${URL_PREFIX}${req.file.filename}` } });
    });
});

router.get('/stats', async (req, res) => {
    try {
        res.json({ success: true, data: await journalService.stats(req.user._id, req.query) });
    } catch (error) {
        fail(res, error);
    }
});

router.get('/', async (req, res) => {
    try {
        const { entries, total } = await journalService.list(req.user._id, req.query);
        res.json({ success: true, count: entries.length, total, data: entries });
    } catch (error) {
        fail(res, error);
    }
});

router.post('/', async (req, res) => {
    try {
        const entry = await journalService.create(req.user._id, req.body);
        res.status(201).json({ success: true, data: entry });
    } catch (error) {
        fail(res, error);
    }
});

router.get('/:id', async (req, res) => {
    try {
        res.json({ success: true, data: await journalService.get(req.params.id, req.user._id) });
    } catch (error) {
        fail(res, error);
    }
});

router.put('/:id', async (req, res) => {
    try {
        res.json({ success: true, data: await journalService.update(req.params.id, req.user._id, req.body) });
    } catch (error) {
        fail(res, error);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { keptTransactions } = await journalService.remove(req.params.id, req.user._id);
        res.json({
            success: true,
            // Said out loud, because deleting the note is not deleting the trade.
            message: keptTransactions
                ? `Journal entry deleted. ${keptTransactions} ledger transaction${keptTransactions > 1 ? 's' : ''} left in the portfolio.`
                : 'Journal entry deleted'
        });
    } catch (error) {
        fail(res, error);
    }
});

export default router;
