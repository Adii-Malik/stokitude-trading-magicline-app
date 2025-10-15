import { useState, useEffect } from 'react';
import Header from './components/Header';
import UploadForm from './components/UploadForm';
import Dashboard from './components/Dashboard';
import socketService from './services/socket';

function App() {
  const [stats, setStats] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [refreshDashboard, setRefreshDashboard] = useState(0);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header stats={stats} isConnected={isConnected} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Upload Section */}
          <UploadForm onUploadSuccess={handleUploadSuccess} />

          {/* Dashboard Section */}
          <Dashboard key={refreshDashboard} />
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>PSX Magic Line Monitor - Real-time Stock Price Monitoring</p>
          <p className="text-xs text-gray-500 mt-1">
            Data provided by <a href="https://psxterminal.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">PSX Terminal</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

