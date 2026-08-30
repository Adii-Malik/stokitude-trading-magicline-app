import { useState, useEffect } from 'react';
import { Bell, Save, Clock, Mail, Monitor, Smartphone } from 'lucide-react';
import { getPreferences, updatePreferences } from '../services/notifications';
import toast from 'react-hot-toast';
import PushChannel from './PushChannel';

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const prefsResponse = await getPreferences();
      setPreferences(prefsResponse.data.preferences);
    } catch (error) {
      console.error('Error loading data:', error);
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
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Bell className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
            Notification Preferences
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Customize how and when you receive notifications
          </p>
        </div>
      </div>

      {/* Global Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Global Settings
        </h3>

        <div className="flex items-center justify-between py-3">
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
      </div>

      {/* Notification Channels */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Notification Channels
        </h3>

        <div className="space-y-4">
          {/* Email */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Email Notifications
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive notifications via email
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.channels?.email?.enabled || false}
                onChange={(e) => setPreferences({
                  ...preferences,
                  channels: {
                    ...preferences.channels,
                    email: { ...preferences.channels.email, enabled: e.target.checked }
                  }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
            </label>
          </div>

          {/* In-App */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  In-App Notifications
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Show notifications in the app
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.channels?.inApp?.enabled !== false}
                onChange={(e) => setPreferences({
                  ...preferences,
                  channels: {
                    ...preferences.channels,
                    inApp: { ...preferences.channels.inApp, enabled: e.target.checked }
                  }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
            </label>
          </div>

          {/* Push. Owns its own state: it is the one channel that is a property
              of this device rather than of the account, so it cannot be part of
              the preferences blob that Save writes. */}
          <PushChannel icon={<Smartphone className="w-5 h-5 text-gray-600 dark:text-gray-400" />} />
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Quiet Hours
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900 dark:text-white">
                Enable Quiet Hours
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Don't send email/push notifications during these hours
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.quietHours?.enabled || false}
                onChange={(e) => setPreferences({
                  ...preferences,
                  quietHours: { ...preferences.quietHours, enabled: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
            </label>
          </div>

          {preferences.quietHours?.enabled && (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={preferences.quietHours?.startTime || '22:00'}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    quietHours: { ...preferences.quietHours, startTime: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={preferences.quietHours?.endTime || '08:00'}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    quietHours: { ...preferences.quietHours, endTime: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

