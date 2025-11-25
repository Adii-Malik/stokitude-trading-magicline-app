import express from 'express';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { getFeatureFlagsSummary, featureFlags } from '../config/featureFlags.js';

const router = express.Router();

// GET /api/system/feature-flags - Get current feature flags (admin only)
router.get('/feature-flags', authenticate, adminOnly, async (req, res) => {
    try {
        const summary = getFeatureFlagsSummary();

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feature flags',
            error: error.message
        });
    }
});

// GET /api/system/health - Basic health check
router.get('/health', async (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        devMode: featureFlags.devMode
    });
});

export default router;
