import express from 'express';
import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { getFeaturesForUser, getUserControllableFeatures } from '../config/notificationConfig.js';
import { requireFeature } from '../config/featureFlags.js';

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

    const query = { userId: req.user._id };

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
    const unreadCount = await Notification.getUnreadCount(req.user._id);

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
    const unreadCount = await Notification.getUnreadCount(req.user._id);

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
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
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
      read: true
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

// GET /api/notifications/features - Get available notification features
router.get('/features', authenticate, async (req, res) => {
  try {
    // Get only user-controllable features (no system/admin)
    const features = getUserControllableFeatures();

    res.json({
      success: true,
      data: {
        features
      }
    });
  } catch (error) {
    console.error('Error fetching notification features:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification features',
      error: error.message
    });
  }
});

export default router;

