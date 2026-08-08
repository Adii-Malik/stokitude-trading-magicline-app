import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // Global preferences
  enabled: {
    type: Boolean,
    default: true
  },

  // Channel preferences
  channels: {
    email: {
      enabled: { type: Boolean, default: true },
      address: { type: String } // Override email if different from user's primary email
    },
    push: {
      enabled: { type: Boolean, default: false } // Disabled by default, enable when push is implemented
    },
    inApp: {
      enabled: { type: Boolean, default: true }
    }
  },

  // Feature preferences (dynamic - only user-controllable features)
  // System and admin notifications are always enabled (not stored here)
  features: {
    type: Map,
    of: {
      enabled: { type: Boolean, default: true }
    },
    default: () => new Map([
      ['trade_plans', { enabled: true }]
    ])
  },

  // Quiet hours (no notifications during these hours)
  quietHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '22:00' }, // Format: HH:mm
    endTime: { type: String, default: '08:00' }
  },

  // Digest settings (batch notifications)
  digest: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'never'],
      default: 'never'
    },
    time: { type: String, default: '09:00' } // Format: HH:mm
  }
}, {
  timestamps: true
});

// Static method to get or create preferences
notificationPreferenceSchema.statics.getOrCreate = async function (userId) {
  let prefs = await this.findOne({ userId });

  if (!prefs) {
    prefs = await this.create({ userId });
  }

  return prefs;
};

// Method to check if notification should be sent
notificationPreferenceSchema.methods.shouldSendNotification = function (category, channel) {
  // Check if globally enabled
  if (!this.enabled) return false;

  // Check if channel is enabled
  if (!this.channels[channel]?.enabled) return false;

  // System and admin notifications are ALWAYS enabled (bypass user preferences)
  if (category === 'system' || category === 'admin') {
    // Still respect quiet hours for email/push
    if ((channel === 'email' || channel === 'push') && this.quietHours.enabled) {
      if (this.isInQuietHours()) return false;
    }
    return true;
  }

  // Check if feature category is enabled (for user-controllable features)
  const featureConfig = this.features.get(category);
  if (!featureConfig || !featureConfig.enabled) return false;

  // Check quiet hours (only for email and push)
  if ((channel === 'email' || channel === 'push') && this.quietHours.enabled) {
    if (this.isInQuietHours()) return false;
  }

  return true;
};

// Method to check if currently in quiet hours
notificationPreferenceSchema.methods.isInQuietHours = function () {
  if (!this.quietHours.enabled) return false;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const start = this.quietHours.startTime;
  const end = this.quietHours.endTime;

  // Handle cases where quiet hours span midnight
  if (start < end) {
    return currentTime >= start && currentTime < end;
  } else {
    return currentTime >= start || currentTime < end;
  }
};

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);

export default NotificationPreference;

