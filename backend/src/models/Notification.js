import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  // Recipient
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Notification details
  // Category: High-level feature grouping (trade_plans, system, admin)
  category: {
    type: String,
    required: true,
    index: true
  },

  // Event: Specific event type (for internal tracking and filtering)
  event: {
    type: String,
    required: true,
    index: true
  },

  // Legacy type field for backward compatibility (deprecated)
  type: {
    type: String,
    index: true
  },

  title: {
    type: String,
    required: true,
    maxlength: 200
  },

  message: {
    type: String,
    required: true,
    maxlength: 1000
  },

  /**
   * Which book this is about, or absent when it is about neither.
   *
   * Not the marketScoped plugin. That one filters to exactly one market, and
   * most of what lands here - a job that failed, an admin message, anything
   * about the account itself - belongs to both. Absent means "always show",
   * which is also what every notification written before this field existed
   * means, so nothing has to be backfilled to stay visible.
   *
   * Stamped by the caller rather than derived: a notification has no venue and
   * no currency of its own, only the record it is about.
   */
  market: {
    type: String,
    index: true
  },

  // Additional data (flexible JSON)
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Status
  read: {
    type: Boolean,
    default: false,
    index: true
  },

  readAt: {
    type: Date
  },

  // Delivery channels
  channels: {
    email: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      error: { type: String }
    },
    push: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      error: { type: String }
    },
    inApp: {
      sent: { type: Boolean, default: true },
      sentAt: { type: Date }
    }
  },

  // Action link (optional)
  actionUrl: {
    type: String
  },

  // Expiry (auto-delete old notifications)
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, event: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual for age
notificationSchema.virtual('age').get(function () {
  return Date.now() - this.createdAt.getTime();
});

// Method to mark as read
notificationSchema.methods.markAsRead = async function () {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Static method to mark multiple as read
notificationSchema.statics.markManyAsRead = async function (notificationIds, userId) {
  return this.updateMany(
    { _id: { $in: notificationIds }, userId, read: false },
    {
      $set: {
        read: true,
        readAt: new Date()
      }
    }
  );
};

/**
 * What a reader in this market is allowed to see: its own, plus everything that
 * belongs to no market. `null` in an $in matches a missing field too, which is
 * what makes every notification written before the field existed keep showing.
 */
notificationSchema.statics.visibleIn = function (market) {
  return market ? { market: { $in: [market, null] } } : {};
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId, market) {
  return this.countDocuments({ userId, read: false, ...this.visibleIn(market) });
};

// Static method to cleanup old notifications
notificationSchema.statics.cleanupOld = async function (daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await this.deleteMany({
    read: true,
    createdAt: { $lt: cutoffDate }
  });

  return result.deletedCount;
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;

