import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // Singleton pattern - only one settings document
  _id: {
    type: String,
    default: 'system_settings'
  },
  
  // Market Hours Configuration
  marketHours: {
    // Regular trading hours (Mon-Thu)
    regularMarketOpen: {
      hour: { type: Number, default: 9 },
      minute: { type: Number, default: 15 }
    },
    regularMarketClose: {
      hour: { type: Number, default: 15 },
      minute: { type: Number, default: 30 }
    },
    
    // Friday trading hours
    fridayMorningOpen: {
      hour: { type: Number, default: 9 },
      minute: { type: Number, default: 15 }
    },
    fridayMorningClose: {
      hour: { type: Number, default: 12 },
      minute: { type: Number, default: 0 }
    },
    fridayAfternoonOpen: {
      hour: { type: Number, default: 14 },
      minute: { type: Number, default: 30 }
    },
    fridayAfternoonClose: {
      hour: { type: Number, default: 16 },
      minute: { type: Number, default: 30 }
    },
    
    // Weekend days (0 = Sunday, 6 = Saturday)
    weekendDays: {
      type: [Number],
      default: [0, 6] // Sunday and Saturday
    },
    
    // Public holidays (YYYY-MM-DD format)
    publicHolidays: {
      type: [String],
      default: []
    }
  },
  
  // System Info (read-only, for display)
  systemInfo: {
    dataSource: {
      type: String,
      default: 'PSX Official (dps.psx.com.pk)'
    },
    timezone: {
      type: String,
      default: 'Asia/Karachi'
    }
  }
  
}, {
  timestamps: true
});

// Static method to get or create settings
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findById('system_settings');
  
  if (!settings) {
    // Create default settings
    settings = await this.create({ _id: 'system_settings' });
    console.log('📝 Created default system settings');
  }
  
  return settings;
};

// Static method to update settings
settingsSchema.statics.updateSettings = async function(updates) {
  const settings = await this.getSettings();
  
  // Merge updates deeply to preserve existing fields
  if (updates.marketHours) {
    // Deep merge for marketHours
    if (updates.marketHours.regularMarketOpen) {
      settings.marketHours.regularMarketOpen = {
        ...settings.marketHours.regularMarketOpen,
        ...updates.marketHours.regularMarketOpen
      };
    }
    if (updates.marketHours.regularMarketClose) {
      settings.marketHours.regularMarketClose = {
        ...settings.marketHours.regularMarketClose,
        ...updates.marketHours.regularMarketClose
      };
    }
    if (updates.marketHours.fridayMorningOpen) {
      settings.marketHours.fridayMorningOpen = {
        ...settings.marketHours.fridayMorningOpen,
        ...updates.marketHours.fridayMorningOpen
      };
    }
    if (updates.marketHours.fridayMorningClose) {
      settings.marketHours.fridayMorningClose = {
        ...settings.marketHours.fridayMorningClose,
        ...updates.marketHours.fridayMorningClose
      };
    }
    if (updates.marketHours.fridayAfternoonOpen) {
      settings.marketHours.fridayAfternoonOpen = {
        ...settings.marketHours.fridayAfternoonOpen,
        ...updates.marketHours.fridayAfternoonOpen
      };
    }
    if (updates.marketHours.fridayAfternoonClose) {
      settings.marketHours.fridayAfternoonClose = {
        ...settings.marketHours.fridayAfternoonClose,
        ...updates.marketHours.fridayAfternoonClose
      };
    }
    if (updates.marketHours.publicHolidays !== undefined) {
      settings.marketHours.publicHolidays = updates.marketHours.publicHolidays;
    }
  }
  
  // Mark the nested paths as modified for Mongoose
  settings.markModified('marketHours');
  
  await settings.save();
  console.log('✅ System settings updated');
  
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;

