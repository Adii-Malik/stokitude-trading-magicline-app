import { TrendingUp, LogOut, User, Shield, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Header({ stats, isConnected, onNavigateToDashboard, onNavigateToLogin, onNavigateToSignup }) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <button 
            onClick={onNavigateToDashboard}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity group"
          >
            <TrendingUp className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <h1 className="text-2xl font-bold group-hover:underline">PSX Magic Line Monitor</h1>
              <p className="text-blue-100 text-sm">Real-time stock price monitoring</p>
            </div>
          </button>

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="hidden md:flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Stats */}
            {stats && (
              <div className="hidden lg:flex items-center gap-6 bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-center">
                  <div className="text-xl font-bold">{stats.totalSymbols}</div>
                  <div className="text-xs text-blue-100">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-300">{stats.metThreshold}</div>
                  <div className="text-xs text-blue-100">Met</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-300">{stats.belowThreshold}</div>
                  <div className="text-xs text-blue-100">Below</div>
                </div>
              </div>
            )}

            {/* User Info & Logout OR Login/Signup Buttons */}
            {user ? (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  {user.role === 'admin' ? (
                    <Shield className="w-4 h-4 text-yellow-300" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <div className="text-sm">
                    <div className="font-semibold">{user.username}</div>
                    <div className="text-xs text-blue-100 capitalize">{user.role}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-2 hover:bg-white/10 rounded-lg transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onNavigateToLogin}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition font-medium"
                >
                  Login
                </button>
                <button
                  onClick={onNavigateToSignup}
                  className="px-4 py-2 bg-white hover:bg-blue-50 text-blue-600 rounded-lg transition font-medium"
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

