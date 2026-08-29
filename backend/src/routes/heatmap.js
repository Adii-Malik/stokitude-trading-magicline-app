import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { sectorPerformance } from '../services/sectorPerformance.js';

const router = express.Router();

/**
 * GET /api/heatmap/sectors?period=Perf.1M
 *
 * Authenticated, because the market comes from the account and the whole point
 * is that PSX sees PSX sectors.
 */
router.get('/sectors', authenticate, async (req, res) => {
    try {
        res.json({ success: true, data: await sectorPerformance(req.query.period || 'Perf.1M') });
    } catch (error) {
        const status = error.status || 502;
        if (status >= 500) console.error('Sector performance failed:', error.message);
        res.status(status).json({ success: false, message: error.message });
    }
});

export default router;
