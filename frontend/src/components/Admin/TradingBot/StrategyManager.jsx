import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  ChartBarIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import * as strategyService from '../../../services/strategies';

export default function StrategyManager() {
  const [strategies, setStrategies] = useState([]);
  const [availableStrategies, setAvailableStrategies] = useState([]);
  const [slPresets, setSlPresets] = useState({});
  const [slConfig, setSlConfig] = useState(null);
  const [showSlConfig, setShowSlConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pythonStrategy: '',
    pythonConfig: {},
    isActive: false,
    slPreset: null
  });
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  useEffect(() => {
    fetchStrategies();
    fetchAvailableStrategies();
    fetchSlPresets();
  }, []);

  const fetchStrategies = async () => {
    try {
      const data = await strategyService.getStrategies();
      if (data.success) {
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error('Error fetching strategies:', error);
      toast.error('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableStrategies = async () => {
    try {
      const data = await strategyService.getAvailableStrategies();
      if (data.success) {
        setAvailableStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error('Error fetching available strategies:', error);
    }
  };

  const fetchSlPresets = async () => {
    try {
      const data = await strategyService.getSlPresets();
      if (data.success) {
        setSlPresets(data.presets || {});
      }
    } catch (error) {
      console.error('Error fetching SL presets:', error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      // Merge SL config into pythonConfig if selected
      const finalFormData = { ...formData };
      if (slConfig) {
        finalFormData.pythonConfig = {
          ...formData.pythonConfig,
          ...slConfig
        };
      }

      const data = await strategyService.createStrategy(finalFormData);
      if (data.success) {
        toast.success('Strategy created successfully');
        setShowCreateModal(false);
        fetchStrategies();
        resetForm();
      } else {
        toast.error(data.message || 'Failed to create strategy');
      }
    } catch (error) {
      console.error('Error creating strategy:', error);
      toast.error(error.response?.data?.message || 'Failed to create strategy');
    }
  };


  const handleDelete = async (strategyId) => {
    if (!confirm('Are you sure you want to delete this strategy?')) return;

    try {
      const data = await strategyService.deleteStrategy(strategyId);
      if (data.success) {
        toast.success('Strategy deleted successfully');
        fetchStrategies();
      } else {
        toast.error(data.message || 'Failed to delete strategy');
      }
    } catch (error) {
      console.error('Error deleting strategy:', error);
      toast.error(error.response?.data?.message || 'Failed to delete strategy');
    }
  };

  const handleToggleActive = async (strategyId, isActive) => {
    try {
      const data = isActive
        ? await strategyService.deactivateStrategy(strategyId)
        : await strategyService.activateStrategy(strategyId);

      if (data.success) {
        toast.success(`Strategy ${isActive ? 'deactivated' : 'activated'} successfully`);
        fetchStrategies();
      } else {
        toast.error(data.message || 'Failed to update strategy');
      }
    } catch (error) {
      console.error('Error toggling strategy:', error);
      toast.error(error.response?.data?.message || 'Failed to update strategy');
    }
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      pythonStrategy: '',
      pythonConfig: {},
      isActive: false,
      slPreset: null
    });
    setSlConfig(null);
    setShowSlConfig(false);
  };

  const handleStrategySelect = (strategyName) => {
    const selected = availableStrategies.find(s => s.name === strategyName || s.metadata?.name === strategyName);
    if (selected) {
      // Core returns parameters as direct values, not with min/max/default structure
      const defaultConfig = selected.metadata?.parameters || {};

      // Auto-generate short, clean strategy name from metadata.name or name field
      const coreStrategyName = selected.metadata?.name || selected.name;
      const strategyShortName = coreStrategyName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const autoName = strategyShortName;

      setFormData(prev => ({
        ...prev,
        name: autoName,
        pythonStrategy: coreStrategyName, // Use metadata.name for API calls
        pythonConfig: { ...defaultConfig } // Spread to make a copy
      }));
    }
  };

  const handleConfigChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      pythonConfig: {
        ...prev.pythonConfig,
        [key]: value
      }
    }));
  };

  const handleSlConfigChange = (key, value) => {
    setSlConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSlPresetSelect = async (presetName) => {
    if (presetName === null) {
      // No SL selected
      setFormData(prev => ({ ...prev, slPreset: null }));
      setSlConfig(null);
      setShowSlConfig(false);
      return;
    }

    // Fetch full SL config from backend
    const timeframe = formData.pythonConfig?.timeframe || 'daily';
    try {
      const result = await strategyService.getSlConfig(presetName, timeframe);
      if (result.success && result.config) {
        setSlConfig(result.config);
        setFormData(prev => ({ ...prev, slPreset: presetName }));
        setShowSlConfig(true);
      }
    } catch (error) {
      console.error('Error fetching SL config:', error);
      toast.error('Failed to load SL configuration');
    }
  };

  const getSelectedStrategyMetadata = () => {
    return availableStrategies.find(s => s.name === formData.pythonStrategy || s.metadata?.name === formData.pythonStrategy);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Strategy Manager</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage your trading strategies
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Create Strategy
        </button>
      </div>

      {/* Strategies Grid */}
      {strategies.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
          <ChartBarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Strategies Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first trading strategy to get started
          </p>
          <button
            onClick={openCreateModal}
            className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Create Your First Strategy
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {strategies.map((strategy) => (
            <div
              key={strategy._id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {strategy.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {strategy.pythonStrategy}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${strategy.isActive
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {strategy.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Strategy Configuration Details */}
              <div className="space-y-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-900 dark:text-blue-100">⏱️ Timeframe:</span>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">
                    {strategy.pythonConfig?.timeframe || 'N/A'}
                  </span>
                </div>

                {strategy.pythonConfig?._sl_preset_used && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-900 dark:text-blue-100">🛡️ Stop Loss:</span>
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 capitalize">
                      {strategy.pythonConfig._sl_preset_used}
                    </span>
                  </div>
                )}

                {!strategy.pythonConfig?._sl_preset_used && strategy.pythonConfig?.use_stop_loss === false && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-900 dark:text-blue-100">🛡️ Stop Loss:</span>
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      None
                    </span>
                  </div>
                )}

                {/* Key Parameters Preview */}
                {strategy.pythonConfig && Object.keys(strategy.pythonConfig).filter(k => !k.startsWith('_') && !['timeframe', 'use_stop_loss', 'sl_method', 'sl_fixed_percent', 'sl_atr_multiplier', 'use_trailing_stop', 'trailing_stop_activation_percent', 'trailing_stop_distance_percent'].includes(k)).length > 0 && (
                  <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                    <span className="text-xs font-medium text-blue-900 dark:text-blue-100">📊 Parameters:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(strategy.pythonConfig)
                        .filter(([key]) => !key.startsWith('_') && !['timeframe', 'use_stop_loss', 'sl_method', 'sl_fixed_percent', 'sl_atr_multiplier', 'use_trailing_stop', 'trailing_stop_activation_percent', 'trailing_stop_distance_percent'].includes(key))
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <span key={key} className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded">
                            {key.replace(/_/g, ' ')}: {String(value)}
                          </span>
                        ))}
                      {Object.keys(strategy.pythonConfig).filter(k => !k.startsWith('_') && !['timeframe', 'use_stop_loss', 'sl_method', 'sl_fixed_percent', 'sl_atr_multiplier', 'use_trailing_stop', 'trailing_stop_activation_percent', 'trailing_stop_distance_percent'].includes(k)).length > 3 && (
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded">
                          +{Object.keys(strategy.pythonConfig).filter(k => !k.startsWith('_') && !['timeframe', 'use_stop_loss', 'sl_method', 'sl_fixed_percent', 'sl_atr_multiplier', 'use_trailing_stop', 'trailing_stop_activation_percent', 'trailing_stop_distance_percent'].includes(k)).length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {strategy.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {strategy.description}
                </p>
              )}

              {/* Performance Metrics */}
              {strategy.performance && (
                <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Win Rate</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {strategy.performance.winRate?.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Return</p>
                    <p className={`text-sm font-semibold ${strategy.performance.totalReturn > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                      }`}>
                      {strategy.performance.totalReturn?.toFixed(2)}%
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleActive(strategy._id, strategy.isActive)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${strategy.isActive
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200'
                    }`}
                >
                  {strategy.isActive ? (
                    <>
                      <PauseIcon className="w-4 h-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-4 h-4" />
                      Activate
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(strategy._id)}
                  className="px-4 py-2 flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <TrashIcon className="w-5 h-5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Create New Strategy
              </h3>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {/* Step 1: Select Strategy from Core */}
              <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg border-2 border-cyan-200 dark:border-cyan-800">
                <label className="block text-sm font-semibold text-cyan-900 dark:text-cyan-100 mb-3 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold">1</span>
                  Select Strategy from Core
                </label>
                <select
                  value={formData.pythonStrategy}
                  onChange={(e) => handleStrategySelect(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-cyan-300 dark:border-cyan-700 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white font-medium"
                  required
                >
                  <option value="">Choose a strategy...</option>
                  {availableStrategies.map((strategy) => {
                    const strategyName = strategy.metadata?.name || strategy.name;
                    const displayName = strategyName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    return (
                      <option key={strategyName} value={strategyName}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
                {formData.pythonStrategy && (
                  <p className="mt-2 text-xs text-cyan-700 dark:text-cyan-300">
                    ✓ Using default configuration from core engine
                  </p>
                )}
              </div>

              {/* Step 2: Select Timeframe (Most Important!) */}
              {formData.pythonStrategy && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
                  <label className="block text-sm font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold">2</span>
                    Select Timeframe
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['daily', 'weekly', 'monthly'].map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          pythonConfig: { ...prev.pythonConfig, timeframe: tf }
                        }))}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${formData.pythonConfig?.timeframe === tf
                          ? 'bg-green-600 text-white shadow-lg scale-105'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-green-400'
                          }`}
                      >
                        {tf.charAt(0).toUpperCase() + tf.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Preview & Optional Name */}
              {formData.pythonStrategy && formData.pythonConfig?.timeframe && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                    Strategy Name Preview
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={`${formData.name} - ${formData.pythonConfig?.timeframe?.toUpperCase()}`}
                    className="w-full px-4 py-2 font-medium text-lg border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    💡 Tip: Keep it short (e.g., "EMA Daily", "RSI Weekly")
                  </p>
                </div>
              )}

              {/* Step 4: Stop Loss Configuration */}
              {formData.pythonStrategy && formData.pythonConfig?.timeframe && Object.keys(slPresets).length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-2 border-orange-200 dark:border-orange-800">
                  <label className="block text-sm font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-600 text-white text-xs font-bold">3</span>
                    Stop Loss & Trailing Stop Configuration (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* No SL Option */}
                    <button
                      type="button"
                      onClick={() => handleSlPresetSelect(null)}
                      className={`p-3 rounded-lg font-medium transition-all text-left ${formData.slPreset === null
                        ? 'bg-orange-600 text-white shadow-lg scale-105 border-2 border-orange-700'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-orange-400'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🚫</span>
                        <span className="font-bold">No Stop Loss</span>
                      </div>
                      <p className={`text-xs ${formData.slPreset === null ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>
                        No SL applied
                      </p>
                    </button>

                    {/* SL Presets from Core */}
                    {Object.entries(slPresets).map(([presetName, presetConfig]) => {
                      const presetDetails = {
                        conservative: { emoji: '🛡️' },
                        moderate: { emoji: '⚖️' },
                        aggressive: { emoji: '🚀' },
                        custom: { emoji: '🎯' }
                      };
                      const details = presetDetails[presetName] || { emoji: '⚙️' };

                      // Build description from config
                      let desc = presetConfig.sl_method || 'SL';
                      if (presetConfig.sl_fixed_percent) {
                        desc += ` ${presetConfig.sl_fixed_percent}%`;
                      } else if (presetConfig.sl_atr_multiplier) {
                        desc += ` ATR ${presetConfig.sl_atr_multiplier}x`;
                      }
                      if (presetConfig.use_trailing_stop) {
                        desc += ` + Trailing`;
                      }

                      return (
                        <button
                          key={presetName}
                          type="button"
                          onClick={() => handleSlPresetSelect(presetName)}
                          className={`p-3 rounded-lg font-medium transition-all text-left ${formData.slPreset === presetName
                            ? 'bg-orange-600 text-white shadow-lg scale-105 border-2 border-orange-700'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-orange-400'
                            }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{details.emoji}</span>
                            <span className="font-bold capitalize">{presetName.replace(/_/g, ' ')}</span>
                          </div>
                          <p className={`text-xs ${formData.slPreset === presetName ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>
                            {desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-3">
                    💡 Stop loss settings help manage risk. Select a preset or skip if not needed.
                  </p>
                </div>
              )}

              {/* SL Config Editor (if preset selected) */}
              {showSlConfig && slConfig && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                      <CogIcon className="w-5 h-5" />
                      Stop Loss Configuration (Customizable)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSlConfig(!showSlConfig)}
                      className="text-xs text-yellow-700 dark:text-yellow-300 hover:underline"
                    >
                      {showSlConfig ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {Object.entries(slConfig)
                      .filter(([key]) => !key.startsWith('_')) // Skip metadata fields
                      .map(([key, value]) => {
                        const isBoolean = typeof value === 'boolean';
                        const isNumeric = typeof value === 'number';
                        const isString = typeof value === 'string';

                        return (
                          <div key={key} className="bg-white dark:bg-gray-800 p-3 rounded border border-yellow-200 dark:border-yellow-700">
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </label>
                              <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded font-mono">
                                {String(value)}
                              </span>
                            </div>

                            {isBoolean ? (
                              <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) => handleSlConfigChange(key, e.target.checked)}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                              />
                            ) : isNumeric ? (
                              <input
                                type="number"
                                value={value}
                                onChange={(e) => handleSlConfigChange(key, parseFloat(e.target.value) || 0)}
                                step={Number.isInteger(value) ? 1 : 0.1}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-600 dark:text-white"
                              />
                            ) : isString ? (
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => handleSlConfigChange(key, e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-600 dark:text-white"
                              />
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-3">
                    ✏️ Adjust values as needed. Changes will be saved with the strategy.
                  </p>
                </div>
              )}

              {/* Advanced Parameters (Collapsible) */}
              {formData.pythonStrategy && getSelectedStrategyMetadata()?.metadata?.parameters && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                    className="flex items-center justify-between w-full text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <CogIcon className="w-4 h-4" />
                      Advanced Parameters (Optional - {Object.keys(getSelectedStrategyMetadata().metadata.parameters).length} params)
                    </span>
                    <span className="text-xs text-gray-500">
                      {showAdvancedParams ? '▼ Hide' : '▶ Show'}
                    </span>
                  </button>

                  {showAdvancedParams && (
                    <div className="mt-3 space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-96 overflow-y-auto">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        💡 Default values loaded from core. Adjust only if needed.
                      </p>
                      {Object.entries(getSelectedStrategyMetadata().metadata.parameters)
                        .filter(([key]) => key !== 'timeframe') // Don't show timeframe here
                        .map(([key, defaultValue]) => {
                          const currentValue = formData.pythonConfig[key] !== undefined ? formData.pythonConfig[key] : defaultValue;
                          const isNumeric = typeof defaultValue === 'number';
                          const isString = typeof defaultValue === 'string';

                          return (
                            <div key={key} className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600">
                              <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </label>
                                <span className="text-xs px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded font-mono">
                                  {currentValue}
                                </span>
                              </div>

                              {isNumeric ? (
                                <input
                                  type="number"
                                  value={currentValue}
                                  onChange={(e) => handleConfigChange(key, parseFloat(e.target.value) || 0)}
                                  step={Number.isInteger(defaultValue) ? 1 : 0.1}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-600 dark:text-white"
                                />
                              ) : isString ? (
                                <input
                                  type="text"
                                  value={currentValue}
                                  onChange={(e) => handleConfigChange(key, e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-600 dark:text-white"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={JSON.stringify(currentValue)}
                                  onChange={(e) => {
                                    try {
                                      handleConfigChange(key, JSON.parse(e.target.value));
                                    } catch {
                                      handleConfigChange(key, e.target.value);
                                    }
                                  }}
                                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-600 dark:text-white"
                                />
                              )}
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Default: <code className="text-cyan-600 dark:text-cyan-400">{JSON.stringify(defaultValue)}</code>
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                  Activate strategy for live trading
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowAdvancedParams(false);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.pythonStrategy || !formData.pythonConfig?.timeframe}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!formData.pythonStrategy ? 'Select Strategy' : !formData.pythonConfig?.timeframe ? 'Select Timeframe' : 'Create Strategy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
