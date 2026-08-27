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

    const settings = await JournalSettings.forUser(req.user._id);

    // The book to open a new trade on, per currency. The setting wins when one
    // is chosen and the book is still open to trade; otherwise fall back to
    // whichever book of that currency was used last, so nothing has to be
    // configured to get a sensible pick. "Ask me each time" suppresses both.
    const liveBooks = new Map(portfolios.map(p => [String(p._id), (p.currency || 'PKR').toUpperCase()]));
    const recent = await JournalEntry.find({ user: req.user._id, portfolioId: { $ne: null } })
        .select('portfolioId').sort({ createdAt: -1 }).limit(40).lean();

    const defaultBooks = {};
    if (!settings.askForBook) {
        for (const currency of new Set(liveBooks.values())) {
            const inCurrency = (id) => liveBooks.get(id) === currency;
            const chosen = settings.defaultBooks?.get(currency);
            const ofCurrency = [...liveBooks.keys()].filter(inCurrency);
            defaultBooks[currency] =
                (chosen && inCurrency(String(chosen)) ? String(chosen) : null)
                || recent.map(e => String(e.portfolioId)).find(inCurrency)
                // Only one book in this currency: no choice to make.
                || (ofCurrency.length === 1 ? ofCurrency[0] : null);
        }
    }

    res.json({
        success: true,
        data: {
            portfolios,
            defaultBooks,
            // Both lists are the user's own, named in settings and tapped after,
            // so nothing is typed at the moment of use and nothing can drift.
            setups: settings.setups,
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
 * Saves the journal-wide settings.
 */
router.put('/settings', async (req, res) => {
    try {
        const { defaultBooks, askForBook, setups, trackers } = req.body;
        const settings = await JournalSettings.forUser(req.user._id);

        // Replaced wholesale rather than merged: a currency whose book was
        // cleared has to be able to go back to having none.
        if (defaultBooks && typeof defaultBooks === 'object') {
            settings.defaultBooks = new Map(
                Object.entries(defaultBooks).filter(([, id]) => id)
            );
        }
        if (askForBook !== undefined) settings.askForBook = Boolean(askForBook);
        // Trimmed, de-duplicated case-insensitively and capped: a list you can no
        // longer read is one you stop keeping short, and the whole value of
        // naming them yourself is that there are few of them.
        const tidy = (list) => {
            const seen = new Set();
            return list
                .map(t => String(t || '').trim())
                .filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
                .slice(0, 20);
        };
        if (Array.isArray(setups)) settings.setups = tidy(setups);
        if (Array.isArray(trackers)) settings.trackers = tidy(trackers);

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
        res.json({ success: true, data: await journalService.stats(req.user._id, req.query, req.market) });
    } catch (error) {
        fail(res, error);
    }
});

router.get('/', async (req, res) => {
    try {
        const { entries, total } = await journalService.list(req.user._id, req.query, req.market);
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
