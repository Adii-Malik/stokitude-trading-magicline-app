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

  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, recentRes] = await Promise.all([
        api.get('/journal/stats'),
        api.get('/journal', { params: { status: 'closed', sort: 'recent', limit: 5 } })
      ]);

      setStats(statsRes.data.data);
      setRecent(recentRes.data.data || []);
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  // One market, so these are simply the figures. This used to sum counts across
  // currencies and keep money out entirely, because adding PKR to USD is not a
  // number - a problem that stopped existing when the app began being scoped to
  // one market at a time.
  const totals = {
    wins: stats?.wins || 0,
    losses: stats?.losses || 0,
    closed: stats?.closedTrades || 0,
    open: stats?.openTrades || 0
  };

  // Over trades that finished, not over everything ever recorded. The old
  // version divided by total plans, which quietly understated the rate.
  const winRate = totals.closed > 0
    ? ((totals.wins / totals.closed) * 100).toFixed(1)
    : 0;

  // Read off the entries, never typed. Null rather than zero when there is
  // nothing closed, so the line can be left out instead of claiming 0%.
  const stopSet = stats?.process?.stopSet;
  const stopRate = stopSet?.of > 0 ? Math.round((stopSet.n / stopSet.of) * 100) : null;

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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
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
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.open}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Open Trades</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {stats?.openWithoutStop
                ? `${stats.openWithoutStop} with no stop set`
                : totals.open ? 'all with a stop set' : 'nothing running'}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totals.wins}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Wins</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {winRate}% of {totals.closed} closed
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totals.losses}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Losses</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {stopRate == null ? 'no closed trades yet' : `${stopRate}% had a stop set`}
            </div>
          </div>
        </div>

        {/* Main Sections */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Journal */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Journal
                </h2>
                <button
                  onClick={() => navigate('/journal')}
                  className="text-purple-500 hover:text-purple-600 text-sm font-medium flex items-center gap-1"
                >
                  View All
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {stats && (
              <div className="p-6">
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Open</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{totals.open}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Closed</span>
                    <span className="text-lg font-bold text-gray-600 dark:text-gray-300">{totals.closed}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Win Rate</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{winRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${winRate}%` }}
                    ></div>
                  </div>
                  {/* Outcome and process are separate questions, so both are
                      shown. This one is read off the entries rather than from
                      anything the trader typed, so it cannot be true by default. */}
                  {stopRate != null && (
                    <div className="flex justify-between text-sm mt-3">
                      <span className="text-gray-600 dark:text-gray-400">Had a stop set</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{stopRate}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Recent Trade Outcomes */}
          {recent.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-500" />
                  Recent Trade Outcomes
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {recent.map((trade) => (
                    <div
                      key={trade._id}
                      className={`flex items-center justify-between p-3 rounded-lg ${trade.outcome === 'win'
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : trade.outcome === 'loss'
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-gray-50 dark:bg-gray-900/50'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        {trade.outcome === 'win' ? (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : trade.outcome === 'loss' ? (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{trade.symbol}</p>
                          {/* The lesson if there is one - it is the reason the entry exists. */}
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {trade.lesson || trade.exitReason || '—'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {trade.exitDate ? new Date(trade.exitDate).toLocaleDateString() : '—'}
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
              <h3 className="text-xl font-bold mb-2">Financial Reading Analytics</h3>
              <p className="text-cyan-100">
                Levels you are watching are checked against live prices on every poll, and
                you are told when one is reached. Outcome and process are tracked apart:
                a loss that followed the plan is not a mistake, and a win that broke it is luck.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
