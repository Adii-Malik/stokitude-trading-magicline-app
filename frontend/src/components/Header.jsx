import { useState, useEffect, useRef } from 'react';
import { TrendingUp, LogOut, User, Shield, Settings, BarChart3, Target, Sun, Moon, Database, Menu, X, ChevronDown, UserCircle, Lock, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Header({ 
  isConnected, 
  currentPage,
  lastPriceUpdate,
  marketStatus,
  onNavigateToDashboard,
  onNavigateToMagicLine,
  onNavigateToStocks,
  onNavigateToTradeSignals,
  onNavigateToAdmin,
  onNavigateToSettings, 
  onNavigateToLogin, 
  onNavigateToSignup 
}) {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    };

    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userDropdownOpen]);

  // Format time for status display
  const formatTime = (timestamp) => {
    if (!timestamp) return 'No data yet';
    const now = new Date();
    const diff = Math.floor((now - new Date(timestamp)) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const isMarketOpen = marketStatus === 'open';

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };
  
  const handleNavigation = (navFunction) => {
    navFunction();
    setMobileMenuOpen(false); // Close mobile menu after navigation
    setUserDropdownOpen(false); // Close user dropdown after navigation
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <button 
            onClick={() => handleNavigation(onNavigateToDashboard)}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <TrendingUp className="w-6 h-6 text-cyan-500" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">PSX SmartDesk</h1>
          </button>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => handleNavigation(onNavigateToDashboard)}
                className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
                  currentPage === 'dashboard'
                    ? 'bg-cyan-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>

              <button
                onClick={() => handleNavigation(onNavigateToMagicLine)}
                className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
                  currentPage === 'magic-line'
                    ? 'bg-cyan-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Magic Line</span>
              </button>

              <button
                onClick={() => handleNavigation(onNavigateToTradeSignals)}
                className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
                  currentPage === 'trade-signals'
                    ? 'bg-cyan-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>Trade Calls</span>
              </button>

              {isAdmin() && (
                <>
          <button 
                    onClick={() => handleNavigation(onNavigateToStocks)}
                    className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
                      currentPage === 'stocks'
                        ? 'bg-cyan-500 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Database className="w-4 h-4" />
                    <span>Stocks</span>
          </button>

                  <button
                    onClick={() => handleNavigation(onNavigateToAdmin)}
                    className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
                      currentPage === 'admin'
                        ? 'bg-cyan-500 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Users</span>
                  </button>
                </>
              )}
            </nav>
          )}

          {/* Right Section: Market Status + Price Update + Theme + User/Login */}
          <div className="flex items-center gap-2">
            {/* Market Status - Same style as user badge */}
            {user && (
              <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></div>
                <span className={`text-sm font-medium ${isMarketOpen ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {isMarketOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            )}

            {/* Price Update Status - Same style as user badge */}
            {user && (
              <div className="hidden lg:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg" title={`Stock prices last updated: ${formatTime(lastPriceUpdate)}`}>
                <TrendingUp className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatTime(lastPriceUpdate)}
                </span>
              </div>
            )}

            {/* User Section */}
            {user ? (
              <>
                {/* Theme Toggle - Desktop */}
                <button
                  onClick={toggleTheme}
                  className="hidden sm:block p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-700 dark:text-gray-400" />
                  )}
                </button>

                {/* User Dropdown - Desktop */}
                <div className="hidden sm:block relative" ref={dropdownRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    title={isConnected ? 'Connected to server' : 'Disconnected from server'}
                  >
                    {/* Connection Status Indicator */}
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    {/* Divider */}
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {userDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* User Info Header */}
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          {user.role === 'super_admin' ? (
                            <Shield className="w-4 h-4 text-yellow-500" />
                          ) : user.role === 'admin' ? (
                            <Shield className="w-4 h-4 text-cyan-500" />
                          ) : (
                            <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          )}
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.username}</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-1">
                          {user.role === 'super_admin' ? 'Super Admin' : user.role}
                        </p>
                      </div>

                      {/* Menu Items */}
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          // TODO: Navigate to profile page
                          console.log('Navigate to Profile');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        <UserCircle className="w-4 h-4" />
                        <span>My Profile</span>
                      </button>

                      {/* Settings - Admin Only */}
                      {isAdmin() && (
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            setMobileMenuOpen(false);
                            onNavigateToSettings?.();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          // TODO: Navigate to change password page
                          console.log('Navigate to Change Password');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Change Password</span>
                      </button>

                      {/* Divider */}
                      <div className="my-1 border-t border-gray-200 dark:border-gray-700"></div>

                      {/* Logout */}
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile: Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="sm:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-700" />
                  )}
                </button>
                
                {/* Mobile: Logout Button */}
                <button
                  onClick={handleLogout}
                  className="sm:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>

                {/* Mobile Menu Toggle */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  {mobileMenuOpen ? (
                    <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                  ) : (
                    <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {/* Theme Toggle for non-logged-in users */}
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-700" />
                  )}
                </button>
                
                <button
                  onClick={onNavigateToLogin}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium"
                >
                  Login
                </button>
                <button
                  onClick={onNavigateToSignup}
                  className="px-3 py-1.5 text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition font-medium"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {user && mobileMenuOpen && (
          <nav className="lg:hidden mt-4 py-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {/* Status Badges - Mobile */}
            <div className="flex items-center justify-center gap-3 px-4 pb-4 mb-2 border-b border-gray-200 dark:border-gray-700">
              {/* Market Status */}
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></div>
                <span className={`text-sm font-medium ${isMarketOpen ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {isMarketOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>

              {/* Price Update */}
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg" title={`Stock prices last updated: ${formatTime(lastPriceUpdate)}`}>
                <TrendingUp className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatTime(lastPriceUpdate)}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleNavigation(onNavigateToDashboard)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                currentPage === 'dashboard'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => handleNavigation(onNavigateToMagicLine)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                currentPage === 'magic-line'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Magic Line</span>
            </button>

            <button
              onClick={() => handleNavigation(onNavigateToTradeSignals)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                currentPage === 'trade-signals'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Target className="w-5 h-5" />
              <span>Trade Calls</span>
            </button>

            {isAdmin() && (
              <>
                <button
                  onClick={() => handleNavigation(onNavigateToStocks)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                    currentPage === 'stocks'
                      ? 'bg-cyan-500 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Database className="w-5 h-5" />
                  <span>Stocks</span>
                </button>

                <button
                  onClick={() => handleNavigation(onNavigateToAdmin)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                    currentPage === 'admin'
                      ? 'bg-cyan-500 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Users</span>
                </button>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
