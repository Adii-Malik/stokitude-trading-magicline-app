import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { sectorPerformance } from '../services/sectorPerformance.js';

const router = express.Router();

/**
 * GET /api/heatmap/sectors
 *
 * Every sector over every period in one payload - the scanner returns all of
 * them in a single call, so splitting it per period would only mean the screen
 * refetching to show a column it could already have.
 *
 * Authenticated, because the market comes from the account and the whole point
 * is that PSX sees PSX sectors.
 */
router.get('/sectors', authenticate, async (req, res) => {
    try {
        res.json({ success: true, data: await sectorPerformance() });
    } catch (error) {
        const status = error.status || 502;
        if (status >= 500) console.error('Sector performance failed:', error.message);
        res.status(status).json({ success: false, message: error.message });
    }
});

export default router;
