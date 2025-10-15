import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import UploadForm from './components/UploadForm';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import socketService from './services/socket';

function AppContent() {
  const [stats, setStats] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [refreshDashboard, setRefreshDashboard] = useState(0);
  const [showSignup, setShowSignup] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'login', 'signup'
  const { user, loading } = useAuth();

  useEffect(() => {
    // Connect to socket
    socketService.connect();

    // Monitor connection status
    const checkConnection = setInterval(() => {
      setIsConnected(socketService.isConnected());
    }, 1000);

    // Listen for initial data to update stats
    const handleInitialData = (data) => {
      setStats(data.stats);
    };

    socketService.on('initialData', handleInitialData);

    return () => {
      clearInterval(checkConnection);
      socketService.off('initialData', handleInitialData);
    };
  }, []);

  const handleUploadSuccess = () => {
    // Trigger dashboard refresh
    setRefreshDashboard(prev => prev + 1);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login/signup views when explicitly requested
  if (currentView === 'login') {
    return (
      <Login 
        onSwitchToSignup={() => setCurrentView('signup')}
        onBackToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  if (currentView === 'signup') {
    return (
      <Signup 
        onSwitchToLogin={() => setCurrentView('login')}
        onBackToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // Show main app (dashboard is public for now)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header 
        stats={stats} 
        isConnected={isConnected}
        onNavigateToDashboard={() => {
          setCurrentView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateToLogin={() => setCurrentView('login')}
        onNavigateToSignup={() => setCurrentView('signup')}
      />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Upload Section - Only for authenticated admins */}
          {user?.role === 'admin' && (
            <UploadForm onUploadSuccess={handleUploadSuccess} />
          )}

          {/* Show login prompt for non-authenticated users */}
          {!user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 mb-1">
                    👋 Welcome to PSX Magic Line Monitor
                  </h3>
                  <p className="text-blue-700">
                    You're viewing in guest mode. Sign in to upload files and manage symbols.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentView('login')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setCurrentView('signup')}
                    className="px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Section - Public Access */}
          <Dashboard key={refreshDashboard} />
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>PSX Magic Line Monitor - Real-time Stock Price Monitoring</p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

