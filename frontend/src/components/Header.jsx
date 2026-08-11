import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Shield, Target, Sun, Moon, Menu, X, Home, ChevronDown, Briefcase, BookOpen
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import NotificationBell from './NotificationBell';
import { UserProfileDropdown } from './common';

export default function Header({
  isConnected,
  currentPage,
  marketStatus,
  onNavigateToDashboard,
  onNavigateToStocks,
  onNavigateToTradeSignals,
  onNavigateToTradingBot,
  onNavigateToPortfolios,
  onNavigateToJournal,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToSignup
}) {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isMarketOpen = marketStatus === 'open';

  const handleNavigation = (navFunction) => {
    navFunction();
    setMobileMenuOpen(false); // Close mobile menu after navigation
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <button
            onClick={() => handleNavigation(onNavigateToDashboard)}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity min-w-0"
          >
            <TrendingUp className="w-6 h-6 text-cyan-500 shrink-0" />
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">PSX SmartDesk</h1>
          </button>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => handleNavigation(onNavigateToDashboard)}
                className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${currentPage === 'dashboard'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>

              <button
                onClick={() => handleNavigation(onNavigateToTradeSignals)}
                className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${currentPage === 'trade-signals'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                <Target className="w-4 h-4" />
                <span>Trade Calls</span>
              </button>

              <button
                onClick={() => handleNavigation(onNavigateToPortfolios)}
                className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${currentPage === 'portfolios'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Portfolios</span>
              </button>

              <button
                onClick={() => handleNavigation(onNavigateToJournal)}
                className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${currentPage === 'journal'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Journal</span>
              </button>

              {isAdmin() && (
                <button
                  onClick={() => handleNavigation(onNavigateToAdmin)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${currentPage === 'admin'
                    ? 'bg-cyan-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </button>
              )}
            </nav>
          )}

          {/* Right Section: Market Status + Theme + User/Login */}
          <div className="flex items-center gap-2">
            {/* Market Status - Desktop Only */}
            {user && (
              <div className="hidden lg:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></div>
                <span className={`text-sm font-medium ${isMarketOpen ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {isMarketOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
            )}

            {/* User Section */}
            {user ? (
              <>
                {/* Theme Toggle - Desktop */}
                <button
                  onClick={toggleTheme}
                  className="hidden lg:block p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-700 dark:text-gray-400" />
                  )}
                </button>

                {/* Notification Bell - Desktop */}
                <div className="hidden lg:block">
                  <NotificationBell />
                </div>

                {/* User Dropdown - Desktop */}
                <div className="hidden lg:block">
                  <UserProfileDropdown isConnected={isConnected} />
                </div>

                {/* Mobile: Theme Toggle + Notifications + User Badge + Menu Toggle */}
                <div className="lg:hidden flex items-center gap-2">
                  {/* Theme Toggle */}
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  >
                    {theme === 'dark' ? (
                      <Sun className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <Moon className="w-5 h-5 text-gray-700 dark:text-gray-400" />
                    )}
                  </button>

                  {/* Notification Bell */}
                  <NotificationBell />

                  {/* User Badge + Menu Toggle */}
                  {/* A hamburger, not a chevron beside a username - nobody
                      guesses that their own name is the navigation. */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={mobileMenuOpen}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>

                    <span className="hidden sm:inline text-sm font-medium text-gray-900 dark:text-white max-w-[100px] truncate">
                      {user.username}
                    </span>

                    {mobileMenuOpen ? (
                      <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    ) : (
                      <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    )}
                  </button>
                </div>
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
            {/* Status Badges - Mobile/Tablet */}
            <div className="flex items-center justify-between px-4 pb-4 mb-2 border-b border-gray-200 dark:border-gray-700">
              {/* Market Status */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Market:</span>
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></div>
                  <span className={`text-sm font-medium ${isMarketOpen ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {isMarketOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleNavigation(onNavigateToDashboard)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${currentPage === 'dashboard'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => handleNavigation(onNavigateToTradeSignals)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${currentPage === 'trade-signals'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <Target className="w-5 h-5" />
              <span>Trade Calls</span>
            </button>

            <button
              onClick={() => handleNavigation(onNavigateToPortfolios)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${currentPage === 'portfolios'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <Briefcase className="w-5 h-5" />
              <span>Portfolios</span>
            </button>

            <button
              onClick={() => handleNavigation(onNavigateToJournal)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${currentPage === 'journal'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <BookOpen className="w-5 h-5" />
              <span>Journal</span>
            </button>

            {isAdmin() && (
              <button
                onClick={() => handleNavigation(onNavigateToAdmin)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${currentPage === 'admin'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                <Shield className="w-5 h-5" />
                <span>Admin</span>
              </button>
            )}

            {/* Account Section - Mobile Only */}
            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              {/* Mobile Profile Menu Items */}
              <UserProfileDropdown
                isConnected={isConnected}
                onClose={() => setMobileMenuOpen(false)}
                isMobile={true}
              />
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
