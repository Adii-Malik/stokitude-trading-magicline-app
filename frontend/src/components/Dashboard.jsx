import { useState, useEffect } from 'react';
import {
  Target, TrendingUp, Activity, CheckCircle, XCircle, Clock, Award, ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tradePlanStats, setTradePlanStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const tpResponse = await api.get('/trade-plans/stats/summary');

      setTradePlanStats(tpResponse.data.data);

    } catch (err) {
      console.error('Error loading dashboard stats:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  // Calculate key metrics
  const tradeWinRate = tradePlanStats && tradePlanStats.totalPlans > 0
    ? ((tradePlanStats.tpHits / tradePlanStats.totalPlans) * 100).toFixed(1)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <button
              onClick={() => loadDashboardStats()}
              disabled={loading}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome back, <span className="font-semibold">{user?.username}</span>! Here's your trading overview.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{tradePlanStats?.activePlans || 0}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Active Plans</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              of {tradePlanStats?.totalPlans || 0} total
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{tradePlanStats?.successfulPlans || 0}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Successful Plans</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {tradePlanStats?.tpHits || 0} targets • {tradeWinRate}% win rate
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{tradePlanStats?.slHit || 0}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Stop Loss</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {tradePlanStats?.closedPlans || 0} plans closed
            </div>
          </div>
        </div>

        {/* Main Sections */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Trade Plans */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Trade Plans
                </h2>
                <button
                  onClick={() => navigate('/trade-signals')}
                  className="text-purple-500 hover:text-purple-600 text-sm font-medium flex items-center gap-1"
                >
                  View All
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {tradePlanStats && (
              <div className="p-6">
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{tradePlanStats.activePlans || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Targets Hit</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">{tradePlanStats.tpHits || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stop Loss</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400">{tradePlanStats.slHit || 0}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Win Rate</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{tradeWinRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${tradeWinRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Recent Trade Outcomes */}
          {tradePlanStats?.recentClosed && tradePlanStats.recentClosed.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-500" />
                  Recent Trade Outcomes
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {tradePlanStats.recentClosed.map((trade, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${trade.outcome === 'target'
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : trade.outcome === 'stop_loss'
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-gray-50 dark:bg-gray-900/50'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        {trade.outcome === 'target' ? (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : trade.outcome === 'stop_loss' ? (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{trade.symbol}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {trade.outcome === 'target' ? 'Target Hit ✓' : trade.outcome === 'stop_loss' ? 'Stop Loss Hit' : 'Manually Closed'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(trade.exitDate).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">PSX SmartDesk Analytics</h3>
              <p className="text-cyan-100">
                Track your trading performance with real-time KPIs. Analyze trade plan success rates
                and make data-driven decisions with comprehensive insights. Historical data shows your complete trading journey!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
