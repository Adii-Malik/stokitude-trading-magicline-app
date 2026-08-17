/**
 * Journal Routes
 * REST API for the trading journal and its derived statistics.
 */
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import journalService from '../services/journalService.js';
import RiskProfile from '../models/RiskProfile.js';
import { SETUP_TYPES, SETUP_QUALITIES, EMOTIONS, MARKET_CONDITIONS, MISTAKES } from '../models/JournalEntry.js';
import { EXCHANGE_CODES, EXCHANGES } from '../config/exchanges.js';

const router = express.Router();

router.use(authenticate);

const fail = (res, error) => {
    const notFound = error.message.includes('not found');
    res.status(notFound ? 404 : 400).json({ success: false, message: error.message });
};

/** Enum vocabulary, so the UI never hardcodes a list that drifts from the model. */
router.get('/options', (req, res) => {
    res.json({
        success: true,
        data: {
            setupTypes: SETUP_TYPES,
            setupQualities: SETUP_QUALITIES,
            emotions: EMOTIONS,
            marketConditions: MARKET_CONDITIONS,
            mistakes: MISTAKES,
            exchanges: EXCHANGE_CODES,
            // Currency and fractional-share rules per market, so sizing matches the venue.
            exchangeRules: Object.values(EXCHANGES).map(x => ({
                code: x.code, currency: x.currency, fractionalShares: x.fractionalShares
            }))
        }
    });
});

/** Account capital and risk tolerance, one profile per currency. */
router.get('/risk-profiles', async (req, res) => {
    try {
        const profiles = await RiskProfile.find({ user: req.user._id }).sort({ currency: 1 });
        res.json({ success: true, data: profiles });
    } catch (error) {
        fail(res, error);
    }
});

router.put('/risk-profiles/:currency', async (req, res) => {
    try {
        const { accountCapital, defaultRiskPct, maxPositionPct } = req.body;
        const profile = await RiskProfile.findOneAndUpdate(
            { user: req.user._id, currency: req.params.currency.toUpperCase() },
            { accountCapital, defaultRiskPct, maxPositionPct },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, data: profile });
    } catch (error) {
        fail(res, error);
    }
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
        await journalService.remove(req.params.id, req.user._id);
        res.json({ success: true, message: 'Journal entry deleted' });
    } catch (error) {
        fail(res, error);
    }
});

export default router;
