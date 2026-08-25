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
import { SETUP_SUGGESTIONS } from '../models/JournalEntry.js';
import JournalSettings from '../models/JournalSettings.js';
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
    const [setupsUsed, settings] = await Promise.all([
        used('setupType'),
        JournalSettings.forUser(req.user._id)
    ]);

    // The book to open a new trade on. The setting wins when one is chosen and
    // the book is still open to trade; otherwise fall back to whichever book was
    // used last, so a new user never has to configure anything to get a sensible
    // pick. "Ask me each time" suppresses both.
    const open = new Set(portfolios.map(p => String(p._id)));
    const chosen = settings.defaultPortfolioId && String(settings.defaultPortfolioId);
    const recent = await JournalEntry.find({ user: req.user._id, portfolioId: { $ne: null } })
        .select('portfolioId').sort({ createdAt: -1 }).limit(20).lean();
    const lastBook = settings.askForBook ? null
        : (chosen && open.has(chosen) ? chosen : null)
        || recent.map(e => String(e.portfolioId)).find(id => open.has(id))
        // Nothing journalled yet, and only one book to trade: no choice to make.
        || (portfolios.length === 1 ? String(portfolios[0]._id) : null);

    res.json({
        success: true,
        data: {
            portfolios,
            lastBook,
            setupTypes: merge(setupsUsed, SETUP_SUGGESTIONS),
            // Only what this user chose to count about themselves. An empty list
            // is a valid answer, and the close form then asks for nothing.
            trackers: settings.trackers,
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
/** The handful of journal-wide answers, created on first read. */
router.get('/settings', async (req, res) => {
    try {
        res.json({ success: true, data: await JournalSettings.forUser(req.user._id) });
    } catch (error) { fail(res, error); }
});

/**
 * Saves the journal-wide settings. Trackers are trimmed, de-duplicated and
 * capped: a list you can no longer read is one you stop keeping short, and the
 * whole value of naming them yourself is that there are few of them.
 */
router.put('/settings', async (req, res) => {
    try {
        const { defaultPortfolioId, askForBook, trackers } = req.body;
        const settings = await JournalSettings.forUser(req.user._id);

        if (defaultPortfolioId !== undefined) settings.defaultPortfolioId = defaultPortfolioId || undefined;
        if (askForBook !== undefined) settings.askForBook = Boolean(askForBook);
        if (Array.isArray(trackers)) {
            const seen = new Set();
            settings.trackers = trackers
                .map(t => String(t || '').trim())
                .filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
                .slice(0, 20);
        }

        await settings.save();
        res.json({ success: true, data: settings });
    } catch (error) { fail(res, error); }
});

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
