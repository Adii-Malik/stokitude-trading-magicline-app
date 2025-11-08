import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  PlayIcon, 
  ClockIcon,
  ChartBarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import BacktestChart from './BacktestChart';
import EquityCurveChart from './EquityCurveChart';
import PerformanceMetricsCard from './PerformanceMetricsCard';
import TradeListTable from './TradeListTable';
import * as strategyService from '../../services/strategies';
import * as backtestService from '../../services/backtest';
import * as stockService from '../../services/stocks';

export default function BacktestRunner() {
  const [strategies, setStrategies] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showResults, setShowResults] = useState(false);
  
  const [formData, setFormData] = useState({
    strategyId: '',
    symbol: '',
    startDate: '',
    endDate: '',
    initialCapital: 100000,
    positionSizing: 'percentage',
    positionSizeValue: 50,
    commission: 0.15,
    slippage: 0.1
  });

  useEffect(() => {
    fetchStrategies();
    fetchStocks();
    fetchBacktestHistory();
  }, []);

  const fetchStrategies = async () => {
    try {
      const data = await strategyService.getStrategies();
      if (data.success) {
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error('Error fetching strategies:', error);
    }
  };

  const fetchStocks = async () => {
    try {
      const data = await stockService.getStocks();
      if (data.success) {
        setStocks(data.stocks || []);
      }
    } catch (error) {
      console.error('Error fetching stocks:', error);
    }
  };

  const fetchBacktestHistory = async () => {
    try {
      const data = await backtestService.getBacktestHistory();
      if (data.success) {
        setBacktestResults(data.backtests || []);
      }
    } catch (error) {
      console.error('Error fetching backtest history:', error);
    }
  };

  const handleRunBacktest = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await backtestService.runBacktest(formData);
      
      if (data.success) {
        toast.success('Backtest started successfully');
        
        // Poll for results
        const backtestId = data.backtestId;
        pollBacktestStatus(backtestId);
      } else {
        toast.error(data.message || 'Failed to start backtest');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error running backtest:', error);
      toast.error(error.response?.data?.message || 'Failed to run backtest');
      setLoading(false);
    }
  };

  const pollBacktestStatus = async (backtestId) => {
    const maxAttempts = 60; // 2 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const data = await backtestService.getBacktestById(backtestId);

        if (data.success && data.backtest) {
          if (data.backtest.status === 'completed') {
            setSelectedResult(data.backtest);
            setShowResults(true);
            setLoading(false);
            toast.success('Backtest completed!');
            fetchBacktestHistory();
            return;
          } else if (data.backtest.status === 'failed') {
            toast.error('Backtest failed: ' + (data.backtest.error || 'Unknown error'));
            setLoading(false);
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else {
          toast.error('Backtest timeout - please check history later');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error polling backtest status:', error);
        setLoading(false);
      }
    };

    poll();
  };

  const viewBacktestResult = (backtest) => {
    setSelectedResult(backtest);
    setShowResults(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (showResults && selectedResult) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Backtest Results
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {selectedResult.symbol} - {formatDate(selectedResult.dateRange.from)} to {formatDate(selectedResult.dateRange.to)}
            </p>
          </div>
          <button
            onClick={() => setShowResults(false)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Back to Backtest
          </button>
        </div>

        {/* Performance Metrics */}
        <PerformanceMetricsCard performance={selectedResult.performance} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BacktestChart 
            trades={selectedResult.trades}
            symbol={selectedResult.symbol}
          />
          <EquityCurveChart 
            trades={selectedResult.trades}
            initialCapital={selectedResult.config.initial_capital}
          />
        </div>

        {/* Trade List */}
        <TradeListTable trades={selectedResult.trades} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Backtest Runner</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Test your strategies on historical data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Form */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5" />
              Configuration
            </h3>
            
            <form onSubmit={handleRunBacktest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Strategy
                </label>
                <select
                  value={formData.strategyId}
                  onChange={(e) => setFormData(prev => ({ ...prev, strategyId: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Select strategy...</option>
                  {strategies.map((strategy) => (
                    <option key={strategy._id} value={strategy._id}>
                      {strategy.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Symbol
                </label>
                <select
                  value={formData.symbol}
                  onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Select symbol...</option>
                  {stocks.map((stock) => (
                    <option key={stock._id} value={stock.symbol}>
                      {stock.symbol} - {stock.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Initial Capital (PKR)
                </label>
                <input
                  type="number"
                  value={formData.initialCapital}
                  onChange={(e) => setFormData(prev => ({ ...prev, initialCapital: parseFloat(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  min="1000"
                  step="1000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Position Size (%)
                </label>
                <input
                  type="number"
                  value={formData.positionSizeValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, positionSizeValue: parseFloat(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  min="1"
                  max="100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Commission (%)
                </label>
                <input
                  type="number"
                  value={formData.commission}
                  onChange={(e) => setFormData(prev => ({ ...prev, commission: parseFloat(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                  min="0"
                  max="5"
                  step="0.01"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Running Backtest...
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-5 h-5" />
                    Run Backtest
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Backtest History */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5" />
              Backtest History
            </h3>

            {backtestResults.length === 0 ? (
              <div className="text-center py-12">
                <DocumentTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No backtest history yet. Run your first backtest to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {backtestResults.map((backtest) => (
                  <div
                    key={backtest._id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors cursor-pointer"
                    onClick={() => viewBacktestResult(backtest)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {backtest.symbol}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(backtest.dateRange.from)} - {formatDate(backtest.dateRange.to)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        backtest.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : backtest.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {backtest.status}
                      </span>
                    </div>

                    {backtest.performance && (
                      <div className="grid grid-cols-4 gap-3 mt-3">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Return</p>
                          <p className={`text-sm font-semibold ${
                            backtest.performance.total_return_percent > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {backtest.performance.total_return_percent?.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Win Rate</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {backtest.performance.win_rate?.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Trades</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {backtest.performance.total_trades}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Sharpe</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {backtest.performance.sharpe_ratio?.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
