import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';
import emailService from './emailService.js';
import { isValidCategory, isValidEvent, isAdminOnly } from '../config/notificationConfig.js';

class NotificationService {
  /**
   * Send a notification to a user or multiple users
   * @param {Object} params - Notification parameters
   * @param {String|Array} params.userId - User ID(s) to send notification to
   * @param {String} params.category - Notification category (trade_plans, system, admin)
   * @param {String} params.event - Notification event (buy_level_hit, target_hit, etc.)
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
      category,
      event,
      title,
      message,
      data = {},
      priority = 'medium',
      actionUrl,
      expiresInDays = 30
    } = params;

    // Validate category and event
    if (!isValidCategory(category)) {
      console.error(`❌ Invalid notification category: ${category}`);
      return { success: 0, failed: 1, total: 1 };
    }

    if (!isValidEvent(category, event)) {
      console.error(`❌ Invalid notification event: ${event} for category: ${category}`);
      return { success: 0, failed: 1, total: 1 };
    }

    // Handle multiple users
    const userIds = Array.isArray(userId) ? userId : [userId];

    const results = await Promise.allSettled(
      userIds.map(uid => this.sendToUser({
        userId: uid,
        category,
        event,
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
      category,
      event,
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

      // Check if admin-only notification for non-admin user
      if (isAdminOnly(category) && !['admin', 'super_admin'].includes(user.role)) {
        console.log(`⚠️  Admin-only notification skipped for regular user ${user.username}`);
        return null;
      }

      // Get user preferences
      const prefs = await NotificationPreference.getOrCreate(userId);

      // Check if notification should be sent
      if (!prefs.shouldSendNotification(category, 'inApp')) {
        console.log(`⚠️  User ${user.username} has disabled ${category} notifications`);
        return null;
      }

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Create notification record
      const notification = await Notification.create({
        userId,
        category,
        event,
        type: `${category}_${event}`, // Legacy field for backward compatibility
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
      if (prefs.shouldSendNotification(category, 'email')) {
        this.sendEmail(notification, user, prefs).catch(err => {
          console.error(`❌ Failed to send email notification: ${err.message}`);
        });
      }

      // TODO: Send push notification if enabled
      // if (prefs.shouldSendNotification(category, 'push')) {
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
   * Journal levels. These reuse the trade_plans category because its events are
   * the same three concepts, and its id is stored on every NotificationPreference
   * row - renaming it would silently reset everyone's settings.
   *
   * All three go to the entry's owner only. A journal is one person's record.
   */
  async notifyJournalEntryZone(entry, price) {
    const zone = [entry.entryFrom, entry.entryTo]
      .filter(n => n != null).map(n => n.toFixed(2)).join(' - ');

    return this.send({
      userId: entry.user,
      category: 'trade_plans',
      event: 'buy_level_hit',
      title: `💰 Entry zone reached: ${entry.symbol}`,
      message: `${entry.symbol} is at ${price.toFixed(2)}, inside your planned entry zone (${zone}).`,
      data: { journalEntryId: entry._id, symbol: entry.symbol, price },
      priority: 'high',
      actionUrl: '/journal'
    });
  }

  async notifyJournalTarget(entry, target, price) {
    return this.send({
      userId: entry.user,
      category: 'trade_plans',
      event: 'target_hit',
      title: `🎉 Target ${target.level} reached: ${entry.symbol}`,
      message: `${entry.symbol} hit ${price.toFixed(2)}, through your target ${target.level} of ${target.price.toFixed(2)}.`,
      data: { journalEntryId: entry._id, symbol: entry.symbol, level: target.level, price },
      priority: 'high',
      actionUrl: '/journal'
    });
  }

  async notifyJournalStop(entry, price) {
    return this.send({
      userId: entry.user,
      category: 'trade_plans',
      event: 'stop_loss_hit',
      // Deliberately a question. The trade is not closed here, and pretending
      // otherwise would put a price in the journal the broker never filled.
      title: `⚠️ Stop level reached: ${entry.symbol}`,
      message: `${entry.symbol} is at ${price.toFixed(2)}, through your stop of ${entry.plannedStop.toFixed(2)}. Did you exit?`,
      data: { journalEntryId: entry._id, symbol: entry.symbol, price },
      priority: 'urgent',
      actionUrl: '/journal'
    });
  }

  /**
   * Trading Signal Generated (Admin notification)
   */
  async notifySignalGenerated(signal, userId = null) {
    const title = `📊 New Signal: ${signal.symbol}`;
    const message = `${signal.signalType.toUpperCase()} signal generated for ${signal.symbol} by ${signal.strategyName}`;

    const params = {
      category: 'admin',
      event: 'signal_generated',
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

    // Only notify admins for signals (incomplete setups)
    return this.notifyAdmins(params);
  }
}

export default new NotificationService();

