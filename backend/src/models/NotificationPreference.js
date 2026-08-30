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

/**
 * Whether this channel may carry a notification right now.
 *
 * It used to take a category too, and check three things: a global switch, the
 * channel, and a per-category switch held in a `features` map. With one
 * category left there is nothing to select between - the per-feature toggle and
 * the master switch said the same thing in two places, which is two places to
 * look when nothing arrives.
 *
 * Quiet hours apply only to the channels that make a noise. An in-app entry is
 * something you go and look at, so silencing it would only lose the record.
 */
notificationPreferenceSchema.methods.shouldSend = function (channel) {
  if (!this.enabled) return false;
  if (!this.channels[channel]?.enabled) return false;

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

