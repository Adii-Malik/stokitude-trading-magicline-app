import { BarChart3, Target, TrendingUp, Users, Settings, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const quickLinks = [
    {
      title: 'Strategic Levels',
      description: 'Monitor stocks against strategic price levels',
      icon: <BarChart3 className="w-12 h-12" />,
      path: '/magic-line',
      color: 'from-cyan-500 to-blue-500',
      available: true
    },
    {
      title: 'Trade Signals',
      description: 'Manage trade plans with entry and exit levels',
      icon: <Target className="w-12 h-12" />,
      path: '/trade-signals',
      color: 'from-purple-500 to-pink-500',
      available: true
    },
    {
      title: 'Stock Management',
      description: 'View and manage all stocks in the system',
      icon: <TrendingUp className="w-12 h-12" />,
      path: '/stocks',
      color: 'from-green-500 to-emerald-500',
      available: isAdmin(),
      adminOnly: true
    },
    {
      title: 'User Management',
      description: 'Manage users and their permissions',
      icon: <Users className="w-12 h-12" />,
      path: '/admin',
      color: 'from-orange-500 to-red-500',
      available: isAdmin(),
      adminOnly: true
    },
    {
      title: 'Settings',
      description: 'Configure system settings and preferences',
      icon: <Settings className="w-12 h-12" />,
      path: '/settings',
      color: 'from-gray-500 to-slate-500',
      available: isAdmin(),
      adminOnly: true
    }
  ];

  const availableLinks = quickLinks.filter(link => link.available);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300 py-12">
      <div className="container mx-auto px-4">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl mb-6 shadow-xl">
            <Activity className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Your PSX SmartDesk command center. Monitor strategic levels, manage trade plans, and stay ahead of the market.
          </p>
        </div>

        {/* Quick Access Cards */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Quick Access</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableLinks.map((link, index) => (
              <button
                key={index}
                onClick={() => navigate(link.path)}
                className="group relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>

                {/* Content */}
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${link.color} rounded-xl mb-4 text-white shadow-lg`}>
                    {link.icon}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {link.title}
                  </h3>

                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {link.description}
                  </p>

                  {link.adminOnly && (
                    <div className="mt-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400">
                        Admin Only
                      </span>
                    </div>
                  )}
                </div>

                {/* Arrow Icon */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                  <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div className="max-w-6xl mx-auto mt-12">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl shadow-xl p-8 text-white">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">PSX SmartDesk</h3>
                <p className="text-cyan-100">
                  Your intelligent trading companion for the Pakistan Stock Exchange.
                  Make data-driven decisions with real-time price monitoring, strategic level analysis, and comprehensive trade planning.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
