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

// POST /api/notifications/test-magic-line-trigger - Manually trigger magic line check
router.post('/test-magic-line-trigger', authenticate, requireFeature('test'), async (req, res) => {
    try {
        const magicLineHandler = (await import('../../handlers/magicLineHandler.js')).default;

        console.log('🧪 Manual magic line check triggered by:', req.user.username);

        const result = await magicLineHandler.checkMagicLines();

        res.json({
            success: true,
            message: 'Magic line check completed',
            data: result
        });
    } catch (error) {
        console.error('Error triggering magic line check:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger magic line check',
            error: error.message
        });
    }
});

// POST /api/notifications/test-magic-line-mock - Mock a magic line being met
router.post('/test-magic-line-mock', authenticate, requireFeature('test'), async (req, res) => {
    try {
        const { symbol } = req.body;

        if (!symbol) {
            return res.status(400).json({
                success: false,
                message: 'Symbol is required'
            });
        }

        const MagicLine = (await import('../../models/MagicLine.js')).default;
        const Stock = (await import('../../models/Stock.js')).default;
        const magicLineHandler = (await import('../../handlers/magicLineHandler.js')).default;

        // Get magic line data
        const magicLineData = await MagicLine.findOne({ symbol, isActive: true });
        if (!magicLineData) {
            return res.status(404).json({
                success: false,
                message: `No active magic line found for ${symbol}`
            });
        }

        console.log(`\n🧪 Mock Magic Line Test for ${symbol}`);
        console.log(`   Current Status: ${magicLineData.status}`);
        console.log(`   Magic Line Level: Rs. ${magicLineData.magicLine}`);

        // Get or create stock
        let stock = await Stock.findOne({ symbol });
        const originalPrice = stock?.currentPrice;
        const originalStatus = magicLineData.status;

        if (!stock) {
            stock = new Stock({
                symbol,
                companyName: magicLineData.companyName,
                currentPrice: 0,
                updatedAt: new Date()
            });
        }

        // STEP 1: Ensure status is 'pending' by setting price below magic line
        const belowPrice = magicLineData.magicLine - 1.00;
        stock.currentPrice = belowPrice;
        await stock.save();
        console.log(`   📉 Step 1: Set price to Rs. ${belowPrice} (below magic line)`);

        // Run handler to set status to 'pending'
        await magicLineHandler.checkMagicLines();
        console.log(`   ⏳ Status should now be: pending`);

        // STEP 2: Set price above magic line to trigger 'met' status and notification
        const abovePrice = magicLineData.magicLine + 0.50;
        stock.currentPrice = abovePrice;
        await stock.save();
        console.log(`   📈 Step 2: Set price to Rs. ${abovePrice} (above magic line)`);

        // Run handler again - this should trigger pending → met and send notification
        const result = await magicLineHandler.checkMagicLines();
        console.log(`   ✅ Status should now be: met (notification triggered)`);

        // Restore original price and status
        if (originalPrice) {
            stock.currentPrice = originalPrice;
            await stock.save();
            console.log(`   ↩️ Restored original price: Rs. ${originalPrice}`);
        } else {
            // If no original price, remove the test stock
            await Stock.deleteOne({ symbol });
            console.log(`   🗑️ Removed test stock entry`);
        }

        // Restore original status
        await MagicLine.updateOne({ symbol }, { status: originalStatus });
        console.log(`   ↩️ Restored original status: ${originalStatus}`);

        console.log(`   ✅ Test completed - Check your notifications!\n`);

        res.json({
            success: true,
            message: `Magic line test completed for ${symbol}`,
            data: {
                symbol,
                magicLine: magicLineData.magicLine,
                testPrice: abovePrice,
                originalPrice: originalPrice || null,
                originalStatus,
                testResult: result,
                companyName: magicLineData.companyName
            }
        });
    } catch (error) {
        console.error('Error mocking magic line:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mock magic line',
            error: error.message
        });
    }
});

// POST /api/notifications/test-trade-plan-trigger - Trigger trade plan check
router.post('/test-trade-plan-trigger', authenticate, requireFeature('test'), async (req, res) => {
    try {
        console.log(`Manual trade plan check triggered by: ${req.user.name}\n`);

        const tradePlanHandler = (await import('../../handlers/tradePlanHandler.js')).default;
        const result = await tradePlanHandler.checkTradePlans();

        res.json({
            success: true,
            message: 'Trade plan check completed',
            data: result
        });
    } catch (error) {
        console.error('Error triggering trade plan check:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger trade plan check',
            error: error.message
        });
    }
});

// POST /api/notifications/test-trade-plan-mock - Mock trade plan scenarios
router.post('/test-trade-plan-mock', authenticate, requireFeature('test'), async (req, res) => {
    try {
        const { planId, scenario } = req.body;

        if (!planId || !scenario) {
            return res.status(400).json({
                success: false,
                message: 'planId and scenario are required. Scenarios: buy_level, target, stop_loss'
            });
        }

        const TradePlan = (await import('../../models/TradePlan.js')).default;
        const Stock = (await import('../../models/Stock.js')).default;
        const tradePlanHandler = (await import('../../handlers/tradePlanHandler.js')).default;

        // Get trade plan
        const plan = await TradePlan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: `Trade plan not found: ${planId}`
            });
        }

        console.log(`🧪 Mock Trade Plan Test: ${plan.symbol} - ${scenario}`);
        console.log(`   Trade Type: ${plan.tradeType}`);
        console.log(`   Current Status: ${plan.isActive ? 'Active' : 'Inactive'}`);

        // Get or create stock
        let stock = await Stock.findOne({ symbol: plan.symbol });
        const originalPrice = stock?.currentPrice;
        let mockPrice;
        let scenarioDescription;

        // Determine mock price based on scenario
        switch (scenario) {
            case 'buy_level': {
                // Find first unhit buy level
                const unhitLevel = plan.buyLevels.find(l => !l.isHit);
                if (!unhitLevel) {
                    return res.status(400).json({
                        success: false,
                        message: 'All buy levels already hit'
                    });
                }
                // Handle both field name formats
                const minPrice = unhitLevel.priceFrom || unhitLevel.minPrice;
                const maxPrice = unhitLevel.priceTo || unhitLevel.maxPrice;
                mockPrice = (minPrice + maxPrice) / 2;
                scenarioDescription = `Buy Level ${unhitLevel.level} (${minPrice}-${maxPrice})`;
                break;
            }

            case 'target': {
                // Check if any buy level hit
                const anyBuyHit = plan.buyLevels.some(l => l.isHit);
                if (!anyBuyHit) {
                    return res.status(400).json({
                        success: false,
                        message: 'No buy level hit yet. Targets can only be checked after buy level is hit.'
                    });
                }

                // Find first unhit target
                const unhitTarget = plan.targetPrices.find(t => !t.isHit);
                if (!unhitTarget) {
                    return res.status(400).json({
                        success: false,
                        message: 'All targets already hit'
                    });
                }

                // Set price to trigger target based on trade type
                if (plan.tradeType === 'buy') {
                    mockPrice = unhitTarget.price + 0.50; // Above target for BUY
                } else {
                    mockPrice = unhitTarget.price - 0.50; // Below target for SHORT
                }
                scenarioDescription = `Target ${unhitTarget.level} (${unhitTarget.price})`;
                break;
            }

            case 'stop_loss': {
                // Check if any buy level hit
                const anyBuyHit = plan.buyLevels.some(l => l.isHit);
                if (!anyBuyHit) {
                    return res.status(400).json({
                        success: false,
                        message: 'No buy level hit yet. Stop loss can only be checked after buy level is hit.'
                    });
                }

                if (plan.stopLoss.isHit) {
                    return res.status(400).json({
                        success: false,
                        message: 'Stop loss already hit'
                    });
                }

                // Set price to trigger stop loss based on trade type
                if (plan.tradeType === 'buy') {
                    mockPrice = plan.stopLoss.price - 0.50; // Below SL for BUY
                } else {
                    mockPrice = plan.stopLoss.price + 0.50; // Above SL for SHORT
                }
                scenarioDescription = `Stop Loss (${plan.stopLoss.price})`;
                break;
            }

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid scenario. Use: buy_level, target, or stop_loss'
                });
        }

        // Set mock price
        if (!stock) {
            stock = new Stock({
                symbol: plan.symbol,
                companyName: plan.companyName,
                currentPrice: mockPrice,
                updatedAt: new Date()
            });
        } else {
            stock.currentPrice = mockPrice;
            stock.updatedAt = new Date();
        }

        await stock.save();
        console.log(`   📊 Temporarily set price to Rs. ${mockPrice} (original: ${originalPrice || 'N/A'})`);
        console.log(`   🎯 Testing scenario: ${scenarioDescription}`);

        // Run the actual production handler logic
        console.log(`   🔄 Running actual trade plan check logic...`);
        const result = await tradePlanHandler.checkTradePlans();

        // Restore original price if it existed
        if (originalPrice) {
            stock.currentPrice = originalPrice;
            await stock.save();
            console.log(`   ↩️ Restored original price: Rs. ${originalPrice}`);
        }

        console.log(`   ✅ Test completed - Check your notifications!`);

        res.json({
            success: true,
            message: `Trade plan ${scenario} test completed for ${plan.symbol}`,
            data: {
                planId: plan._id,
                symbol: plan.symbol,
                scenario,
                scenarioDescription,
                mockPrice,
                originalPrice: originalPrice || null,
                testResult: result,
                companyName: plan.companyName
            }
        });
    } catch (error) {
        console.error('Error mocking trade plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mock trade plan',
            error: error.message
        });
    }
});

// POST /api/notifications/test-trade-plan-reset - Reset trade plan state for testing
router.post('/test-trade-plan-reset', authenticate, requireFeature('test'), async (req, res) => {
    try {
        const { planId } = req.body;

        if (!planId) {
            return res.status(400).json({
                success: false,
                message: 'planId is required'
            });
        }

        const TradePlan = (await import('../../models/TradePlan.js')).default;

        // Get trade plan
        const plan = await TradePlan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: `Trade plan not found: ${planId}`
            });
        }

        console.log(`🔄 Resetting trade plan state: ${plan.symbol}`);

        // Reset all buy levels
        plan.buyLevels.forEach(level => {
            level.isHit = false;
            level.hitDate = null;
        });

        // Reset all targets
        plan.targetPrices.forEach(target => {
            target.isHit = false;
            target.hitDate = null;
        });

        // Reset stop loss
        plan.stopLoss.isHit = false;
        plan.stopLoss.hitDate = null;

        // Reactivate the plan
        plan.isActive = true;
        plan.exitDate = null;

        await plan.save();

        console.log(`   ✅ Trade plan reset to initial state`);

        res.json({
            success: true,
            message: `Trade plan reset successfully for ${plan.symbol}`,
            data: {
                planId: plan._id,
                symbol: plan.symbol,
                companyName: plan.companyName,
                buyLevels: plan.buyLevels,
                targetPrices: plan.targetPrices,
                stopLoss: plan.stopLoss,
                isActive: plan.isActive
            }
        });
    } catch (error) {
        console.error('Error resetting trade plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset trade plan',
            error: error.message
        });
    }
});

export default router;
