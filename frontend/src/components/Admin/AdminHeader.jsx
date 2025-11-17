import { useState, useEffect, useRef } from 'react';
import { Shield, LogOut, User, ChevronDown, UserCircle, Lock, Home, Sun, Moon, Users, Database, Briefcase, Bot, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function AdminHeader({ activeTab, onTabChange, onBackToMain }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'stocks', label: 'Stocks', icon: Database },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'bot', label: 'Bot', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

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

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

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
                  className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
                    activeTab === tab.id
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
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white">{user?.username}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                  {/* User Info Header */}
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      {user?.role === 'super_admin' ? (
                        <Shield className="w-4 h-4 text-yellow-500" />
                      ) : user?.role === 'admin' ? (
                        <Shield className="w-4 h-4 text-cyan-500" />
                      ) : (
                        <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.username}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-1">
                      {user?.role === 'super_admin' ? 'Super Admin' : user?.role}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      console.log('Navigate to Profile');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <UserCircle className="w-4 h-4" />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
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
          </div>
        </div>
      </div>
    </header>
  );
}

