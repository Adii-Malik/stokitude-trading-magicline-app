import { TrendingUp, LogOut, User, Shield, Settings, BarChart3, Target, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Header({ 
  stats, 
  isConnected, 
  currentPage,
  onNavigateToDashboard, 
  onNavigateToTradeSignals,
  onNavigateToAdmin, 
  onNavigateToLogin, 
  onNavigateToSignup 
}) {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <header className="bg-white dark:bg-gradient-to-r dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg sticky top-0 z-50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Logo/Brand */}
          <button 
            onClick={onNavigateToDashboard}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity group"
          >
            <TrendingUp className="w-7 h-7 text-cyan-500 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">PSX SmartDesk</h1>
              <p className="text-gray-600 dark:text-gray-400 text-xs hidden md:block">Real-time Monitoring</p>
            </div>
          </button>

          {/* Main Navigation */}
          {user && (
            <nav className="hidden lg:flex items-center gap-2">
              <button
                onClick={onNavigateToDashboard}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  currentPage === 'dashboard'
                    ? 'bg-cyan-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Target className="w-4 h-4" />
                Magic Line
              </button>
              
              {/* Trade Signals - Hidden until feature is implemented */}
              {/* {onNavigateToTradeSignals && (
                <button
                  onClick={onNavigateToTradeSignals}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                    currentPage === 'trade-signals'
                      ? 'bg-cyan-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Trade Signals
                </button>
              )} */}
            </nav>
          )}

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="hidden md:flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-white">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-all duration-200"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>

            {/* Stats - Only show on Dashboard (Magic Line feature) */}
            {stats && currentPage === 'dashboard' && (
              <div className="hidden lg:flex items-center gap-6 bg-gray-100 dark:bg-white/10 backdrop-blur px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalSymbols}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.metThreshold}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Met</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.belowThreshold}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Below</div>
                </div>
              </div>
            )}

            {/* Admin Panel Button (Admins Only) */}
            {isAdmin() && (
              <button
                onClick={onNavigateToAdmin}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                  currentPage === 'admin'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800/50 hover:bg-purple-100 dark:hover:bg-purple-600/90 text-gray-700 dark:text-gray-300 hover:text-purple-700 dark:hover:text-white border border-gray-300 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500'
                }`}
                title="Admin Panel"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden md:inline">Admin</span>
              </button>
            )}

            {/* User Info & Logout OR Login/Signup Buttons */}
            {user ? (
              <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800/70 backdrop-blur border border-gray-300 dark:border-gray-700 px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  {user.role === 'super_admin' ? (
                    <Shield className="w-4 h-4 text-yellow-500" />
                  ) : user.role === 'admin' ? (
                    <Shield className="w-4 h-4 text-purple-500" />
                  ) : (
                    <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900 dark:text-white">{user.username}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                      {user.role === 'super_admin' ? 'Super Admin' : user.role}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onNavigateToLogin}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg transition font-medium"
                >
                  Login
                </button>
                <button
                  onClick={onNavigateToSignup}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition font-medium shadow-lg"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

