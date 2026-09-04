import { useState, useRef, useEffect } from 'react';
import {
  TrendingUp, Shield, Sun, Moon, Menu, X, Home, Briefcase, BookOpen, LayoutGrid,
  Bookmark, Compass, ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import NotificationBell from './NotificationBell';
import MarketSwitch from './MarketSwitch';
import { useWatchlist } from '../contexts/WatchlistContext';
import { UserProfileDropdown } from './common';

export default function Header({
  currentPage,
  onNavigateToDashboard,
  onNavigateToStocks,
  onNavigateToTradingBot,
  onNavigateToPortfolios,
  onNavigateToJournal,
  onNavigateToHeatmap,
  onNavigateToWatchlist,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToSignup
}) {
  const { user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const research = useRef(null);
  const { counts } = useWatchlist();

  /**
   * Finding and tracking are one job, so they share one menu - and the header
   * stops growing, which matters at 390px where it already had no room to spare.
   *
   * "Research" names the work; "Ideas" named a thing, and nobody could say
   * which thing from the nav bar. Both children are the same job done twice
   * over - the heatmap is where a name is found, the shortlist is the ones you
   * kept - and that job is research. It stays first after Home because the nav
   * runs in the order the work happens: look before you buy.
   */
  const inResearch = currentPage === 'heatmap' || currentPage === 'watchlist';

  useEffect(() => {
    const away = (e) => { if (research.current && !research.current.contains(e.target)) setResearchOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const handleNavigation = (navFunction) => {
    navFunction();
    setMobileMenuOpen(false); // Close mobile menu after navigation
    setResearchOpen(false);
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/*
            The mark, and on a phone it is the whole brand.

            It was a bare cyan arrow on a dark bar: nothing said it was the way
            home, nothing said it was a control at all, and the 24px glyph was
            most of the tap target. A stray icon is not a logo.

            So the glyph sits in a solid tile - a lockup that reads as a mark
            rather than a leftover - with a real hit area and a hover state
            behind it. The wordmark still stands down below sm, because with two
            markets to switch between the bar wants the mark, the switch, the
            theme, the bell and the menu inside 358px, and "Financ..." is worse
            than no words at all.
          */}
          <button
            onClick={() => handleNavigation(onNavigateToDashboard)}
            aria-label="Financial Reading — go to Home"
            className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-1.5 transition hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-500 text-white shadow-sm">
              <TrendingUp className="h-5 w-5" />
            </span>
            <h1 className="hidden truncate text-base font-bold text-gray-900 dark:text-white sm:block sm:text-lg">
              Financial Reading
            </h1>
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

              {/* No count on the group. A bare red number says something is
                  wrong without saying what, and following it led to a screen
                  that did not point at the name it meant - so it was a nag with
                  no answer behind it. The line inside the menu says the same
                  thing in words, next to the place it is about. */}
              <div className="relative" ref={research}>
                <button
                  onClick={() => setResearchOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={researchOpen}
                  className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${inResearch
                    ? 'bg-cyan-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>Research</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${researchOpen ? 'rotate-180' : ''}`} />
                </button>

                {researchOpen && (
                  <div role="menu"
                    className="absolute left-0 z-30 mt-1 w-60 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
                    <button role="menuitem" onClick={() => handleNavigation(onNavigateToHeatmap)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'heatmap' ? 'font-semibold text-cyan-600 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      <LayoutGrid className="w-4 h-4 shrink-0" />
                      <span className="flex-1">Heatmap</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">what is moving</span>
                    </button>
                    <button role="menuitem" onClick={() => handleNavigation(onNavigateToWatchlist)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'watchlist' ? 'font-semibold text-cyan-600 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      <Bookmark className="w-4 h-4 shrink-0" />
                      <span className="flex-1">Shortlist</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {counts.due ? `${counts.due} to look at` : 'all caught up'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

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

          {/* Right Section: Market + Theme + User/Login */}
          <div className="flex shrink-0 items-center gap-2">
            {/* User Section */}
            {user ? (
              <>
                {/* Which market the whole app is scoped to. Hides itself when
                    there is only one to be in. */}
                <MarketSwitch className="hidden lg:block" />

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
                  <UserProfileDropdown />
                </div>

                {/* Mobile: Theme Toggle + Notifications + User Badge + Menu Toggle */}
                <div className="lg:hidden flex items-center gap-1">
                  <MarketSwitch />
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

                  {/* Menu Toggle */}
                  {/* A hamburger, not a chevron beside a username - nobody
                      guesses that their own name is the navigation. */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={mobileMenuOpen}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
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
              onClick={() => handleNavigation(onNavigateToHeatmap)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${currentPage === 'heatmap'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <LayoutGrid className="w-5 h-5" />
              <span>Heatmap</span>
            </button>

            <button
              onClick={() => handleNavigation(onNavigateToWatchlist)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${currentPage === 'watchlist'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <Bookmark className="w-5 h-5" />
              <span className="flex-1 text-left">Shortlist</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {counts.due ? `${counts.due} to look at` : 'all caught up'}
              </span>
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
