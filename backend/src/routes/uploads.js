import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { chartUpload, URL_PREFIX } from '../services/chartStorage.js';

const router = express.Router();

/**
 * POST /api/uploads/chart
 *
 * A chart belongs to whatever you were thinking about, not only to a trade.
 * This lived under /api/journal because the journal was the only thing that
 * could hold one; a shortlist look needs the same thing and should not have to
 * post to the journal to get it.
 *
 * Separate from saving whatever the chart is attached to, so a failed upload
 * costs the image and not the note that came with it. The stored path is
 * unchanged - /uploads/journal/... - because charts already live there and
 * moving them would break every entry that points at one.
 */
router.post('/chart', authenticate, (req, res) => {
    chartUpload.single('chart')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (!req.file) return res.status(400).json({ success: false, message: 'No image received' });
        res.json({ success: true, data: { chartUrl: `${URL_PREFIX}${req.file.filename}` } });
    });
});

export default router;
