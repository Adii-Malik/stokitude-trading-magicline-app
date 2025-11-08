import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import socketService from '../../services/socket';
import { 
  BellIcon, 
  FunnelIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import SignalChart from './SignalChart';
import * as signalService from '../../services/signals';

export default function SignalDashboard() {
  const [signals, setSignals] = useState([]);
  const [filteredSignals, setFilteredSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    symbol: '',
    signalType: '',
    strategyId: '',
    isExecuted: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchSignals();
    
    // Listen for new signals via WebSocket
    socketService.on('new-signal', handleNewSignal);
    
    return () => {
      socketService.off('new-signal', handleNewSignal);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [signals, filters]);

  const fetchSignals = async () => {
    try {
      const data = await signalService.getSignals();
      if (data.success) {
        setSignals(data.signals || []);
      }
    } catch (error) {
      console.error('Error fetching signals:', error);
      toast.error('Failed to load signals');
    } finally {
      setLoading(false);
    }
  };

  const handleNewSignal = (signal) => {
    setSignals(prev => [signal, ...prev]);
    toast.success(`New ${signal.signalType} signal for ${signal.symbol}!`, {
      icon: '🔔',
      duration: 5000
    });
  };

  const applyFilters = () => {
    let filtered = [...signals];

    if (filters.symbol) {
      filtered = filtered.filter(s => 
        s.symbol.toLowerCase().includes(filters.symbol.toLowerCase())
      );
    }

    if (filters.signalType) {
      filtered = filtered.filter(s => s.signalType === filters.signalType);
    }

    if (filters.strategyId) {
      filtered = filtered.filter(s => s.strategyId === filters.strategyId);
    }

    if (filters.isExecuted !== '') {
      const isExecuted = filters.isExecuted === 'true';
      filtered = filtered.filter(s => s.isExecuted === isExecuted);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(s => 
        new Date(s.date) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(s => 
        new Date(s.date) <= new Date(filters.dateTo)
      );
    }

    setFilteredSignals(filtered);
  };

  const handleMarkExecuted = async (signalId, executedPrice) => {
    try {
      const data = await signalService.markSignalExecuted(signalId, executedPrice);
      if (data.success) {
        toast.success('Signal marked as executed');
        fetchSignals();
      } else {
        toast.error(data.message || 'Failed to update signal');
      }
    } catch (error) {
      console.error('Error marking signal as executed:', error);
      toast.error(error.response?.data?.message || 'Failed to update signal');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price) => {
    return price?.toFixed(2) || 'N/A';
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SparklesIcon className="w-8 h-8 text-cyan-600" />
            Signal Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time trading signals from your active strategies
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <FunnelIcon className="w-5 h-5" />
          Filters
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Filter Signals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Symbol
              </label>
              <input
                type="text"
                value={filters.symbol}
                onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value }))}
                placeholder="e.g., OGDC"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Signal Type
              </label>
              <select
                value={filters.signalType}
                onChange={(e) => setFilters(prev => ({ ...prev, signalType: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Types</option>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filters.isExecuted}
                onChange={(e) => setFilters(prev => ({ ...prev, isExecuted: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Status</option>
                <option value="false">Pending</option>
                <option value="true">Executed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  symbol: '',
                  signalType: '',
                  strategyId: '',
                  isExecuted: '',
                  dateFrom: '',
                  dateTo: ''
                })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Signals</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {filteredSignals.length}
              </p>
            </div>
            <BellIcon className="w-10 h-10 text-cyan-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Buy Signals</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {filteredSignals.filter(s => s.signalType === 'BUY').length}
              </p>
            </div>
            <ArrowTrendingUpIcon className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Sell Signals</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {filteredSignals.filter(s => s.signalType === 'SELL').length}
              </p>
            </div>
            <ArrowTrendingDownIcon className="w-10 h-10 text-red-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Executed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {filteredSignals.filter(s => s.isExecuted).length}
              </p>
            </div>
            <CheckCircleIcon className="w-10 h-10 text-cyan-600" />
          </div>
        </div>
      </div>

      {/* Signals List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Signals
            </h3>

            {filteredSignals.length === 0 ? (
              <div className="text-center py-12">
                <BellIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No signals found. Activate strategies to start receiving signals.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredSignals.map((signal) => (
                  <div
                    key={signal._id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedSignal?._id === signal._id
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-700'
                    }`}
                    onClick={() => setSelectedSignal(signal)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          signal.signalType === 'BUY'
                            ? 'bg-green-100 dark:bg-green-900'
                            : 'bg-red-100 dark:bg-red-900'
                        }`}>
                          {signal.signalType === 'BUY' ? (
                            <ArrowTrendingUpIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowTrendingDownIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {signal.symbol}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {signal.strategyName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          PKR {formatPrice(signal.price)}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {formatDate(signal.date)}
                        </p>
                      </div>
                    </div>

                    {signal.reasoning && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {signal.reasoning}
                      </p>
                    )}

                    {signal.indicators && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {Object.entries(signal.indicators).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300"
                          >
                            {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                          </span>
                        ))}
                      </div>
                    )}

                    {!signal.isExecuted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const executedPrice = prompt('Enter executed price:', signal.price);
                          if (executedPrice) {
                            handleMarkExecuted(signal._id, parseFloat(executedPrice));
                          }
                        }}
                        className="w-full mt-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
                      >
                        Mark as Executed
                      </button>
                    )}

                    {signal.isExecuted && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircleIcon className="w-4 h-4" />
                        Executed at PKR {formatPrice(signal.executedPrice)} on {formatDate(signal.executedAt)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Signal Chart */}
        <div className="lg:col-span-1">
          {selectedSignal ? (
            <SignalChart signal={selectedSignal} />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 h-full flex items-center justify-center">
              <div className="text-center">
                <BellIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Select a signal to view details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
