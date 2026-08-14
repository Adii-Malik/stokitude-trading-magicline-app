import { Shield, Home, Sun, Moon, Users, Database, Briefcase, Bot, Settings } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { UserProfileDropdown } from '../common';

export default function AdminHeader({ activeTab, onTabChange, onBackToMain }) {
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'stocks', label: 'Stocks', icon: Database },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'bot', label: 'Bot', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo/Brand + Back Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToMain}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Back to Main Dashboard"
            >
              <Home className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">Back to Main</span>
            </button>

            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>

            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-cyan-500" />
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            </div>
          </div>

          {/* Navigation Menu - Desktop */}
          <nav className="hidden lg:flex items-center gap-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${activeTab === tab.id
                    ? 'bg-cyan-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Section: Theme + User */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700 dark:text-gray-400" />
              )}
            </button>

            {/* User Dropdown */}
            <UserProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}

