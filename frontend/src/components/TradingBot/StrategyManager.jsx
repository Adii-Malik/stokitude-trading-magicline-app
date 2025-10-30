import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  PlayIcon, 
  PauseIcon,
  ChartBarIcon,
  CogIcon
} from '@heroicons/react/24/outline';

export default function StrategyManager() {
  const [strategies, setStrategies] = useState([]);
  const [availableStrategies, setAvailableStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pythonStrategy: '',
    pythonConfig: {},
    isActive: false
  });

  useEffect(() => {
    fetchStrategies();
    fetchAvailableStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      const response = await fetch('/api/strategies', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
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
      const response = await fetch('/api/strategies/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setAvailableStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error('Error fetching available strategies:', error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/strategies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
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
      toast.error('Failed to create strategy');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/strategies/${selectedStrategy._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Strategy updated successfully');
        setShowEditModal(false);
        fetchStrategies();
        resetForm();
      } else {
        toast.error(data.message || 'Failed to update strategy');
      }
    } catch (error) {
      console.error('Error updating strategy:', error);
      toast.error('Failed to update strategy');
    }
  };

  const handleDelete = async (strategyId) => {
    if (!confirm('Are you sure you want to delete this strategy?')) return;
    
    try {
      const response = await fetch(`/api/strategies/${strategyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Strategy deleted successfully');
        fetchStrategies();
      } else {
        toast.error(data.message || 'Failed to delete strategy');
      }
    } catch (error) {
      console.error('Error deleting strategy:', error);
      toast.error('Failed to delete strategy');
    }
  };

  const handleToggleActive = async (strategyId, isActive) => {
    try {
      const endpoint = isActive ? 'deactivate' : 'activate';
      const response = await fetch(`/api/strategies/${strategyId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Strategy ${isActive ? 'deactivated' : 'activated'} successfully`);
        fetchStrategies();
      } else {
        toast.error(data.message || 'Failed to update strategy');
      }
    } catch (error) {
      console.error('Error toggling strategy:', error);
      toast.error('Failed to update strategy');
    }
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (strategy) => {
    setSelectedStrategy(strategy);
    setFormData({
      name: strategy.name,
      description: strategy.description || '',
      pythonStrategy: strategy.pythonStrategy,
      pythonConfig: strategy.pythonConfig,
      isActive: strategy.isActive
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      pythonStrategy: '',
      pythonConfig: {},
      isActive: false
    });
    setSelectedStrategy(null);
  };

  const handleStrategySelect = (strategyName) => {
    const selected = availableStrategies.find(s => s.name === strategyName);
    if (selected) {
      const defaultConfig = {};
      if (selected.metadata?.parameters) {
        Object.entries(selected.metadata.parameters).forEach(([key, param]) => {
          defaultConfig[key] = param.default;
        });
      }
      setFormData(prev => ({
        ...prev,
        pythonStrategy: strategyName,
        pythonConfig: defaultConfig
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

  const getSelectedStrategyMetadata = () => {
    return availableStrategies.find(s => s.name === formData.pythonStrategy);
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
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  strategy.isActive 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {strategy.isActive ? 'Active' : 'Inactive'}
                </span>
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
                    <p className={`text-sm font-semibold ${
                      strategy.performance.totalReturn > 0 
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
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    strategy.isActive
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
                  onClick={() => openEditModal(strategy)}
                  className="p-2 text-gray-600 hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors"
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(strategy._id)}
                  className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                >
                  <TrashIcon className="w-5 h-5" />
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
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Strategy Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Base Strategy
                </label>
                <select
                  value={formData.pythonStrategy}
                  onChange={(e) => handleStrategySelect(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Select a strategy...</option>
                  {availableStrategies.map((strategy) => (
                    <option key={strategy.name} value={strategy.name}>
                      {strategy.name} - {strategy.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Strategy Parameters */}
              {formData.pythonStrategy && getSelectedStrategyMetadata()?.metadata?.parameters && (
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <CogIcon className="w-5 h-5" />
                    Strategy Parameters
                  </h4>
                  {Object.entries(getSelectedStrategyMetadata().metadata.parameters).map(([key, param]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      <input
                        type={param.type === 'integer' ? 'number' : 'text'}
                        value={formData.pythonConfig[key] || param.default}
                        onChange={(e) => handleConfigChange(key, param.type === 'integer' ? parseInt(e.target.value) : e.target.value)}
                        min={param.min}
                        max={param.max}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-600 dark:text-white"
                      />
                      {param.min !== undefined && param.max !== undefined && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Range: {param.min} - {param.max}
                        </p>
                      )}
                    </div>
                  ))}
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
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  Create Strategy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal (similar structure to Create Modal) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Edit Strategy
              </h3>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Strategy Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  rows="3"
                />
              </div>

              {/* Strategy Parameters */}
              {formData.pythonStrategy && getSelectedStrategyMetadata()?.metadata?.parameters && (
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <CogIcon className="w-5 h-5" />
                    Strategy Parameters
                  </h4>
                  {Object.entries(getSelectedStrategyMetadata().metadata.parameters).map(([key, param]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      <input
                        type={param.type === 'integer' ? 'number' : 'text'}
                        value={formData.pythonConfig[key] || param.default}
                        onChange={(e) => handleConfigChange(key, param.type === 'integer' ? parseInt(e.target.value) : e.target.value)}
                        min={param.min}
                        max={param.max}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-600 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveEdit"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                />
                <label htmlFor="isActiveEdit" className="text-sm text-gray-700 dark:text-gray-300">
                  Activate strategy for live trading
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  Update Strategy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
