import express from 'express';
import serviceMonitor from '../services/serviceMonitor.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/service-monitor/status
 * @desc Get comprehensive system status
 * @access Admin
 */
router.get('/status', authenticate, requireAdmin, async (req, res) => {
    try {
        const status = await serviceMonitor.getSystemStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting system status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get system status',
            error: error.message
        });
    }
});

/**
 * @route GET /api/service-monitor/health
 * @desc Get health summary
 * @access Admin
 */
router.get('/health', authenticate, requireAdmin, async (req, res) => {
    try {
        const health = await serviceMonitor.getHealthSummary();
        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        console.error('Error getting health summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get health summary',
            error: error.message
        });
    }
});

/**
 * @route GET /api/service-monitor/logs
 * @desc Get service logs with filters
 * @access Admin
 */
router.get('/logs', authenticate, requireAdmin, async (req, res) => {
    try {
        const { serviceName, status, limit, startDate, endDate } = req.query;

        const options = {
            serviceName,
            status,
            limit: limit ? parseInt(limit) : 100,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined
        };

        const logs = await serviceMonitor.getLogs(options);

        res.json({
            success: true,
            data: logs,
            count: logs.length
        });
    } catch (error) {
        console.error('Error getting service logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get service logs',
            error: error.message
        });
    }
});

/**
 * @route GET /api/service-monitor/statistics/:serviceName
 * @desc Get statistics for a specific service
 * @access Admin
 */
router.get('/statistics/:serviceName', authenticate, requireAdmin, async (req, res) => {
    try {
        const { serviceName } = req.params;
        const { hours } = req.query;

        const stats = await serviceMonitor.getStatistics(
            serviceName,
            hours ? parseInt(hours) : 24
        );

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting service statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get service statistics',
            error: error.message
        });
    }
});

/**
 * @route GET /api/service-monitor/diagnose
 * @desc Diagnose system issues
 * @access Admin
 */
router.get('/diagnose', authenticate, requireAdmin, async (req, res) => {
    try {
        const diagnosis = await serviceMonitor.diagnose();

        res.json({
            success: true,
            data: diagnosis
        });
    } catch (error) {
        console.error('Error diagnosing system:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to diagnose system',
            error: error.message
        });
    }
});

export default router;

