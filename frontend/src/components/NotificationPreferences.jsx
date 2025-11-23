import { useState, useEffect } from 'react';
import { Bell, Save, TestTube, Clock, Mail, Smartphone, Monitor } from 'lucide-react';
import { getPreferences, updatePreferences, sendTestNotification } from '../services/notifications';
import toast from 'react-hot-toast';

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await getPreferences();
      setPreferences(response.data.preferences);
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updatePreferences(preferences);
      toast.success('Preferences saved successfully');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setSendingTest(true);
      await sendTestNotification();
      toast.success('Test notification sent! Check your email and notifications.');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    } finally {
      setSendingTest(false);
    }
  };

  const updateTypePreference = (type, channel, value) => {
    setPreferences(prev => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: {
          ...prev.types[type],
          [channel]: value
        }
      }
    }));
  };

  const notificationTypes = [
    { 
      id: 'strategic_level_met', 
      label: 'Strategic Level Met', 
      description: 'When a stock price meets or exceeds its strategic level'
    },
    { 
      id: 'trade_plan_buy_level', 
      label: 'Buy Level Hit', 
      description: 'When a trade plan\'s buy level is reached'
    },
    { 
      id: 'trade_plan_target', 
      label: 'Target Hit', 
      description: 'When a trade plan\'s target price is reached'
    },
    { 
      id: 'trade_plan_stop_loss', 
      label: 'Stop Loss Hit', 
      description: 'When a trade plan\'s stop loss is triggered'
    },
    { 
      id: 'trade_plan_created', 
      label: 'New Trade Plan', 
      description: 'When a new trade plan is created'
    },
    { 
      id: 'signal_generated', 
      label: 'Signal Generated', 
      description: 'When a new trading signal is generated'
    },
    { 
      id: 'strategy_opportunity', 
      label: 'Strategy Opportunity', 
      description: 'When a trading strategy identifies an opportunity'
    },
    { 
      id: 'system_alert', 
      label: 'System Alert', 
      description: 'Important system updates and alerts'
    },
    { 
      id: 'price_alert', 
      label: 'Price Alert', 
      description: 'Custom price alerts you set'
    },
    { 
      id: 'admin_announcement', 
      label: 'Admin Announcement', 
      description: 'Announcements from administrators'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Failed to load preferences</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Bell className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
              Notification Preferences
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Customize how and when you receive notifications
            </p>
          </div>
          <button
            onClick={handleTestNotification}
            disabled={sendingTest}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <TestTube className="w-4 h-4" />
            {sendingTest ? 'Sending...' : 'Send Test'}
          </button>
        </div>
      </div>

      {/* Global Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Global Settings
        </h3>
        
        {/* Global Enable */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <label className="font-medium text-gray-900 dark:text-white">
              Enable All Notifications
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Master switch for all notifications
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.enabled}
              onChange={(e) => setPreferences({ ...preferences, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
          </label>
        </div>

        {/* Quiet Hours */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <label className="font-medium text-gray-900 dark:text-white">
                Quiet Hours
              </label>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.quietHours?.enabled || false}
                onChange={(e) => setPreferences({
                  ...preferences,
                  quietHours: {
                    ...preferences.quietHours,
                    enabled: e.target.checked
                  }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
            </label>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Don't send notifications during these hours
          </p>
          
          {preferences.quietHours?.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={preferences.quietHours?.startTime || '22:00'}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    quietHours: {
                      ...preferences.quietHours,
                      startTime: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={preferences.quietHours?.endTime || '08:00'}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    quietHours: {
                      ...preferences.quietHours,
                      endTime: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Types */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Notification Types
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Choose how you want to receive each type of notification
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notification Type
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div className="flex items-center justify-center gap-1">
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </div>
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div className="flex items-center justify-center gap-1">
                    <Monitor className="w-4 h-4" />
                    <span>In-App</span>
                  </div>
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span className="text-xs opacity-50">(Future)</span>
                  <div className="flex items-center justify-center gap-1">
                    <Smartphone className="w-4 h-4" />
                    <span>Push</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {notificationTypes.map((type) => (
                <tr key={type.id}>
                  <td className="py-4 px-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {type.label}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {type.description}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={preferences.types?.[type.id]?.email ?? true}
                      onChange={(e) => updateTypePreference(type.id, 'email', e.target.checked)}
                      className="w-4 h-4 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 dark:focus:ring-cyan-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </td>
                  <td className="py-4 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={preferences.types?.[type.id]?.inApp ?? true}
                      onChange={(e) => updateTypePreference(type.id, 'inApp', e.target.checked)}
                      className="w-4 h-4 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 dark:focus:ring-cyan-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </td>
                  <td className="py-4 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={preferences.types?.[type.id]?.push ?? false}
                      disabled
                      className="w-4 h-4 text-gray-400 bg-gray-100 border-gray-300 rounded opacity-50 cursor-not-allowed"
                      title="Push notifications coming soon"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={loadPreferences}
          className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

