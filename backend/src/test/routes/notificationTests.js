/**
 * TEST ROUTES - Development Only
 * All test/debug notification endpoints
 * These are automatically disabled in production (NODE_ENV=production)
 */

import express from 'express';
import { authenticate, adminOnly } from '../../middleware/auth.js';
import { requireFeature } from '../../config/featureFlags.js';

const router = express.Router();

// All test endpoints protected by requireFeature middleware
// This checks NODE_ENV and returns 403 in production

// POST /api/notifications/test - Basic test notification
router.post('/test', authenticate, requireFeature('test'), async (req, res) => {
    try {
        const Notification = (await import('../../models/Notification.js')).default;

        const notification = await Notification.create({
            userId: req.user._id,
            category: 'system',
            event: 'system_alert',
            type: 'system_alert',
            title: 'Test Notification',
            message: 'This is a test notification to verify the system is working correctly.',
            priority: 'medium',
            channels: {
                inApp: { sent: true, sentAt: new Date() },
                email: { sent: false },
                push: { sent: false }
            }
        });

        res.json({
            success: true,
            message: 'Test notification sent',
            data: notification
        });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test notification',
            error: error.message
        });
    }
});

// POST /api/notifications/test-magic-line - Test magic line notification
router.post('/test-magic-line', authenticate, requireFeature('test'), async (req, res) => {
    try {
        const notificationService = (await import('../../services/notificationService.js')).default;

        await notificationService.notifyStrategicLevelMet(
            'OGDC',
            85.00,
            85.50,
            req.user._id
        );

        res.json({
            success: true,
            message: 'Magic line test notification sent! Check your notifications.'
        });
    } catch (error) {
        console.error('Error sending test magic line notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test notification',
            error: error.message
        });
    }
});

// POST /api/notifications/test-trade-plan - Test trade plan notifications
router.post('/test-trade-plan', authenticate, requireFeature('test'), async (req, res) => {
    try {
        const notificationService = (await import('../../services/notificationService.js')).default;
        const { type = 'buy' } = req.body;

        const mockTradePlan = {
            _id: 'test123',
            symbol: 'PSO',
            tradeType: 'buy'
        };

        if (type === 'buy') {
            await notificationService.notifyTradePlanBuyLevel(
                mockTradePlan,
                { level: 1, priceFrom: 200, priceTo: 202 },
                req.user._id
            );
        } else if (type === 'target') {
            await notificationService.notifyTradePlanTarget(
                mockTradePlan,
                { level: 1, price: 210 },
                req.user._id
            );
        } else if (type === 'stop_loss') {
            await notificationService.notifyTradePlanStopLoss(
                mockTradePlan,
                { price: 195 },
                req.user._id
            );
        }

        res.json({
            success: true,
            message: `Trade plan ${type} test notification sent! Check your notifications.`
        });
    } catch (error) {
        console.error('Error sending test trade plan notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test notification',
            error: error.message
        });
    }
});

// POST /api/notifications/test-admin - Test admin notifications
router.post('/test-admin', authenticate, requireFeature('test'), adminOnly, async (req, res) => {
    try {
        const notificationService = (await import('../../services/notificationService.js')).default;

        const mockSignal = {
            _id: 'signal123',
            symbol: 'ENGRO',
            signalType: 'buy',
            strategyName: 'EMA Crossover',
            entryPrice: 320
        };

        await notificationService.notifySignalGenerated(mockSignal, req.user._id);

        res.json({
            success: true,
            message: 'Admin signal test notification sent! Check your notifications.'
        });
    } catch (error) {
        console.error('Error sending test admin notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test notification',
            error: error.message
        });
    }
});

// GET /api/notifications/email-debug - Debug email configuration
router.get('/email-debug', authenticate, requireFeature('test'), async (req, res) => {
    try {
        const NotificationPreference = (await import('../../models/NotificationPreference.js')).default;
        const emailService = (await import('../../services/emailService.js')).default;
        const User = (await import('../../models/User.js')).default;

        const user = await User.findById(req.user._id);
        const prefs = await NotificationPreference.getOrCreate(req.user._id);

        const debugInfo = {
            user: {
                email: user.email,
                username: user.username,
                role: user.role
            },
            preferences: {
                emailChannel: prefs.channels.email,
                features: Object.fromEntries(prefs.features || new Map())
            },
            emailService: {
                initialized: emailService.initialized,
                provider: emailService.provider ? emailService.provider.getName() : 'None',
                configured: emailService.provider ? emailService.provider.isConfigured() : false
            },
            config: {
                hasResendKey: !!process.env.RESEND_API_KEY,
                fromEmail: process.env.EMAIL_FROM_EMAIL,
                fromName: process.env.EMAIL_FROM_NAME
            }
        };

        res.json({
            success: true,
            data: debugInfo
        });
    } catch (error) {
        console.error('Error fetching email debug info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch email debug info',
            error: error.message
        });
    }
});

// POST /api/notifications/test-email - Send direct test email
router.post('/test-email', authenticate, requireFeature('test'), async (req, res) => {
    try {
        const emailService = (await import('../../services/emailService.js')).default;
        const User = (await import('../../models/User.js')).default;

        const user = await User.findById(req.user._id);

        if (!emailService.initialized) {
            await emailService.initialize();
        }

        const result = await emailService.sendNotificationEmail(
            user.email,
            user.username,
            '🧪 Email Test - PSX SmartDesk',
            'This is a test email to verify your email notification settings are working correctly. If you received this email, your email notifications are configured properly!',
            '/notifications',
            'medium'
        );

        res.json({
            success: true,
            message: `Test email sent to ${user.email}`,
            data: {
                email: user.email,
                result: {
                    success: result.success,
                    messageId: result.messageId,
                    provider: emailService.provider ? emailService.provider.getName() : 'Console',
                    previewUrl: result.previewUrl
                }
            }
        });
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test email',
            error: error.message
        });
    }
});

export default router;
