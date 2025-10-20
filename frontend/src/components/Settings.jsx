import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, RefreshCw, Clock, Calendar, TrendingUp, Activity, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import * as settingsService from '../services/settings';
import socket from '../services/socket';
import { toast } from 'react-hot-toast';

const Settings = () => {
  const [activeMenu, setActiveMenu] = useState('general');
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form state for General settings
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  // Form state for Market Hours
  const [regularOpen, setRegularOpen] = useState({ hour: 9, minute: 15 });
  const [regularClose, setRegularClose] = useState({ hour: 15, minute: 30 });
  const [fridayMorningOpen, setFridayMorningOpen] = useState({ hour: 9, minute: 15 });
  const [fridayMorningClose, setFridayMorningClose] = useState({ hour: 12, minute: 0 });
  const [fridayAfternoonOpen, setFridayAfternoonOpen] = useState({ hour: 14, minute: 30 });
  const [fridayAfternoonClose, setFridayAfternoonClose] = useState({ hour: 16, minute: 30 });

  useEffect(() => {
    loadSettings();
    
    // Listen for price updates from Socket.IO
    const handlePriceUpdate = (data) => {
      console.log('Price update received:', data);
      toast.success(`✅ Prices updated! (${data.updated} stocks refreshed)`);
      setRefreshing(false);
      loadSettings(); // Refresh the status
    };
    
    socket.on('priceUpdate', handlePriceUpdate);
    
    return () => {
      socket.off('priceUpdate', handlePriceUpdate);
    };
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settingsRes, statusRes] = await Promise.all([
        settingsService.getSettings(),
        settingsService.getSystemStatus()
      ]);

      if (settingsRes.success) {
        const sett = settingsRes.data.settings;
        setSettings(sett);
        setStatus(settingsRes.data.serviceStatus);
        
        // Populate form
        setIntervalMinutes(sett.pricePolling.intervalMinutes);
        setPollingEnabled(sett.pricePolling.enabled);
        setRegularOpen(sett.marketHours.regularMarketOpen);
        setRegularClose(sett.marketHours.regularMarketClose);
        setFridayMorningOpen(sett.marketHours.fridayMorningOpen);
        setFridayMorningClose(sett.marketHours.fridayMorningClose);
        setFridayAfternoonOpen(sett.marketHours.fridayAfternoonOpen);
        setFridayAfternoonClose(sett.marketHours.fridayAfternoonClose);
      }

      if (statusRes.success) {
        setStatus(prev => ({ ...prev, ...statusRes.data }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneral = async () => {
    try {
      setSaving(true);
      const response = await settingsService.updateSettings({
        pricePolling: {
          intervalMinutes,
          enabled: pollingEnabled
        }
      });

      if (response.success) {
        toast.success('General settings saved successfully!');
        loadSettings(); // Reload to get updated status
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
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
        loadSettings();
      }
    } catch (error) {
      console.error('Error saving market hours:', error);
      toast.error('Failed to save market hours');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshPrices = async () => {
    try {
      setRefreshing(true);
      const response = await settingsService.refreshPrices();

      if (response.success) {
        // Backend started the refresh in background
        toast.success('🔄 Fetching prices in background...', {
          duration: 3000,
          icon: '📊'
        });
        // Keep spinner going - will be stopped when Socket.IO 'priceUpdate' event arrives
      } else if (response.data?.status === 'already_fetching') {
        // Already fetching - show warning
        toast('⏳ Price fetch already in progress', {
          icon: '⚠️',
          duration: 2000
        });
        setRefreshing(false);
      }
    } catch (error) {
      console.error('Error refreshing prices:', error);
      toast.error('Failed to start price refresh');
      setRefreshing(false);
    }
    // Note: Don't stop refreshing here if success - wait for Socket.IO event
  };

  const formatTime = (hour, minute) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (ms) => {
    if (!ms) return 'Never';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-cyan-500" />
            System Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure price polling, market hours, and system preferences
          </p>
        </div>

        {/* Layout: Left Menu + Right Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Menu */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sticky top-4">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveMenu('general')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    activeMenu === 'general'
                      ? 'bg-cyan-500 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-medium">General</span>
                </button>
                <button
                  onClick={() => setActiveMenu('market-hours')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    activeMenu === 'market-hours'
                      ? 'bg-cyan-500 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
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
            {/* General Settings */}
            {activeMenu === 'general' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">General Settings</h2>

                {/* Market Status - Useful Info */}
                {status?.marketStatus && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">PSX Market Status</h3>
                      {status.marketStatus.isOpen ? (
                        <span className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle className="w-5 h-5" />
                          OPEN
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-medium">
                          <XCircle className="w-5 h-5" />
                          CLOSED
                        </span>
                      )}
                    </div>
                    {status.marketStatus.message && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{status.marketStatus.message}</p>
                    )}
                  </div>
                )}

                {/* Manual Price Refresh */}
                <div className="mb-8 p-4 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg border border-cyan-200 dark:border-cyan-500/30">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Manual Price Refresh</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Manually fetch latest prices from PSX (works anytime, bypasses market hours check)
                  </p>
                  <button
                    onClick={handleRefreshPrices}
                    disabled={refreshing}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh Prices Now'}
                  </button>
                  {settings?.pricePolling?.lastPriceUpdate && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Last price update: {new Date(settings.pricePolling.lastPriceUpdate).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Polling Interval */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Polling Interval (minutes)
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    How often to check prices during market hours (5-60 minutes)
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={intervalMinutes}
                      onChange={(e) => setIntervalMinutes(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 min-w-[80px] text-right">
                      {intervalMinutes} min
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>5 min</span>
                    <span>30 min</span>
                    <span>60 min</span>
                  </div>
                </div>

                {/* Enable/Disable Polling */}
                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pollingEnabled}
                      onChange={(e) => setPollingEnabled(e.target.checked)}
                      className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable automatic price polling
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-8">
                    When disabled, prices will only update via manual refresh
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneral}
                    disabled={saving}
                    className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Market Hours Settings */}
            {activeMenu === 'market-hours' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Market Hours Configuration</h2>

                <div className="space-y-8">
                  {/* Regular Hours (Mon-Thu) */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-cyan-500" />
                      Regular Trading Hours (Monday - Thursday)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Market Open
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={regularOpen.hour}
                            onChange={(e) => setRegularOpen({ ...regularOpen, hour: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="HH"
                          />
                          <span className="self-center text-gray-500">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={regularOpen.minute}
                            onChange={(e) => setRegularOpen({ ...regularOpen, minute: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="MM"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{formatTime(regularOpen.hour, regularOpen.minute)} PKT</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Market Close
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={regularClose.hour}
                            onChange={(e) => setRegularClose({ ...regularClose, hour: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="HH"
                          />
                          <span className="self-center text-gray-500">:</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={regularClose.minute}
                            onChange={(e) => setRegularClose({ ...regularClose, minute: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="MM"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{formatTime(regularClose.hour, regularClose.minute)} PKT</p>
                      </div>
                    </div>
                  </div>

                  {/* Friday Hours */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-amber-500" />
                      Friday Trading Hours (Split Session)
                    </h3>
                    
                    {/* Morning Session */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Morning Session</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">Open</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              max="23"
                              value={fridayMorningOpen.hour}
                              onChange={(e) => setFridayMorningOpen({ ...fridayMorningOpen, hour: parseInt(e.target.value) })}
                              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <span className="self-center text-gray-500">:</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={fridayMorningOpen.minute}
                              onChange={(e) => setFridayMorningOpen({ ...fridayMorningOpen, minute: parseInt(e.target.value) })}
                              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">Close</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              max="23"
                              value={fridayMorningClose.hour}
                              onChange={(e) => setFridayMorningClose({ ...fridayMorningClose, hour: parseInt(e.target.value) })}
                              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <span className="self-center text-gray-500">:</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={fridayMorningClose.minute}
                              onChange={(e) => setFridayMorningClose({ ...fridayMorningClose, minute: parseInt(e.target.value) })}
                              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Afternoon Session */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Afternoon Session</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">Open</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              max="23"
                              value={fridayAfternoonOpen.hour}
                              onChange={(e) => setFridayAfternoonOpen({ ...fridayAfternoonOpen, hour: parseInt(e.target.value) })}
                              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <span className="self-center text-gray-500">:</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={fridayAfternoonOpen.minute}
                              onChange={(e) => setFridayAfternoonOpen({ ...fridayAfternoonOpen, minute: parseInt(e.target.value) })}
                              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">Close</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              max="23"
                              value={fridayAfternoonClose.hour}
                              onChange={(e) => setFridayAfternoonClose({ ...fridayAfternoonClose, hour: parseInt(e.target.value) })}
                              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <span className="self-center text-gray-500">:</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={fridayAfternoonClose.minute}
                              onChange={(e) => setFridayAfternoonClose({ ...fridayAfternoonClose, minute: parseInt(e.target.value) })}
                              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weekend Days Info */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong className="text-gray-900 dark:text-white">Weekend Days:</strong> Saturday and Sunday (Market Closed)
                    </p>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveMarketHours}
                      disabled={saving}
                      className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Market Hours'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

