import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import UploadForm from './components/UploadForm';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import StockManagement from './components/StockManagement';
import TradePlans from './components/TradePlans';
import Settings from './components/Settings';
import Login from './components/Login';
import Signup from './components/Signup';
import socketService from './services/socket';

function AppContent() {
  const [stats, setStats] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [refreshDashboard, setRefreshDashboard] = useState(0);
  const [showSignup, setShowSignup] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'stocks', 'admin', 'login', 'signup'
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  const [marketStatus, setMarketStatus] = useState('closed');
  const { user, loading, isAdmin } = useAuth();

  useEffect(() => {
    // Connect to socket
    socketService.connect();

    // Monitor connection status
    const checkConnection = setInterval(() => {
      setIsConnected(socketService.isConnected());
    }, 1000);

    // Listen for initial data to update stats and last update time
    const handleInitialData = (data) => {
      setStats(data.stats);
      if (data.lastUpdate) {
        setLastPriceUpdate(new Date(data.lastUpdate));
      }
    };

    // Listen for price updates
    const handlePriceUpdate = (data) => {
      setLastPriceUpdate(new Date());
    };

    // Listen for trade plan updates
    const handleTradePlanUpdate = (data) => {
      setLastPriceUpdate(new Date());
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

    fetchMarketStatus();
    
    // Check market status every 5 minutes
    const marketStatusInterval = setInterval(fetchMarketStatus, 5 * 60 * 1000);

    socketService.on('initialData', handleInitialData);
    socketService.on('priceUpdate', handlePriceUpdate);
    socketService.on('tradePlanUpdate', handleTradePlanUpdate);

    return () => {
      clearInterval(checkConnection);
      clearInterval(marketStatusInterval);
      socketService.off('initialData', handleInitialData);
      socketService.off('priceUpdate', handlePriceUpdate);
      socketService.off('tradePlanUpdate', handleTradePlanUpdate);
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

  // Show Trade Signals
  if (currentView === 'trade-signals') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
        <Header 
          isConnected={isConnected}
          currentPage="trade-signals"
          lastPriceUpdate={lastPriceUpdate}
          marketStatus={marketStatus}
          onNavigateToDashboard={() => setCurrentView('dashboard')}
          onNavigateToStocks={() => setCurrentView('stocks')}
          onNavigateToTradeSignals={() => setCurrentView('trade-signals')}
          onNavigateToAdmin={() => setCurrentView('admin')}
          onNavigateToSettings={() => setCurrentView('settings')}
          onNavigateToLogin={() => setCurrentView('login')}
          onNavigateToSignup={() => setCurrentView('signup')}
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
    );
  }

  // Show Stock Management (Admin only)
  if (currentView === 'stocks') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
        <Header 
          isConnected={isConnected}
          currentPage="stocks"
          lastPriceUpdate={lastPriceUpdate}
          marketStatus={marketStatus}
          onNavigateToDashboard={() => setCurrentView('dashboard')}
          onNavigateToStocks={() => setCurrentView('stocks')}
          onNavigateToTradeSignals={() => setCurrentView('trade-signals')}
          onNavigateToAdmin={() => setCurrentView('admin')}
          onNavigateToSettings={() => setCurrentView('settings')}
          onNavigateToLogin={() => setCurrentView('login')}
          onNavigateToSignup={() => setCurrentView('signup')}
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
    );
  }

  // Show admin dashboard
  if (currentView === 'admin') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
        <Header 
          isConnected={isConnected}
          currentPage="admin"
          lastPriceUpdate={lastPriceUpdate}
          marketStatus={marketStatus}
          onNavigateToDashboard={() => setCurrentView('dashboard')}
          onNavigateToStocks={() => setCurrentView('stocks')}
          onNavigateToTradeSignals={() => setCurrentView('trade-signals')}
          onNavigateToAdmin={() => setCurrentView('admin')}
          onNavigateToSettings={() => setCurrentView('settings')}
          onNavigateToLogin={() => setCurrentView('login')}
          onNavigateToSignup={() => setCurrentView('signup')}
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
    );
  }

  // Show Settings (Admin only)
  if (currentView === 'settings') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
        <Header 
          isConnected={isConnected}
          currentPage="settings"
          lastPriceUpdate={lastPriceUpdate}
          marketStatus={marketStatus}
          onNavigateToDashboard={() => setCurrentView('dashboard')}
          onNavigateToStocks={() => setCurrentView('stocks')}
          onNavigateToTradeSignals={() => setCurrentView('trade-signals')}
          onNavigateToAdmin={() => setCurrentView('admin')}
          onNavigateToSettings={() => setCurrentView('settings')}
          onNavigateToLogin={() => setCurrentView('login')}
          onNavigateToSignup={() => setCurrentView('signup')}
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
    );
  }

  // Show main app
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <Header 
        isConnected={isConnected}
        currentPage={currentView}
        lastPriceUpdate={lastPriceUpdate}
        marketStatus={marketStatus}
        onNavigateToDashboard={() => {
          setCurrentView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateToStocks={() => setCurrentView('stocks')}
        onNavigateToTradeSignals={() => setCurrentView('trade-signals')}
        onNavigateToAdmin={() => setCurrentView('admin')}
        onNavigateToSettings={() => setCurrentView('settings')}
        onNavigateToLogin={() => setCurrentView('login')}
        onNavigateToSignup={() => setCurrentView('signup')}
      />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Upload Section - Only for authenticated admins */}
          {isAdmin() && (
            <UploadForm onUploadSuccess={handleUploadSuccess} />
          )}

          {/* Dashboard Section - Public Access */}
          <Dashboard key={refreshDashboard} />
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12 transition-colors duration-300">
        <div className="container mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400 text-sm">
          <p>PSX SmartDesk - Real-time Stock Price Monitoring & Trade Management</p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
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
  );
}

export default App;

