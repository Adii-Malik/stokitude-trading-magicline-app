import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, RefreshCw, Clock, Calendar, TrendingUp, Activity, CheckCircle, XCircle, AlertCircle, AlertTriangle, Database, ChevronDown, ChevronUp } from 'lucide-react';
import * as settingsService from '../services/settings';
import socket from '../services/socket';
import { toast } from 'react-hot-toast';
import api from '../services/api';

const Settings = () => {
  const [activeMenu, setActiveMenu] = useState('general');
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Service Monitor state
  const [systemStatus, setSystemStatus] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedService, setExpandedService] = useState(null);
  const [serviceStats, setServiceStats] = useState({});

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

  // Auto-refresh service monitor
  useEffect(() => {
    if (activeMenu === 'service-monitor') {
      fetchServiceStatus();

      if (autoRefresh) {
        const interval = setInterval(fetchServiceStatus, 30000); // 30s
        return () => clearInterval(interval);
      }
    }
  }, [activeMenu, autoRefresh]);

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

  const fetchServiceStatus = async () => {
    try {
      const [statusRes, diagnosisRes] = await Promise.all([
        api.get('/service-monitor/status'),
        api.get('/service-monitor/diagnose')
      ]);

      setSystemStatus(statusRes.data.data);
      setDiagnosis(diagnosisRes.data.data);

      // Fetch statistics for each service
      const services = ['pricePolling', 'tradingViewDaily', 'tradingViewWeekly'];
      const statsPromises = services.map(service =>
        api.get(`/service-monitor/statistics/${service}?hours=24`)
          .then(res => ({ service, data: res.data.data }))
          .catch(() => ({ service, data: null }))
      );

      const statsResults = await Promise.all(statsPromises);
      const stats = {};
      statsResults.forEach(({ service, data }) => {
        stats[service] = data;
      });
      setServiceStats(stats);
    } catch (error) {
      console.error('Failed to fetch service status:', error);
    }
  };

  const toggleServiceExpand = (serviceName) => {
    setExpandedService(expandedService === serviceName ? null : serviceName);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
      case 'open':
      case 'success':
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'stopped':
      case 'closed':
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
      case 'open':
      case 'success':
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'stopped':
      case 'closed':
      case 'warning':
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'error':
      case 'unhealthy':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
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
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${activeMenu === 'general'
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-medium">General</span>
                </button>
                <button
                  onClick={() => setActiveMenu('market-hours')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${activeMenu === 'market-hours'
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Market Hours</span>
                </button>
                <button
                  onClick={() => setActiveMenu('service-monitor')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${activeMenu === 'service-monitor'
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                  <Activity className="w-5 h-5" />
                  <span className="font-medium">Service Monitor</span>
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

            {/* Service Monitor */}
            {activeMenu === 'service-monitor' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Service Monitor</h2>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="rounded"
                      />
                      Auto-refresh (30s)
                    </label>
                    <button
                      onClick={fetchServiceStatus}
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Health Summary */}
                {diagnosis && (
                  <div className={`mb-6 p-4 rounded-lg border-2 ${getStatusColor(diagnosis.issuesFound === 0 ? 'healthy' : 'warning')}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(diagnosis.issuesFound === 0 ? 'healthy' : 'warning')}
                        <div>
                          <h3 className="text-lg font-semibold">
                            {diagnosis.issuesFound === 0 ? 'All Systems Operational' : `${diagnosis.issuesFound} Issue${diagnosis.issuesFound > 1 ? 's' : ''} Detected`}
                          </h3>
                          <p className="text-sm opacity-75">{diagnosis.recommendation}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm opacity-75">
                        {formatTimestamp(diagnosis.timestamp)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Issues */}
                {diagnosis?.issues?.length > 0 && (
                  <div className="mb-6 space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Issues</h3>
                    {diagnosis.issues.map((issue, idx) => (
                      <div key={idx} className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)}`}>
                        <div className="flex items-start gap-3">
                          {issue.severity === 'critical' ? (
                            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm uppercase">{issue.service}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${issue.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                                {issue.severity}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1">{issue.issue}</p>
                            <p className="text-sm opacity-75">💡 {issue.solution}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Services Detailed Cards */}
                {systemStatus && (
                  <div className="space-y-4 mb-6">
                    {/* Price Polling Service */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => toggleServiceExpand('pricePolling')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Price Polling Service</h3>
                                {getStatusIcon(systemStatus.services.pricePolling?.status)}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Fetches real-time stock prices from PSX during market hours
                              </p>
                            </div>
                          </div>
                          {expandedService === 'pricePolling' ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400 block text-xs">Status</span>
                            <span className={`px-2 py-0.5 rounded font-medium text-xs inline-block mt-1 ${getStatusColor(systemStatus.services.pricePolling?.status)}`}>
                              {systemStatus.services.pricePolling?.status}
                            </span>
                          </div>
                          {systemStatus.services.pricePolling?.lastCheckAgo && (
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400 block text-xs">Last Check</span>
                              <span className="font-medium text-gray-900 dark:text-white block mt-1">{systemStatus.services.pricePolling.lastCheckAgo}</span>
                            </div>
                          )}
                          {serviceStats.pricePolling && (
                            <>
                              <div className="text-sm">
                                <span className="text-gray-600 dark:text-gray-400 block text-xs">Success Rate (24h)</span>
                                <span className="font-medium text-gray-900 dark:text-white block mt-1">
                                  {serviceStats.pricePolling.total > 0
                                    ? `${Math.round((serviceStats.pricePolling.success / serviceStats.pricePolling.total) * 100)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="text-sm">
                                <span className="text-gray-600 dark:text-gray-400 block text-xs">Executions (24h)</span>
                                <span className="font-medium text-gray-900 dark:text-white block mt-1">{serviceStats.pricePolling.total}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {expandedService === 'pricePolling' && (
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                          <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Recent Activity</h4>
                          {systemStatus.lastActivities?.pricePolling ? (
                            <div className="space-y-2">
                              {systemStatus.lastActivities.pricePolling.map((activity, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-sm p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                                  <div className="mt-0.5">{getStatusIcon(activity.status)}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="font-medium text-gray-900 dark:text-white">{activity.message}</span>
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusColor(activity.status)}`}>
                                        {activity.status}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                      <span>{formatTimestamp(activity.timestamp)}</span>
                                      {activity.duration && (
                                        <span>Duration: {(activity.duration / 1000).toFixed(2)}s</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">No recent activity</p>
                          )}

                          {serviceStats.pricePolling?.lastExecution && (
                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                              <h5 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Last Execution Details</h5>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400 block">Time</span>
                                  <span className="font-medium text-gray-900 dark:text-white">{formatTimestamp(serviceStats.pricePolling.lastExecution.timestamp)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400 block">Status</span>
                                  <span className={`px-2 py-0.5 rounded font-medium inline-block ${getStatusColor(serviceStats.pricePolling.lastExecution.status)}`}>
                                    {serviceStats.pricePolling.lastExecution.status}
                                  </span>
                                </div>
                                {serviceStats.pricePolling.lastExecution.duration && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400 block">Duration</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {(serviceStats.pricePolling.lastExecution.duration / 1000).toFixed(2)}s
                                    </span>
                                  </div>
                                )}
                                {serviceStats.pricePolling.averageDuration && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400 block">Avg Duration (24h)</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{serviceStats.pricePolling.averageDuration}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* TradingView Scheduler Service */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => toggleServiceExpand('tradingView')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900 dark:text-white">TradingView Scheduler</h3>
                                {getStatusIcon(systemStatus.services.tradingViewScheduler?.status)}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Updates OHLCV data daily (Mon-Fri 5:30 PM) and weekly/monthly (Sat 6:00 PM)
                              </p>
                            </div>
                          </div>
                          {expandedService === 'tradingView' ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400 block text-xs">Status</span>
                            <span className={`px-2 py-0.5 rounded font-medium text-xs inline-block mt-1 ${getStatusColor(systemStatus.services.tradingViewScheduler?.status)}`}>
                              {systemStatus.services.tradingViewScheduler?.status}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400 block text-xs">Daily Job</span>
                            <span className={`font-medium block mt-1 ${systemStatus.services.tradingViewScheduler?.dailyJob === 'active' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                              {systemStatus.services.tradingViewScheduler?.dailyJob || 'N/A'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400 block text-xs">Weekly Job</span>
                            <span className={`font-medium block mt-1 ${systemStatus.services.tradingViewScheduler?.weeklyJob === 'active' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                              {systemStatus.services.tradingViewScheduler?.weeklyJob || 'N/A'}
                            </span>
                          </div>
                          {(serviceStats.tradingViewDaily || serviceStats.tradingViewWeekly) && (
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400 block text-xs">Executions (24h)</span>
                              <span className="font-medium text-gray-900 dark:text-white block mt-1">
                                {(serviceStats.tradingViewDaily?.total || 0) + (serviceStats.tradingViewWeekly?.total || 0)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {expandedService === 'tradingView' && (
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                          <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Recent Activity</h4>
                          {(systemStatus.lastActivities?.tradingViewDaily || systemStatus.lastActivities?.tradingViewWeekly) ? (
                            <div className="space-y-2">
                              {[...(systemStatus.lastActivities.tradingViewDaily || []), ...(systemStatus.lastActivities.tradingViewWeekly || [])]
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                .slice(0, 5)
                                .map((activity, idx) => (
                                  <div key={idx} className="flex items-start gap-3 text-sm p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                                    <div className="mt-0.5">{getStatusIcon(activity.status)}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="font-medium text-gray-900 dark:text-white">{activity.message}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusColor(activity.status)}`}>
                                          {activity.status}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                        <span>{formatTimestamp(activity.timestamp)}</span>
                                        {activity.duration && (
                                          <span>Duration: {(activity.duration / 1000).toFixed(2)}s</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">No recent activity</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Market Hours Service - Compact (no expansion needed) */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center gap-3 mb-3">
                        <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Market Hours Service</h3>
                            {getStatusIcon(systemStatus.services.marketHours?.status)}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Tracks PSX trading hours and manages market open/close detection
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="text-sm">
                          <span className="text-gray-600 dark:text-gray-400 block text-xs">Market Status</span>
                          <span className={`px-2 py-0.5 rounded font-medium text-xs inline-block mt-1 ${getStatusColor(systemStatus.services.marketHours?.marketStatus)}`}>
                            {systemStatus.services.marketHours?.marketStatus}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600 dark:text-gray-400 block text-xs">Current Time (PKT)</span>
                          <span className="font-medium text-gray-900 dark:text-white block mt-1">{systemStatus.services.marketHours?.currentTime}</span>
                        </div>
                        {systemStatus.services.marketHours?.nextOpen && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400 block text-xs">Next Open</span>
                            <span className="font-medium text-gray-900 dark:text-white block mt-1 text-xs">{formatTimestamp(systemStatus.services.marketHours.nextOpen)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Database Service - Compact */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center gap-3">
                        <Database className="w-6 h-6 text-green-600 dark:text-green-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Database Connection</h3>
                            {getStatusIcon(systemStatus.database?.connected ? 'running' : 'error')}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            MongoDB connection status
                          </p>
                        </div>
                        <div>
                          <span className={`px-3 py-1 rounded font-medium text-sm ${systemStatus.database?.connected ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                            {systemStatus.database?.connected ? 'Connected' : 'Disconnected'}
                          </span>
                        </div>
                      </div>
                      {!systemStatus.database?.connected && (
                        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                          <p className="text-xs text-red-600 dark:text-red-400">
                            ⚠️ Database disconnected - check MongoDB connection string and network
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

