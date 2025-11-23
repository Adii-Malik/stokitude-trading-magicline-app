import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';
import emailService from './emailService.js';

class NotificationService {
  /**
   * Send a notification to a user or multiple users
   * @param {Object} params - Notification parameters
   * @param {String|Array} params.userId - User ID(s) to send notification to
   * @param {String} params.type - Notification type
   * @param {String} params.title - Notification title
   * @param {String} params.message - Notification message
   * @param {Object} params.data - Additional data
   * @param {String} params.priority - Priority level (low, medium, high, urgent)
   * @param {String} params.actionUrl - Optional action URL
   * @param {Number} params.expiresInDays - Days until notification expires (default: 30)
   */
  async send(params) {
    const {
      userId,
      type,
      title,
      message,
      data = {},
      priority = 'medium',
      actionUrl,
      expiresInDays = 30
    } = params;

    // Handle multiple users
    const userIds = Array.isArray(userId) ? userId : [userId];
    
    const results = await Promise.allSettled(
      userIds.map(uid => this.sendToUser({ 
        userId: uid, 
        type, 
        title, 
        message, 
        data, 
        priority, 
        actionUrl, 
        expiresInDays 
      }))
    );

    return {
      success: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      total: results.length
    };
  }

  /**
   * Send notification to a single user
   */
  async sendToUser(params) {
    const {
      userId,
      type,
      title,
      message,
      data = {},
      priority = 'medium',
      actionUrl,
      expiresInDays = 30
    } = params;

    try {
      // Get user
      const user = await User.findById(userId);
      if (!user || !user.isActive) {
        console.log(`⚠️  User ${userId} not found or inactive, skipping notification`);
        return null;
      }

      // Get user preferences
      const prefs = await NotificationPreference.getOrCreate(userId);

      // Check if notification should be sent
      if (!prefs.shouldSendNotification(type, 'inApp')) {
        console.log(`⚠️  User ${user.username} has disabled ${type} notifications`);
        return null;
      }

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Create notification record
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        data,
        priority,
        actionUrl,
        expiresAt,
        channels: {
          inApp: {
            sent: true,
            sentAt: new Date()
          },
          email: {
            sent: false
          },
          push: {
            sent: false
          }
        }
      });

      console.log(`✅ In-app notification created for ${user.username}: ${title}`);

      // Send email if enabled
      if (prefs.shouldSendNotification(type, 'email')) {
        this.sendEmail(notification, user, prefs).catch(err => {
          console.error(`❌ Failed to send email notification: ${err.message}`);
        });
      }

      // TODO: Send push notification if enabled
      // if (prefs.shouldSendNotification(type, 'push')) {
      //   this.sendPushNotification(notification, user).catch(err => {
      //     console.error(`❌ Failed to send push notification: ${err.message}`);
      //   });
      // }

      return notification;
    } catch (error) {
      console.error(`❌ Error sending notification to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(notification, user, prefs) {
    try {
      const emailAddress = prefs.channels.email.address || user.email;

      await emailService.sendNotificationEmail(
        emailAddress,
        user.username,
        notification.title,
        notification.message,
        notification.actionUrl,
        notification.priority
      );

      // Update notification record
      notification.channels.email.sent = true;
      notification.channels.email.sentAt = new Date();
      await notification.save();

      console.log(`📧 Email notification sent to ${user.username}`);
    } catch (error) {
      // Update notification record with error
      notification.channels.email.error = error.message;
      await notification.save();
      throw error;
    }
  }

  /**
   * Notify all admins
   */
  async notifyAdmins(params) {
    const admins = await User.find({ 
      role: { $in: ['admin', 'super_admin'] },
      isActive: true 
    });

    const adminIds = admins.map(admin => admin._id);
    return this.send({ ...params, userId: adminIds });
  }

  /**
   * Notify all users
   */
  async notifyAll(params) {
    const users = await User.find({ isActive: true });
    const userIds = users.map(user => user._id);
    return this.send({ ...params, userId: userIds });
  }

  /**
   * Strategic Level Met Notification
   */
  async notifyStrategicLevelMet(symbol, magicLine, currentPrice, userId = null) {
    const title = `🎯 Strategic Level Met: ${symbol}`;
    const message = `${symbol} has reached its strategic level of ${magicLine.toFixed(2)}. Current price: ${currentPrice.toFixed(2)}`;
    
    const params = {
      type: 'strategic_level_met',
      title,
      message,
      data: { symbol, magicLine, currentPrice },
      priority: 'high',
      actionUrl: '/magic-line'
    };

    if (userId) {
      return this.send({ ...params, userId });
    } else {
      return this.notifyAll(params);
    }
  }

  /**
   * Trade Plan Buy Level Hit
   */
  async notifyTradePlanBuyLevel(tradePlan, level, userId = null) {
    const title = `💰 Buy Level Hit: ${tradePlan.symbol}`;
    const message = `Buy Level ${level.level} (${level.priceFrom.toFixed(2)} - ${level.priceTo.toFixed(2)}) has been hit for ${tradePlan.symbol}`;
    
    const params = {
      type: 'trade_plan_buy_level',
      title,
      message,
      data: { 
        tradePlanId: tradePlan._id,
        symbol: tradePlan.symbol, 
        level: level.level,
        priceFrom: level.priceFrom,
        priceTo: level.priceTo
      },
      priority: 'high',
      actionUrl: '/trade-signals'
    };

    if (userId) {
      return this.send({ ...params, userId });
    } else {
      return this.notifyAll(params);
    }
  }

  /**
   * Trade Plan Target Hit
   */
  async notifyTradePlanTarget(tradePlan, target, userId = null) {
    const title = `🎉 Target Hit: ${tradePlan.symbol}`;
    const message = `Target ${target.level} (${target.price.toFixed(2)}) has been hit for ${tradePlan.symbol}!`;
    
    const params = {
      type: 'trade_plan_target',
      title,
      message,
      data: { 
        tradePlanId: tradePlan._id,
        symbol: tradePlan.symbol, 
        level: target.level,
        price: target.price
      },
      priority: 'high',
      actionUrl: '/trade-signals'
    };

    if (userId) {
      return this.send({ ...params, userId });
    } else {
      return this.notifyAll(params);
    }
  }

  /**
   * Trade Plan Stop Loss Hit
   */
  async notifyTradePlanStopLoss(tradePlan, stopLoss, userId = null) {
    const title = `⚠️ Stop Loss Hit: ${tradePlan.symbol}`;
    const message = `Stop Loss (${stopLoss.price.toFixed(2)}) has been hit for ${tradePlan.symbol}`;
    
    const params = {
      type: 'trade_plan_stop_loss',
      title,
      message,
      data: { 
        tradePlanId: tradePlan._id,
        symbol: tradePlan.symbol, 
        price: stopLoss.price
      },
      priority: 'urgent',
      actionUrl: '/trade-signals'
    };

    if (userId) {
      return this.send({ ...params, userId });
    } else {
      return this.notifyAll(params);
    }
  }

  /**
   * New Trade Plan Created
   */
  async notifyTradePlanCreated(tradePlan, userId = null) {
    const title = `📋 New Trade Plan: ${tradePlan.symbol}`;
    const message = `A new ${tradePlan.tradeType} trade plan has been created for ${tradePlan.symbol}`;
    
    const params = {
      type: 'trade_plan_created',
      title,
      message,
      data: { 
        tradePlanId: tradePlan._id,
        symbol: tradePlan.symbol,
        tradeType: tradePlan.tradeType,
        setupQuality: tradePlan.setupQuality
      },
      priority: 'medium',
      actionUrl: '/trade-signals'
    };

    if (userId) {
      return this.send({ ...params, userId });
    } else {
      return this.notifyAll(params);
    }
  }

  /**
   * Trading Signal Generated
   */
  async notifySignalGenerated(signal, userId = null) {
    const title = `📊 New Signal: ${signal.symbol}`;
    const message = `${signal.signalType.toUpperCase()} signal generated for ${signal.symbol} by ${signal.strategyName}`;
    
    const params = {
      type: 'signal_generated',
      title,
      message,
      data: { 
        signalId: signal._id,
        symbol: signal.symbol,
        signalType: signal.signalType,
        strategyName: signal.strategyName,
        entryPrice: signal.entryPrice
      },
      priority: 'high',
      actionUrl: '/trading-bot'
    };

    if (userId) {
      return this.send({ ...params, userId });
    } else {
      return this.notifyAdmins(params); // Only notify admins for signals
    }
  }
}

export default new NotificationService();

