import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Trash2, ArrowUp, Search, Filter } from 'lucide-react';
import { getSymbols, clearSymbols, fetchPrices } from '../services/api';
import socketService from '../services/socket';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const [symbols, setSymbols] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'met', 'not-met'
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();

  // Load initial data
  useEffect(() => {
    loadSymbols();
  }, []);

  // Setup Socket.IO listeners
  useEffect(() => {
    // Connect to socket
    socketService.connect();

    // Listen for initial data
    const handleInitialData = (data) => {
      console.log('Received initial data:', data);
      setSymbols(data.symbols || []);
      setStats(data.stats || null);
      setLoading(false);
    };

    // Listen for price updates
    const handlePriceUpdate = (update) => {
      console.log('Price update:', update);
      setLastUpdate(new Date());
      
      setSymbols(prevSymbols => {
        return prevSymbols.map(symbol => {
          if (symbol.symbol === update.symbol) {
            return {
              ...symbol,
              currentPrice: update.currentPrice,
              priceData: update.priceData,
              isMet: update.isMet
            };
          }
          return symbol;
        });
      });

      // Update stats
      setStats(prevStats => {
        if (!prevStats) return null;
        
        // Recalculate stats (simplified version)
        // In a real app, you'd get this from the server or calculate more accurately
        return { ...prevStats };
      });
    };

    socketService.on('initialData', handleInitialData);
    socketService.on('priceUpdate', handlePriceUpdate);

    // Cleanup
    return () => {
      socketService.off('initialData', handleInitialData);
      socketService.off('priceUpdate', handlePriceUpdate);
    };
  }, []);

  // Handle scroll to show/hide back to top button
  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down more than 400px
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const loadSymbols = async () => {
    try {
      setLoading(true);
      const response = await getSymbols();
      setSymbols(response.data.symbols || []);
      setStats(response.data.stats || null);
    } catch (error) {
      console.error('Error loading symbols:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setFetching(true);
      setFetchMessage(null);
      
      console.log('🔄 Triggering smart fetch...');
      const response = await fetchPrices();
      
      console.log('Fetch response:', response);
      
      // Update symbols with fresh/cached data
      if (response.data && response.data.symbols) {
        setSymbols(response.data.symbols);
        // Use actual fetch time from server, not current time
        if (response.data.lastFetchTime) {
          setLastUpdate(new Date(response.data.lastFetchTime));
        }
      }
      
      // Show user-friendly message
      if (response.cached) {
        // Helper function to format time in a user-friendly way
        const formatTimeAgo = (timestamp) => {
          if (!timestamp) return 'recently';
          const seconds = Math.floor((Date.now() - timestamp) / 1000);
          if (seconds < 60) return 'just now';
          const minutes = Math.floor(seconds / 60);
          if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
          const hours = Math.floor(minutes / 60);
          return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        };

        const formatWaitTime = (seconds) => {
          if (!seconds || seconds <= 0) return 'now';
          if (seconds < 60) return 'less than a minute';
          const minutes = Math.ceil(seconds / 60);
          if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
          const hours = Math.floor(minutes / 60);
          return `${hours} hour${hours !== 1 ? 's' : ''}`;
        };

        const timeAgo = formatTimeAgo(response.data?.lastFetchTime);
        const waitTime = formatWaitTime(response.data?.nextFetchIn);

        setFetchMessage({
          type: 'info',
          text: `📊 Showing recent data (updated ${timeAgo}). New data available in ${waitTime}.`
        });
      } else {
        setFetchMessage({
          type: 'success',
          text: `✅ Fresh prices fetched from PSX! ${response.data.success} of ${response.data.total} symbols updated.`
        });
      }
      
      // Clear message after 5 seconds
      setTimeout(() => setFetchMessage(null), 5000);
      
    } catch (error) {
      console.error('Error fetching prices:', error);
      setFetchMessage({
        type: 'error',
        text: '⚠️ Could not fetch prices. Please check your connection and try again.'
      });
      setTimeout(() => setFetchMessage(null), 5000);
    } finally {
      setFetching(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all symbols?')) {
      return;
    }

    try {
      await clearSymbols();
      setSymbols([]);
      setStats(null);
    } catch (error) {
      console.error('Error clearing symbols:', error);
      const errorMsg = error.response?.data?.message || 'Failed to clear symbols';
      alert(errorMsg);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Filter symbols based on status and search query
  const filteredSymbols = symbols.filter(symbol => {
    // Filter by status
    if (filterStatus === 'met' && !symbol.isMet) return false;
    if (filterStatus === 'not-met' && symbol.isMet) return false;
    
    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const symbolName = symbol.symbol.toLowerCase();
      return symbolName.includes(query);
    }
    
    return true;
  });

  // Calculate filter stats
  const metCount = symbols.filter(s => s.isMet).length;
  const notMetCount = symbols.filter(s => !s.isMet).length;

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-lg text-gray-600">Loading symbols...</span>
        </div>
      </div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Symbols Loaded</h3>
          <p className="text-gray-500">
            Upload a CSV file or image to start monitoring stocks
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold">Monitoring {symbols.length} Symbols</h2>
            {lastUpdate && (
              <span className="text-sm text-gray-500">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={fetching}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{fetching ? 'Fetching...' : 'Refresh Prices'}</span>
          </button>
            {user?.role === 'admin' && (
              <button
                onClick={handleClearAll}
                className="btn btn-danger flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter and Search Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600">Filter:</span>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({symbols.length})
              </button>
              <button
                onClick={() => setFilterStatus('met')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                  filterStatus === 'met'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Met ({metCount})
              </button>
              <button
                onClick={() => setFilterStatus('not-met')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  filterStatus === 'not-met'
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Not Met ({notMetCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbols..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fetch Message */}
      {fetchMessage && (
        <div className={`p-4 rounded-lg border ${
          fetchMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          fetchMessage.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          {fetchMessage.text}
        </div>
      )}

      {/* Results Info */}
      {(searchQuery || filterStatus !== 'all') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            Showing <span className="font-bold">{filteredSymbols.length}</span> of {symbols.length} symbols
            {searchQuery && <span> matching "<span className="font-semibold">{searchQuery}</span>"</span>}
          </span>
          {(searchQuery || filterStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
              }}
              className="ml-auto text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Symbols Grid */}
      {filteredSymbols.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSymbols.map((symbol) => (
            <SymbolCard key={symbol.symbol} symbol={symbol} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No symbols found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery 
              ? `No symbols match "${searchQuery}"`
              : filterStatus === 'met'
              ? 'No symbols have met their magic line yet'
              : 'No symbols in this category'
            }
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterStatus('all');
            }}
            className="btn btn-primary"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50 group"
          aria-label="Back to top"
        >
          <ArrowUp className="w-6 h-6 group-hover:animate-bounce" />
        </button>
      )}
    </div>
  );
}

function SymbolCard({ symbol }) {
  const { symbol: name, magicLine, currentPrice, isMet, priceData } = symbol;
  
  const hasPrice = currentPrice !== null;
  const change = priceData?.change || 0;
  const changePercent = priceData?.changePercent || 0;
  const isPositive = change >= 0;

  // Calculate how close to magic line (as percentage)
  const percentToTarget = hasPrice ? ((currentPrice / magicLine) * 100) : 0;

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:shadow-xl
        ${isMet 
          ? 'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-400 ring-2 ring-green-200 animate-pulse-slow' 
          : 'bg-white border border-gray-200'
        }
      `}
    >
      {/* Met Badge */}
      {isMet && (
        <div className="absolute top-2 right-2">
          <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-bounce-slow">
            <TrendingUp className="w-3 h-3" />
            MET!
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Symbol Name */}
        <div className="mb-3">
          <h3 className={`text-xl font-bold ${isMet ? 'text-green-900' : 'text-gray-900'}`}>
            {name}
          </h3>
        </div>

        {/* Magic Line */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Magic Line (Target)</div>
          <div className={`text-2xl font-bold ${isMet ? 'text-green-700' : 'text-blue-600'}`}>
            {magicLine.toFixed(2)}
          </div>
        </div>

        {/* Current Price */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Current Price</div>
          {hasPrice ? (
            <div className="flex items-baseline gap-2">
              <div className={`text-2xl font-bold ${isMet ? 'text-green-700' : 'text-gray-900'}`}>
                {currentPrice.toFixed(2)}
              </div>
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
            </div>
          ) : (
            <div className="text-lg text-gray-400 flex items-center gap-2">
              <Minus className="w-4 h-4" />
              No data
            </div>
          )}
        </div>

        {/* Change */}
        {hasPrice && (
          <div className="mb-3">
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium
              ${isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            >
              {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{(changePercent * 100).toFixed(2)}%)
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {hasPrice && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span className="font-semibold">{percentToTarget.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  isMet 
                    ? 'bg-gradient-to-r from-green-500 to-green-600' 
                    : percentToTarget >= 90
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                    : 'bg-gradient-to-r from-blue-400 to-blue-500'
                }`}
                style={{ width: `${Math.min(percentToTarget, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Additional Info */}
        {hasPrice && priceData && (
          <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-gray-500">High</div>
              <div className="font-semibold text-gray-700">{priceData.high?.toFixed(2) || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">Low</div>
              <div className="font-semibold text-gray-700">{priceData.low?.toFixed(2) || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">Volume</div>
              <div className="font-semibold text-gray-700">
                {priceData.volume ? (priceData.volume / 1000).toFixed(1) + 'K' : '-'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Trades</div>
              <div className="font-semibold text-gray-700">{priceData.trades || '-'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

