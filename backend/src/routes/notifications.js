import express from 'express';
import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { authenticate } from '../middleware/auth.js';
import { currentMarket } from '../config/marketStore.js';
import pushService from '../services/pushService.js';
import PushSubscription from '../models/PushSubscription.js';

const router = express.Router();

// GET /api/notifications - Get user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      read,
      type,
      priority
    } = req.query;

    /**
     * Scoped to the book you are looking at.
     *
     * A PSX level printing has nothing to say to somebody working the US
     * screen, and a badge lit by a notification the list will not show is worse
     * than no badge - you clear it by opening a page that has nothing on it.
     * Everything that belongs to neither market stays visible in both.
     */
    const query = { userId: req.user._id, ...Notification.visibleIn(currentMarket()) };

    // Filter by read status
    if (read !== undefined) {
      query.read = read === 'true';
    }

    // Filter by category or legacy type
    if (type) {
      // Support both category and legacy type field
      query.$or = [
        { category: type },
        { type: type }
      ];
    }

    // Filter by priority
    if (priority) {
      query.priority = priority;
    }

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Get unread count
    const unreadCount = await Notification.getUnreadCount(req.user._id, currentMarket());

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        totalCount: total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user._id, currentMarket());

    res.json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message
    });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// PUT /api/notifications/mark-all-read - Mark all as read
router.put('/mark-all-read', authenticate, async (req, res) => {
  try {
    // Only what you can see. "Mark all read" reaching across a market would
    // clear a badge for a book that is not on screen, and the thing it cleared
    // is never coming back to tell you what it was.
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false, ...Notification.visibleIn(currentMarket()) },
      {
        $set: {
          read: true,
          readAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} notifications as read`,
      data: {
        updatedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
      error: error.message
    });
  }
});

// DELETE /api/notifications/clear-read - Delete all read notifications
// IMPORTANT: This must come BEFORE /:id route to avoid matching "clear-read" as an ID
router.delete('/clear-read', authenticate, async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.user._id,
      read: true,
      ...Notification.visibleIn(currentMarket())
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} read notifications`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
      error: error.message
    });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

// GET /api/notifications/preferences - Get user's notification preferences
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const prefs = await NotificationPreference.getOrCreate(req.user._id);

    res.json({
      success: true,
      data: {
        preferences: prefs
      }
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences',
      error: error.message
    });
  }
});

// PUT /api/notifications/preferences - Update notification preferences
router.put('/preferences', authenticate, async (req, res) => {
  try {
    let prefs = await NotificationPreference.getOrCreate(req.user._id);

    // Update preferences
    const allowedFields = ['enabled', 'channels', 'types', 'quietHours', 'digest'];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        prefs[field] = req.body[field];
      }
    });

    await prefs.save();

    res.json({
      success: true,
      message: 'Notification preferences updated',
      data: {
        preferences: prefs
      }
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
});

// GET /api/notifications/push/key - the key the browser subscribes with
router.get('/push/key', authenticate, (req, res) => {
  res.json({
    success: true,
    data: { publicKey: pushService.vapidPublicKey(), configured: pushService.isConfigured }
  });
});

// GET /api/notifications/push/devices - what the server can actually reach
router.get('/push/devices', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: await pushService.devicesFor(req.user._id, req.query.endpoint)
    });
  } catch (error) {
    console.error('Error reading push devices:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/notifications/push/subscribe - register this browser
router.post('/push/subscribe', authenticate, async (req, res) => {
  try {
    await pushService.subscribe(req.user._id, req.body.subscription || {}, req.get('user-agent'));

    // Granting permission is the consent. Making the user then find a toggle to
    // turn the channel on would mean allowing push and still getting nothing.
    const prefs = await NotificationPreference.getOrCreate(req.user._id);
    if (!prefs.channels.push.enabled) {
      prefs.channels.push.enabled = true;
      await prefs.save();
    }

    res.json({ success: true, message: 'Push notifications enabled on this device' });
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error('Error subscribing to push:', error);
    res.status(status).json({ success: false, message: error.message });
  }
});

// DELETE /api/notifications/push/subscribe - unregister this browser
router.delete('/push/subscribe', authenticate, async (req, res) => {
  try {
    const removed = await pushService.unsubscribe(req.user._id, req.body.endpoint);

    // The channel flag is global but the subscriptions are per device, so it is
    // only switched off once the last one has gone.
    const left = await PushSubscription.countDocuments({ userId: req.user._id });
    if (left === 0) {
      const prefs = await NotificationPreference.getOrCreate(req.user._id);
      prefs.channels.push.enabled = false;
      await prefs.save();
    }

    res.json({ success: true, data: { removed, remaining: left } });
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    res.status(500).json({ success: false, message: 'Failed to unsubscribe', error: error.message });
  }
});

// POST /api/notifications/push/test - prove the whole path end to end
router.post('/push/test', authenticate, async (req, res) => {
  try {
    const result = await pushService.sendToUser(req.user._id, {
      title: '\ud83d\udd14 Push is working',
      body: 'This is what a stop or target alert will look like.',
      actionUrl: '/journal',
      priority: 'high'
    });
    res.json({ success: result.sent > 0, data: result });
  } catch (error) {
    console.error('Error sending test push:', error);
    res.status(500).json({ success: false, message: 'Failed to send test push', error: error.message });
  }
});

export default router;

