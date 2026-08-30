import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut, User, ChevronDown, UserCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Reusable User Profile Dropdown Component
 * Used in both main Header and AdminHeader for consistent user menu experience
 * @param {function} onClose - Callback to close parent menu (for mobile)
 * @param {boolean} isMobile - Whether to render in mobile mode (flat list instead of dropdown)
 */
export default function UserProfileDropdown({ onClose = () => { }, isMobile = false }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
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

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to logout?')) {
            setUserDropdownOpen(false);
            await logout();
        }
    };

    const handleNavigation = (path) => {
        setUserDropdownOpen(false);
        onClose(); // Close mobile menu if applicable
        navigate(path);
    };

    // Mobile view - render as flat list
    if (isMobile) {
        return (
            <>
                <button
                    onClick={() => handleNavigation('/profile')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                    <UserCircle className="w-5 h-5" />
                    <span>My Profile</span>
                </button>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition font-medium"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                </button>
            </>
        );
    }

    // Desktop view - render as dropdown
    return (
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
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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
                        onClick={() => handleNavigation('/profile')}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                        <UserCircle className="w-4 h-4" />
                        <span>My Profile</span>
                    </button>

                    {/* Divider */}
                    <div className="my-1 border-t border-gray-200 dark:border-gray-700"></div>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                    </button>
                </div>
            )}
        </div>
    );
}

