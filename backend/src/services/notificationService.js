import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';
import emailService from './emailService.js';
import pushService from './pushService.js';
import { isValidCategory, isValidEvent } from '../config/notificationConfig.js';

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
      market = null,
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
        market,
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
      market = null,
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
      if (!prefs.shouldSend('inApp')) {
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
        market,
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
      if (prefs.shouldSend('email')) {
        this.sendEmail(notification, user, prefs).catch(err => {
          console.error(`❌ Failed to send email notification: ${err.message}`);
        });
      }

      // Send push if enabled. Not awaited, for the same reason email is not:
      // the notification is already saved, and a push service being slow must
      // not hold up the price poll that raised the alert.
      if (prefs.shouldSend('push')) {
        this.sendPush(notification, user).catch(err => {
          console.error(`❌ Failed to send push notification: ${err.message}`);
        });
      }

      return notification;
    } catch (error) {
      console.error(`❌ Error sending notification to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Stamp one channel's outcome onto a notification.
   *
   * A targeted update, never doc.save(). Email and push are both dispatched
   * without awaiting - deliberately, so a slow provider cannot hold up the price
   * run that raised the alert - which means two writers reach the same document
   * at the same time. Mongoose refuses that ("Can't save() the same doc multiple
   * times in parallel") and the loser's result was simply lost: a push that had
   * actually been delivered recorded itself as not sent.
   */
  async stamp(notification, channel, fields) {
    await Notification.updateOne(
      { _id: notification._id },
      { $set: Object.fromEntries(Object.entries(fields).map(([k, v]) => [`channels.${channel}.${k}`, v])) }
    );
  }

  /**
   * Send email notification
   */
  async sendEmail(notification, user, prefs) {
    try {
      const emailAddress = prefs.channels.email.address || user.email;

      const result = await emailService.sendNotificationEmail(
        emailAddress,
        user.username,
        notification.title,
        notification.message,
        notification.actionUrl,
        notification.priority
      );

      // Only a real send counts. With no provider configured the email service
      // prints to the console and says so, and the record must agree with it.
      if (result?.delivered === false) {
        await this.stamp(notification, 'email', { error: 'No email provider configured' });
        return;
      }

      await this.stamp(notification, 'email', { sent: true, sentAt: new Date() });
      console.log(`📧 Email notification sent to ${user.username}`);
    } catch (error) {
      await this.stamp(notification, 'email', { error: error.message });
      throw error;
    }
  }

  /**
   * Send push notification
   *
   * A device that has gone away is not a failure - pushService deletes it and
   * says so. The notification only counts as pushed if at least one device took
   * it, so `sent: 0` leaves the record honest rather than claiming delivery.
   */
  async sendPush(notification, user) {
    const result = await pushService.sendToUser(user._id, {
      title: notification.title,
      body: notification.message,
      actionUrl: notification.actionUrl,
      priority: notification.priority,
      notificationId: String(notification._id)
    });

    if (result.sent > 0) {
      await this.stamp(notification, 'push', { sent: true, sentAt: new Date() });
    } else if (result.failed > 0) {
      await this.stamp(notification, 'push', { error: `${result.failed} device(s) failed` });
    }

    const dropped = result.gone ? `, ${result.gone} expired device(s) removed` : '';
    console.log(`\ud83d\udcf1 Push sent to ${result.sent} device(s) for ${user.username}${dropped}`);
  }

  /**
   * Journal levels. These reuse the trade_plans category because its events are
   * the same concepts, and its id is stored on every NotificationPreference row -
   * renaming it would silently reset everyone's settings.
   *
   * Both go to the entry's owner only. A journal is one person's record.
   */
  /**
   * What actually printed, said as what it is.
   *
   * Every one of these messages used to open "SYMBOL is at 518.00" while 518.00
   * was the session *high* - the watcher takes the extreme that reached your
   * level, on purpose, and the sentence then called it the current price. Two
   * alerts about one stock read as the system contradicting itself when both
   * were true: it traded up to 518 and later down to 488.
   *
   * `live` is honoured for the same reason. A warehoused close is a previous
   * session with no range, so it never says "today".
   */
  printed({ price, dir, live }) {
    return `${dir === 'above' ? 'High' : 'Low'} of ${price.toFixed(2)} ${live ? 'today' : 'at the last close'}`;
  }

  async notifyJournalTarget(entry, target, print) {
    return this.send({
      userId: entry.user,
      category: 'trade_plans',
      event: 'target_hit',
      title: `🎉 ${entry.symbol} hit target ${target.level}`,
      message: `${this.printed(print)}, through your target of ${target.price.toFixed(2)}.`,
      data: { journalEntryId: entry._id, symbol: entry.symbol, level: target.level, price: print.price },
      market: entry.market,
      priority: 'high',
      actionUrl: '/journal'
    });
  }

  /**
   * A price you named on the shortlist has printed.
   *
   * High, not urgent: this is a setup arriving, not a position going against
   * you. The difference decides whether the phone insists.
   */
  async notifyWatchlistTrigger(entry, print) {
    return this.send({
      userId: entry.user,
      category: 'trade_plans',
      event: 'target_hit',
      title: `\u{1F3AF} ${entry.symbol} crossed ${entry.trigger?.price?.toFixed(2)}`,
      message: `${this.printed(print)} — the level you were waiting for.`,
      data: { watchlistId: entry._id, symbol: entry.symbol, price: print.price },
      market: entry.market,
      priority: 'high',
      actionUrl: '/watchlist'
    });
  }

  /**
   * The idea is over, and this says so once.
   *
   * The entry closes itself either way - the notification is a courtesy so the
   * change is not something you discover weeks later wondering where a name
   * went.
   */
  async notifyWatchlistInvalidated(entry, print) {
    return this.send({
      userId: entry.user,
      category: 'trade_plans',
      event: 'stop_loss_hit',
      title: `\u{1F5D1}\uFE0F ${entry.symbol} is off the shortlist`,
      message: `${this.printed(print)}, through the ${entry.invalidation?.price?.toFixed(2)} you said would kill it.`,
      data: { watchlistId: entry._id, symbol: entry.symbol, price: print.price },
      market: entry.market,
      priority: 'medium',
      actionUrl: '/watchlist'
    });
  }

  async notifyJournalStop(entry, print) {
    return this.send({
      userId: entry.user,
      category: 'trade_plans',
      event: 'stop_loss_hit',
      // Deliberately a question. The trade is not closed here, and pretending
      // otherwise would put a price in the journal the broker never filled.
      title: `⚠️ ${entry.symbol} through your stop`,
      message: `${this.printed(print)}, through your stop of ${entry.plannedStop.toFixed(2)}. Did you exit?`,
      data: { journalEntryId: entry._id, symbol: entry.symbol, price: print.price },
      market: entry.market,
      priority: 'urgent',
      actionUrl: '/journal'
    });
  }

}

export default new NotificationService();

