import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Trash2, ArrowUp, Search, Filter, Loader2, X, Upload, FileText, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react';
import { getSymbols, clearSymbols, uploadFile } from '../services/api';
import socketService from '../services/socket';
import { useAuth } from '../contexts/AuthContext';

export default function MagicLine() {
  const [symbols, setSymbols] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'met', 'not-met'
  const [searchQuery, setSearchQuery] = useState('');
  const { user, isAdmin } = useAuth();

  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [message, setMessage] = useState(null);

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
      setSymbols(response.symbols || []);
      setStats(response.stats || null);
    } catch (error) {
      console.error('Error loading symbols:', error);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();

    if (!uploadingFile) {
      showMessage('Please select a CSV or Image file', 'error');
      return;
    }

    try {
      setUploading(true);
      const response = await uploadFile(uploadingFile);
      setUploadResult(response);
      showMessage(`Successfully uploaded ${response.totalCount || response.symbols?.length || 0} symbols`);
      setUploadingFile(null);
      loadSymbols();
    } catch (error) {
      console.error('Error uploading file:', error);
      showMessage(error.response?.data?.message || 'Failed to upload file', 'error');
    } finally {
      setUploading(false);
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
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-md">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          <span className="ml-3 text-lg text-gray-700 dark:text-gray-300">Loading symbols...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Strategic Levels Monitor</h1>
                <p className="text-gray-600 dark:text-gray-400">Track stocks against strategic price levels in real-time</p>
              </div>
            </div>

            <div className="flex gap-2">
              {isAdmin() && (
                <>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Upload</span>
                  </button>
                  {symbols.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Clear All</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Message Banner */}
          {message && (
            <div className={`p-4 rounded-lg mb-4 flex items-start gap-3 ${message.type === 'success'
              ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/50 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-400'
              }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="flex-1">{message.text}</span>
              <button onClick={() => setMessage(null)} className="text-current hover:opacity-70">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Stats Bar */}
          {symbols.length > 0 && (
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Symbols</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{symbols.length}</div>
                  </div>
                  <div className="h-12 w-px bg-gray-300 dark:bg-gray-600"></div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Levels Met</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{metCount}</div>
                  </div>
                  <div className="h-12 w-px bg-gray-300 dark:bg-gray-600"></div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Not Met</div>
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{notMetCount}</div>
                  </div>
                </div>
                {lastUpdate && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Last update: <span className="font-medium text-gray-900 dark:text-white">{lastUpdate.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filter and Search Section */}
        {symbols.length > 0 ? (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Filter Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${filterStatus === 'all'
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  All ({symbols.length})
                </button>
                <button
                  onClick={() => setFilterStatus('met')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 ${filterStatus === 'met'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Met ({metCount})
                </button>
                <button
                  onClick={() => setFilterStatus('not-met')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 ${filterStatus === 'not-met'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  <Minus className="w-3 h-3" />
                  Not Met ({notMetCount})
                </button>
              </div>

              {/* Search Input */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search symbols..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Results Info */}
        {(searchQuery || filterStatus !== 'all') && (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-bold">{filteredSymbols.length}</span> of <span className="font-bold">{symbols.length}</span> symbols
                {searchQuery && <span className="text-gray-600 dark:text-gray-400"> matching "<span className="font-semibold text-gray-900 dark:text-white">{searchQuery}</span>"</span>}
              </span>
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
              }}
              className="px-2 sm:px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-200 dark:hover:bg-red-500/30 transition flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span className="hidden sm:inline">Clear Filters</span>
              <span className="sm:hidden">Clear</span>
            </button>
          </div>
        )}

        {/* Symbols Grid or Empty State */}
        {symbols.length === 0 ? (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Symbols Loaded</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Upload a CSV file or image to start monitoring stocks against strategic price levels
            </p>
            {isAdmin() && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2 mx-auto"
              >
                <Upload className="w-5 h-5" />
                Upload File
              </button>
            )}
          </div>
        ) : filteredSymbols.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSymbols.map((symbol) => (
              <SymbolCard key={symbol.symbol} symbol={symbol} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No symbols found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery
                ? `No symbols match "${searchQuery}"`
                : filterStatus === 'met'
                  ? 'No symbols have met their strategic levels yet'
                  : 'No symbols in this category'
              }
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
              }}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors duration-200"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Back to Top Button */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full p-4 shadow-lg border border-cyan-400 transition-all duration-300 hover:scale-110 hover:shadow-xl z-50 group"
            aria-label="Back to top"
          >
            <ArrowUp className="w-6 h-6 group-hover:animate-bounce" />
          </button>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upload Strategic Levels Data</h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadResult(null);
                    setUploadingFile(null);
                  }}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFileUpload} className="p-6 space-y-4">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <input
                    type="file"
                    accept=".csv,image/*"
                    onChange={(e) => setUploadingFile(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer transition"
                  >
                    {uploadingFile ? uploadingFile.name : 'Choose CSV or Image File'}
                  </label>
                </div>

                <div className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-cyan-900 dark:text-cyan-400 mb-2">Accepted Formats:</h4>
                  <div className="text-sm text-cyan-800 dark:text-cyan-300 space-y-1">
                    <p><strong>CSV Format:</strong> Symbol,MagicLine (or StrategicLevel)</p>
                    <p><strong>Images:</strong> JPG, PNG, GIF (OCR will extract data)</p>
                  </div>
                </div>

                {uploadResult && (
                  <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/50 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 dark:text-green-400 mb-2">Upload Result:</h4>
                    <div className="text-sm text-green-800 dark:text-green-300">
                      <p>Successfully uploaded {uploadResult.totalCount || uploadResult.symbols?.length || 0} symbols</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={!uploadingFile || uploading}
                    className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload File
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadResult(null);
                      setUploadingFile(null);
                    }}
                    disabled={uploading}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
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
        relative overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:scale-105
        ${isMet
          ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-500/10 dark:to-emerald-500/10 border-2 border-green-400 dark:border-green-500/50 ring-2 ring-green-200 dark:ring-green-500/20'
          : 'bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700'
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
          <h3 className={`text-xl font-bold ${isMet ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
            {name}
          </h3>
        </div>

        {/* Strategic Level */}
        <div className="mb-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Strategic Level (Target)</div>
          <div className={`text-2xl font-bold ${isMet ? 'text-green-700 dark:text-green-400' : 'text-cyan-600 dark:text-cyan-400'}`}>
            {magicLine.toFixed(2)}
          </div>
        </div>

        {/* Current Price */}
        <div className="mb-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Current Price</div>
          {hasPrice ? (
            <div className="flex items-baseline gap-2">
              <div className={`text-2xl font-bold ${isMet ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                {currentPrice.toFixed(2)}
              </div>
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-500 dark:text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-500" />
              )}
            </div>
          ) : (
            <div className="text-lg text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <Minus className="w-4 h-4" />
              No data
            </div>
          )}
        </div>

        {/* Change */}
        {hasPrice && (
          <div className="mb-3">
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium
              ${isPositive
                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-500/30'
                : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/30'}`}
            >
              {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {hasPrice && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{percentToTarget.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${isMet
                  ? 'bg-gradient-to-r from-green-500 to-green-600'
                  : percentToTarget >= 90
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                    : 'bg-gradient-to-r from-cyan-400 to-cyan-500'
                  }`}
                style={{ width: `${Math.min(percentToTarget, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Additional Info */}
        {hasPrice && priceData && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-gray-600 dark:text-gray-400">High</div>
              <div className="font-semibold text-gray-900 dark:text-gray-300">{priceData.high?.toFixed(2) || '-'}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Low</div>
              <div className="font-semibold text-gray-900 dark:text-gray-300">{priceData.low?.toFixed(2) || '-'}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Volume</div>
              <div className="font-semibold text-gray-900 dark:text-gray-300">
                {priceData.volume ? (priceData.volume / 1000).toFixed(1) + 'K' : '-'}
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Change %</div>
              <div className={`font-semibold ${priceData.changePercent >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
                }`}>
                {priceData.changePercent ?
                  `${priceData.changePercent >= 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%`
                  : '-'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

