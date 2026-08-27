import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Clock, Calendar } from 'lucide-react';
import * as settingsService from '../../services/settings';
import { toast } from 'react-hot-toast';
import { ContentLoader } from '../common';

const Settings = () => {
  const [activeMenu, setActiveMenu] = useState('market-hours');
  const [, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state for Market Hours
  const [regularOpen, setRegularOpen] = useState({ hour: 9, minute: 15 });
  const [regularClose, setRegularClose] = useState({ hour: 15, minute: 30 });
  const [fridayMorningOpen, setFridayMorningOpen] = useState({ hour: 9, minute: 15 });
  const [fridayMorningClose, setFridayMorningClose] = useState({ hour: 12, minute: 0 });
  const [fridayAfternoonOpen, setFridayAfternoonOpen] = useState({ hour: 14, minute: 30 });
  const [fridayAfternoonClose, setFridayAfternoonClose] = useState({ hour: 16, minute: 30 });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsRes = await settingsService.getSettings();

      if (settingsRes.success) {
        const sett = settingsRes.data.settings;
        setSettings(sett);

        // Populate form
        setRegularOpen(sett.marketHours.regularMarketOpen);
        setRegularClose(sett.marketHours.regularMarketClose);
        setFridayMorningOpen(sett.marketHours.fridayMorningOpen);
        setFridayMorningClose(sett.marketHours.fridayMorningClose);
        setFridayAfternoonOpen(sett.marketHours.fridayAfternoonOpen);
        setFridayAfternoonClose(sett.marketHours.fridayAfternoonClose);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMarketHours = async () => {
    try {
      setSaving(true);
      const response = await settingsService.updateSettings({
        marketHours: {
          regularMarketOpen: regularOpen,
          regularMarketClose: regularClose,
          fridayMorningOpen,
          fridayMorningClose,
          fridayAfternoonOpen,
          fridayAfternoonClose
        }
      });

      if (response.success) {
        toast.success('Market hours saved successfully!');
        loadSettings(); // Reload
      }
    } catch (error) {
      console.error('Error saving market hours:', error);
      toast.error(error.response?.data?.message || 'Failed to save market hours');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (hour, minute) => {
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <div className="min-h-screen bg-surface-muted py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ink flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-cyan-500" />
            System Settings
          </h1>
          <p className="mt-2 text-ink-muted">
            Configure market hours and system preferences
          </p>
        </div>

        {loading ? (
          <div className="bg-surface rounded-control shadow">
            <ContentLoader message="Loading settings..." />
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Menu */}
          <div className="lg:col-span-1">
            <div className="bg-surface rounded-control shadow-card-hover p-4 sticky top-4">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveMenu('market-hours')}
                  className={`w-full text-left px-4 py-3 rounded-control transition-colors flex items-center gap-3 ${activeMenu === 'market-hours'
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-hairline dark:hover:bg-gray-700 text-ink-muted'
                    }`}
                >
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Market Hours</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Right Content */}
          <div className="lg:col-span-3">
            {/* Market Hours Settings */}
            {activeMenu === 'market-hours' && (
              <div className="bg-surface rounded-control shadow-card-hover p-6">
                <h2 className="text-2xl font-bold text-ink mb-6">Market Hours Configuration</h2>

                <div className="space-y-8">
                  {/* Regular Hours (Mon-Thu) */}
                  <div>
                    <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-cyan-500" />
                      Regular Trading Hours (Monday - Thursday)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">
                          Market Open
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={regularOpen.hour}
                            onChange={(e) => setRegularOpen({ ...regularOpen, hour: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                            placeholder="HH"
                          />
                          <span className="self-center text-ink-muted">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={regularOpen.minute}
                            onChange={(e) => setRegularOpen({ ...regularOpen, minute: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                            placeholder="MM"
                          />
                        </div>
                        <p className="text-xs text-ink-muted mt-1">{formatTime(regularOpen.hour, regularOpen.minute)} PKT</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">
                          Market Close
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={regularClose.hour}
                            onChange={(e) => setRegularClose({ ...regularClose, hour: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                            placeholder="HH"
                          />
                          <span className="self-center text-ink-muted">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={regularClose.minute}
                            onChange={(e) => setRegularClose({ ...regularClose, minute: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                            placeholder="MM"
                          />
                        </div>
                        <p className="text-xs text-ink-muted mt-1">{formatTime(regularClose.hour, regularClose.minute)} PKT</p>
                      </div>
                    </div>
                  </div>

                  {/* Friday Morning Hours */}
                  <div>
                    <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-cyan-500" />
                      Friday Morning Session
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">
                          Morning Open
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={fridayMorningOpen.hour}
                            onChange={(e) => setFridayMorningOpen({ ...fridayMorningOpen, hour: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                          />
                          <span className="self-center text-ink-muted">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={fridayMorningOpen.minute}
                            onChange={(e) => setFridayMorningOpen({ ...fridayMorningOpen, minute: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                          />
                        </div>
                        <p className="text-xs text-ink-muted mt-1">{formatTime(fridayMorningOpen.hour, fridayMorningOpen.minute)} PKT</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">
                          Morning Close
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={fridayMorningClose.hour}
                            onChange={(e) => setFridayMorningClose({ ...fridayMorningClose, hour: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                          />
                          <span className="self-center text-ink-muted">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={fridayMorningClose.minute}
                            onChange={(e) => setFridayMorningClose({ ...fridayMorningClose, minute: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                          />
                        </div>
                        <p className="text-xs text-ink-muted mt-1">{formatTime(fridayMorningClose.hour, fridayMorningClose.minute)} PKT</p>
                      </div>
                    </div>
                  </div>

                  {/* Friday Afternoon Hours */}
                  <div>
                    <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-cyan-500" />
                      Friday Afternoon Session
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">
                          Afternoon Open
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={fridayAfternoonOpen.hour}
                            onChange={(e) => setFridayAfternoonOpen({ ...fridayAfternoonOpen, hour: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                          />
                          <span className="self-center text-ink-muted">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={fridayAfternoonOpen.minute}
                            onChange={(e) => setFridayAfternoonOpen({ ...fridayAfternoonOpen, minute: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                          />
                        </div>
                        <p className="text-xs text-ink-muted mt-1">{formatTime(fridayAfternoonOpen.hour, fridayAfternoonOpen.minute)} PKT</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">
                          Afternoon Close
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={fridayAfternoonClose.hour}
                            onChange={(e) => setFridayAfternoonClose({ ...fridayAfternoonClose, hour: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                          />
                          <span className="self-center text-ink-muted">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={fridayAfternoonClose.minute}
                            onChange={(e) => setFridayAfternoonClose({ ...fridayAfternoonClose, minute: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-hairline rounded-control bg-surface text-ink"
                          />
                        </div>
                        <p className="text-xs text-ink-muted mt-1">{formatTime(fridayAfternoonClose.hour, fridayAfternoonClose.minute)} PKT</p>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4 border-t border-hairline">
                    <button
                      onClick={handleSaveMarketHours}
                      disabled={saving}
                      className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white font-medium rounded-control transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Market Hours'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
