import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import UploadForm from './components/UploadForm';
import Dashboard from './components/Dashboard';
import MagicLine from './components/MagicLine';
import AdminDashboard from './components/AdminDashboard';
import StockManagement from './components/StockManagement';
import TradePlans from './components/TradePlans';
import Settings from './components/Settings';
import Login from './components/Login';
import Signup from './components/Signup';
import Landing from './components/Landing';
import socketService from './services/socket';

// Protected Route Component
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppContent() {
  const [isConnected, setIsConnected] = useState(false);
  const [refreshDashboard, setRefreshDashboard] = useState(0);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  const [marketStatus, setMarketStatus] = useState('closed');
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Connect to socket
    socketService.connect();

    // Monitor connection status
    const checkConnection = setInterval(() => {
      setIsConnected(socketService.isConnected());
    }, 1000);

    // Fetch last price update timestamp
    const fetchLastPriceUpdate = async () => {
      try {
        const response = await fetch('/api/settings/last-update');
        const data = await response.json();
        if (data.success && data.data.lastUpdate) {
          setLastPriceUpdate(new Date(data.data.lastUpdate));
        }
      } catch (error) {
        console.error('Error fetching last price update:', error);
      }
    };

    // Listen for price updates
    const handlePriceUpdate = (data) => {
      if (data.data?.timestamp) {
        setLastPriceUpdate(new Date(data.data.timestamp));
      } else {
        setLastPriceUpdate(new Date());
      }
    };

    // Listen for trade plan updates
    const handleTradePlanUpdate = (data) => {
      // Trade plan updates don't necessarily mean prices were fetched
      // So we just refresh the last update from server
      fetchLastPriceUpdate();
    };

    // Fetch market status on mount
    const fetchMarketStatus = async () => {
      try {
        const response = await fetch('/api/trade-plans/market-status');
        const data = await response.json();
        setMarketStatus(data.isOpen ? 'open' : 'closed');
      } catch (error) {
        console.error('Error fetching market status:', error);
      }
    };

    // Fetch initial data
    fetchMarketStatus();
    fetchLastPriceUpdate();
    
    // Check market status every 5 minutes
    const marketStatusInterval = setInterval(fetchMarketStatus, 5 * 60 * 1000);
    
    // Refresh last update timestamp every minute
    const lastUpdateInterval = setInterval(fetchLastPriceUpdate, 60 * 1000);

    socketService.on('priceUpdate', handlePriceUpdate);
    socketService.on('tradePlanUpdate', handleTradePlanUpdate);

    return () => {
      clearInterval(checkConnection);
      clearInterval(marketStatusInterval);
      clearInterval(lastUpdateInterval);
      socketService.off('priceUpdate', handlePriceUpdate);
      socketService.off('tradePlanUpdate', handleTradePlanUpdate);
    };
  }, []);

  const handleUploadSuccess = () => {
    // Trigger dashboard refresh
    setRefreshDashboard(prev => prev + 1);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={
        user ? <Navigate to="/dashboard" replace /> : <Landing 
          onSwitchToLogin={() => navigate('/login')}
          onSwitchToSignup={() => navigate('/signup')}
        />
      } />
      
      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : <Login 
          onSwitchToSignup={() => navigate('/signup')}
          onBackToDashboard={() => navigate('/')}
        />
      } />
      
      <Route path="/signup" element={
        user ? <Navigate to="/dashboard" replace /> : <Signup 
          onSwitchToLogin={() => navigate('/login')}
          onBackToDashboard={() => navigate('/')}
        />
      } />

      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            <Header 
              isConnected={isConnected}
              currentPage="dashboard"
              lastPriceUpdate={lastPriceUpdate}
              marketStatus={marketStatus}
              onNavigateToDashboard={() => navigate('/dashboard')}
              onNavigateToMagicLine={() => navigate('/magic-line')}
              onNavigateToStocks={() => navigate('/stocks')}
              onNavigateToTradeSignals={() => navigate('/trade-signals')}
              onNavigateToAdmin={() => navigate('/admin')}
              onNavigateToSettings={() => navigate('/settings')}
              onNavigateToLogin={() => navigate('/login')}
              onNavigateToSignup={() => navigate('/signup')}
            />
            
            <Dashboard />

            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12 transition-colors duration-300">
              <div className="container mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400 text-sm">
                <p>PSX SmartDesk - Real-time Stock Price Monitoring & Trade Management</p>
              </div>
            </footer>
          </div>
        </ProtectedRoute>
      } />

      <Route path="/magic-line" element={
        <ProtectedRoute>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            <Header 
              isConnected={isConnected}
              currentPage="magic-line"
              lastPriceUpdate={lastPriceUpdate}
              marketStatus={marketStatus}
              onNavigateToDashboard={() => navigate('/dashboard')}
              onNavigateToMagicLine={() => navigate('/magic-line')}
              onNavigateToStocks={() => navigate('/stocks')}
              onNavigateToTradeSignals={() => navigate('/trade-signals')}
              onNavigateToAdmin={() => navigate('/admin')}
              onNavigateToSettings={() => navigate('/settings')}
              onNavigateToLogin={() => navigate('/login')}
              onNavigateToSignup={() => navigate('/signup')}
            />
            
            <main className="container mx-auto px-4 py-8">
              <div className="max-w-7xl mx-auto space-y-8">
                {isAdmin() && (
                  <UploadForm onUploadSuccess={handleUploadSuccess} />
                )}
                <MagicLine key={refreshDashboard} />
              </div>
            </main>

            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12 transition-colors duration-300">
              <div className="container mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400 text-sm">
                <p>PSX SmartDesk - Real-time Stock Price Monitoring & Trade Management</p>
              </div>
            </footer>
          </div>
        </ProtectedRoute>
      } />

      <Route path="/trade-signals" element={
        <ProtectedRoute>
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            <Header 
              isConnected={isConnected}
              currentPage="trade-signals"
              lastPriceUpdate={lastPriceUpdate}
              marketStatus={marketStatus}
              onNavigateToDashboard={() => navigate('/dashboard')}
              onNavigateToMagicLine={() => navigate('/magic-line')}
              onNavigateToStocks={() => navigate('/stocks')}
              onNavigateToTradeSignals={() => navigate('/trade-signals')}
              onNavigateToAdmin={() => navigate('/admin')}
              onNavigateToSettings={() => navigate('/settings')}
              onNavigateToLogin={() => navigate('/login')}
              onNavigateToSignup={() => navigate('/signup')}
            />
            <div className="flex-1">
              <TradePlans />
            </div>
            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12 transition-colors duration-300">
              <div className="container mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400 text-sm">
                <p>PSX SmartDesk - Real-time Stock Price Monitoring & Trade Management</p>
              </div>
            </footer>
          </div>
        </ProtectedRoute>
      } />

      {/* Admin Only Routes */}
      <Route path="/stocks" element={
        <ProtectedRoute adminOnly>
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            <Header 
              isConnected={isConnected}
              currentPage="stocks"
              lastPriceUpdate={lastPriceUpdate}
              marketStatus={marketStatus}
              onNavigateToDashboard={() => navigate('/dashboard')}
              onNavigateToMagicLine={() => navigate('/magic-line')}
              onNavigateToStocks={() => navigate('/stocks')}
              onNavigateToTradeSignals={() => navigate('/trade-signals')}
              onNavigateToAdmin={() => navigate('/admin')}
              onNavigateToSettings={() => navigate('/settings')}
              onNavigateToLogin={() => navigate('/login')}
              onNavigateToSignup={() => navigate('/signup')}
            />
            <div className="flex-1">
              <StockManagement />
            </div>
            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12 transition-colors duration-300">
              <div className="container mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400 text-sm">
                <p>PSX SmartDesk - Real-time Stock Price Monitoring & Trade Management</p>
              </div>
            </footer>
          </div>
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute adminOnly>
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            <Header 
              isConnected={isConnected}
              currentPage="admin"
              lastPriceUpdate={lastPriceUpdate}
              marketStatus={marketStatus}
              onNavigateToDashboard={() => navigate('/dashboard')}
              onNavigateToMagicLine={() => navigate('/magic-line')}
              onNavigateToStocks={() => navigate('/stocks')}
              onNavigateToTradeSignals={() => navigate('/trade-signals')}
              onNavigateToAdmin={() => navigate('/admin')}
              onNavigateToSettings={() => navigate('/settings')}
              onNavigateToLogin={() => navigate('/login')}
              onNavigateToSignup={() => navigate('/signup')}
            />
            <div className="flex-1">
              <AdminDashboard />
            </div>
            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12 transition-colors duration-300">
              <div className="container mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400 text-sm">
                <p>PSX SmartDesk - Real-time Stock Price Monitoring & Trade Management</p>
              </div>
            </footer>
          </div>
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute adminOnly>
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            <Header 
              isConnected={isConnected}
              currentPage="settings"
              lastPriceUpdate={lastPriceUpdate}
              marketStatus={marketStatus}
              onNavigateToDashboard={() => navigate('/dashboard')}
              onNavigateToMagicLine={() => navigate('/magic-line')}
              onNavigateToStocks={() => navigate('/stocks')}
              onNavigateToTradeSignals={() => navigate('/trade-signals')}
              onNavigateToAdmin={() => navigate('/admin')}
              onNavigateToSettings={() => navigate('/settings')}
              onNavigateToLogin={() => navigate('/login')}
              onNavigateToSignup={() => navigate('/signup')}
            />
            <div className="flex-1">
              <Settings />
            </div>
            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12 transition-colors duration-300">
              <div className="container mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400 text-sm">
                <p>PSX SmartDesk - Real-time Stock Price Monitoring & Trade Management</p>
              </div>
            </footer>
          </div>
        </ProtectedRoute>
      } />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;

