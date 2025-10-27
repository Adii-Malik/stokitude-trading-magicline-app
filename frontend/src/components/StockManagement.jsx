import { useState, useEffect } from 'react';
import { startScraping } from '../services/historical';
import { getStockById } from '../services/stocks';
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Search,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  BarChart3,
  Download
} from 'lucide-react';
import {
  getStocks,
  createStock,
  updateStock,
  deleteStock,
  uploadStocksCSV,
  getSectors
} from '../services/stocks';
import { useNavigate } from 'react-router-dom';

export default function StockManagement() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [shariahFilter, setShariahFilter] = useState('');
  const [sectors, setSectors] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const navigate = useNavigate();

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingStock, setEditingStock] = useState(null);

  // Scrape modal state
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [scrapeStartDate, setScrapeStartDate] = useState('2023-01-02'); // Monday
  const [scrapeEndDate, setScrapeEndDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    // If today is Sunday (0), go back 2 days; if Saturday (6), go back 1 day
    if (day === 0) {
      today.setDate(today.getDate() - 2);
    } else if (day === 6) {
      today.setDate(today.getDate() - 1);
    }
    return today.toISOString().split('T')[0];
  });
  const [isScraping, setIsScraping] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const [selectedSymbolsData, setSelectedSymbolsData] = useState([]);
  const [scrapeSymbolSearch, setScrapeSymbolSearch] = useState('');
  const [scrapeSearchResults, setScrapeSearchResults] = useState([]);
  const [scrapeSearchLoading, setScrapeSearchLoading] = useState(false);
  const [scrapeDropdownOpen, setScrapeDropdownOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    symbol: '',
    companyName: '',
    sector: '',
    shariahCompliant: ''
  });

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  // Message state
  const [message, setMessage] = useState(null);

  // Load stocks
  useEffect(() => {
    loadStocks();
  }, [pagination.page, searchQuery, sectorFilter, shariahFilter]);

  // Load sectors
  useEffect(() => {
    loadSectors();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const dropdown = document.getElementById('scrape-dropdown');
      if (dropdown && !dropdown.contains(event.target)) {
        setScrapeDropdownOpen(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && scrapeDropdownOpen) {
        setScrapeDropdownOpen(false);
      }
    };

    if (scrapeDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [scrapeDropdownOpen]);

  const loadStocks = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        sector: sectorFilter,
        shariahCompliant: shariahFilter
      };

      const response = await getStocks(params);
      setStocks(response.data.stocks);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading stocks:', error);
      showMessage('Failed to load stocks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSectors = async () => {
    try {
      const response = await getSectors();
      setSectors(response.data);
    } catch (error) {
      console.error('Error loading sectors:', error);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleAdd = () => {
    setFormData({ symbol: '', companyName: '', sector: '', shariahCompliant: '' });
    setShowAddModal(true);
  };

  const handleEdit = (stock) => {
    setEditingStock(stock);
    setFormData({
      symbol: stock.symbol,
      companyName: stock.companyName,
      sector: stock.sector || '',
      shariahCompliant: stock.shariahCompliant || ''
    });
    setShowEditModal(true);
  };

  const handleDelete = async (stock) => {
    if (!confirm(`Are you sure you want to delete ${stock.symbol}?`)) return;

    try {
      await deleteStock(stock._id);
      showMessage(`${stock.symbol} deleted successfully`);
      loadStocks();
    } catch (error) {
      console.error('Error deleting stock:', error);
      showMessage(error.response?.data?.message || 'Failed to delete stock', 'error');
    }
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();

    if (!formData.symbol || !formData.companyName) {
      showMessage('Symbol and Company Name are required', 'error');
      return;
    }

    try {
      await createStock(formData);
      showMessage(`${formData.symbol} added successfully`);
      setShowAddModal(false);
      loadStocks();
    } catch (error) {
      console.error('Error creating stock:', error);
      showMessage(error.response?.data?.message || 'Failed to create stock', 'error');
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();

    if (!formData.symbol || !formData.companyName) {
      showMessage('Symbol and Company Name are required', 'error');
      return;
    }

    try {
      await updateStock(editingStock._id, formData);
      showMessage(`${formData.symbol} updated successfully`);
      setShowEditModal(false);
      loadStocks();
    } catch (error) {
      console.error('Error updating stock:', error);
      showMessage(error.response?.data?.message || 'Failed to update stock', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();

    if (!uploadFile) {
      showMessage('Please select a CSV file', 'error');
      return;
    }

    try {
      const response = await uploadStocksCSV(uploadFile);
      setUploadResult(response.data);
      showMessage(`Successfully uploaded ${response.data.total} stocks`);
      setUploadFile(null);
      loadStocks();
      loadSectors(); // Reload sectors in case new ones were added
    } catch (error) {
      console.error('Error uploading CSV:', error);
      showMessage(error.response?.data?.message || 'Failed to upload CSV', 'error');
    }
  };

  const handleScrapeSymbolSearch = async (searchQuery) => {
    setScrapeSymbolSearch(searchQuery);

    try {
      setScrapeSearchLoading(true);
      const response = await getStocks({ search: searchQuery, limit: 100 });
      setScrapeSearchResults(response.data.stocks);
    } catch (error) {
      console.error('Error searching stocks:', error);
      setScrapeSearchResults([]);
    } finally {
      setScrapeSearchLoading(false);
    }
  };

  const handleStartScraping = async () => {
    if (selectedSymbols.length === 0) {
      showMessage('Please select at least one symbol', 'error');
      return;
    }

    if (!scrapeStartDate || !scrapeEndDate) {
      showMessage('Please select start and end dates', 'error');
      return;
    }

    try {
      setIsScraping(true);

      // Get symbol strings from selectedSymbolsData
      const symbolStrings = selectedSymbolsData.map(stock => stock.symbol);

      console.log('Starting scrape with:', { symbolStrings, selectedSymbolsData, selectedSymbols });

      if (symbolStrings.length === 0) {
        showMessage('No symbols selected. Please try again.', 'error');
        setIsScraping(false);
        return;
      }

      const data = await startScraping(
        symbolStrings,
        scrapeStartDate,
        scrapeEndDate
      );

      showMessage(`Scraping started for ${selectedSymbols.length} symbol(s)`, 'success');
      setShowScrapeModal(false);
      setScrapeDropdownOpen(false);
      setSelectedSymbols([]);
      setScrapeStartDate('2023-01-01');
      setScrapeEndDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error starting scrape:', error);
      showMessage(error.message || 'Failed to start scraping', 'error');
    } finally {
      setIsScraping(false);
    }
  };

  const fetchSelectedSymbolsData = async (symbolIds) => {
    if (symbolIds.length === 0) {
      setSelectedSymbolsData([]);
      return;
    }

    try {
      const promises = symbolIds.map(id => getStockById(id));
      const results = await Promise.all(promises);
      setSelectedSymbolsData(results.map(r => r.data).filter(Boolean));
    } catch (error) {
      console.error('Error fetching selected symbols:', error);
    }
  };

  const fetchScrapeStatus = async () => {
    try {
      const response = await getScrapeStatus();
      setScrapeStatuses(response.data || []);
    } catch (error) {
      console.error('Error fetching scrape status:', error);
    }
  };

  // Fetch selected symbols data when selection changes
  useEffect(() => {
    if (showScrapeModal) {
      fetchSelectedSymbolsData(selectedSymbols);
    }
  }, [selectedSymbols, showScrapeModal]);


  return (
    <div>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Stock Management</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage PSX stock symbols and company data</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Stock</span>
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload CSV</span>
              </button>
              <button
                onClick={() => setShowScrapeModal(true)}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Scrape Data</span>
              </button>
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

          {/* Search and Filters */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by symbol or company name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              >
                <option value="">All Sectors</option>
                {sectors.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>

              <select
                value={shariahFilter}
                onChange={(e) => setShariahFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              >
                <option value="">Shariah: All</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stocks Table */}
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-md">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading stocks...</p>
            </div>
          ) : stocks.length === 0 ? (
            <div className="p-12 text-center">
              <Database className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Stocks Found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery || sectorFilter || shariahFilter
                  ? 'No stocks match your filters'
                  : 'Add stocks or upload a CSV file to get started'
                }
              </p>
              {(searchQuery || sectorFilter || shariahFilter) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSectorFilter('');
                    setShariahFilter('');
                  }}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Symbol
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Company Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Sector
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Shariah
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Historical Data
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {stocks.map((stock) => (
                      <tr key={stock._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-cyan-600 dark:text-cyan-400">{stock.symbol}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-900 dark:text-gray-300">{stock.companyName}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {stock.sector ? (
                            <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                              {stock.sector}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {stock.shariahCompliant === 'Yes' ? (
                            <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded border border-green-300 dark:border-green-500/30">
                              Yes
                            </span>
                          ) : stock.shariahCompliant === 'No' ? (
                            <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded border border-red-300 dark:border-red-500/30">
                              No
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {stock.historicalDataStatus === 'available' ? (
                            <span className="px-2 py-1 text-xs bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 rounded border border-cyan-300 dark:border-cyan-500/30 flex items-center justify-center gap-1 w-fit mx-auto">
                              <CheckCircle className="w-3 h-3" />
                              Available
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center gap-1 w-fit mx-auto">
                              <AlertCircle className="w-3 h-3" />
                              No Data
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/historical/${stock.symbol}`)}
                              className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/20 rounded-lg transition"
                              title="View Historical Data"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(stock)}
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(stock)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} stocks
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.pages}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add/Edit Modal */}
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {showAddModal ? 'Add New Stock' : 'Edit Stock'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={showAddModal ? handleSubmitAdd : handleSubmitEdit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Symbol <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sector
                  </label>
                  <input
                    type="text"
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Shariah Compliant
                  </label>
                  <select
                    value={formData.shariahCompliant}
                    onChange={(e) => setFormData({ ...formData, shariahCompliant: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  >
                    <option value="">Not Specified</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
                  >
                    {showAddModal ? 'Add Stock' : 'Update Stock'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                    }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Upload CSV Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upload Stocks CSV</h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadResult(null);
                    setUploadFile(null);
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
                    accept=".csv"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer transition"
                  >
                    {uploadFile ? uploadFile.name : 'Choose CSV File'}
                  </label>
                </div>

                <div className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-cyan-900 dark:text-cyan-400 mb-2">Expected Format:</h4>
                  <code className="text-sm text-cyan-800 dark:text-cyan-300">
                    Symbol,CompanyName,Sector,ShariahCompliant
                  </code>
                  <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-2">
                    • Symbol and CompanyName are required<br />
                    • Sector and ShariahCompliant are optional
                  </p>
                </div>

                {uploadResult && (
                  <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/50 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 dark:text-green-400 mb-2">Upload Result:</h4>
                    <div className="text-sm text-green-800 dark:text-green-300 space-y-1">
                      <p>Total: {uploadResult.total}</p>
                      <p>Inserted: {uploadResult.inserted}</p>
                      <p>Updated: {uploadResult.updated}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={!uploadFile}
                    className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Upload CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadResult(null);
                      setUploadFile(null);
                    }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Scrape Historical Data Modal */}
        {showScrapeModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Scrape Historical Data
                </h2>
                <button
                  onClick={() => setShowScrapeModal(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Symbols <span className="text-red-500">*</span>
                  </label>

                  {/* Selected symbols display */}
                  {selectedSymbols.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedSymbols.map(symbolId => {
                        const stock = selectedSymbolsData.find(s => s._id === symbolId) ||
                          scrapeSearchResults.find(s => s._id === symbolId) ||
                          stocks.find(s => s._id === symbolId);
                        return stock ? (
                          <span key={symbolId} className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full text-sm font-medium">
                            {stock.symbol}
                            <button
                              type="button"
                              onClick={() => setSelectedSymbols(selectedSymbols.filter(id => id !== symbolId))}
                              className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-200"
                            >
                              ✕
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* Dropdown trigger */}
                  <div className="relative" id="scrape-dropdown">
                    <button
                      type="button"
                      onClick={() => setScrapeDropdownOpen(!scrapeDropdownOpen)}
                      disabled={isScraping}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:opacity-50 text-left flex items-center justify-between"
                    >
                      <span>{selectedSymbols.length > 0 ? `${selectedSymbols.length} selected` : 'Search and select symbols...'}</span>
                      <svg className={`w-5 h-5 transition-transform ${scrapeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>

                    {/* Dropdown menu */}
                    {scrapeDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10">
                        {/* Search input */}
                        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                          <input
                            type="text"
                            placeholder="Search symbols..."
                            value={scrapeSymbolSearch}
                            onChange={(e) => handleScrapeSymbolSearch(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                            autoFocus
                          />
                        </div>

                        {/* Options list */}
                        <div className="max-h-64 overflow-y-auto">
                          {scrapeSearchLoading ? (
                            <div className="text-center py-4">
                              <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Searching...</p>
                            </div>
                          ) : (scrapeSearchResults.length === 0 && scrapeSymbolSearch.trim() !== '') ? (
                            <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No symbols found</p>
                          ) : (
                            <>
                              {/* Show selected symbols first */}
                              {selectedSymbols.length > 0 && (
                                <>
                                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 sticky top-0">
                                    SELECTED
                                  </div>
                                  {selectedSymbolsData.map(stock => (
                                    <label key={stock._id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition bg-cyan-50 dark:bg-cyan-900/20">
                                      <input
                                        type="checkbox"
                                        checked={true}
                                        onChange={(e) => {
                                          setSelectedSymbols(selectedSymbols.filter(id => id !== stock._id));
                                        }}
                                        className="w-4 h-4 cursor-pointer accent-cyan-500"
                                      />
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900 dark:text-white">{stock.symbol}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{stock.companyName}</div>
                                      </div>
                                    </label>
                                  ))}
                                  <div className="border-t border-gray-200 dark:border-gray-700"></div>
                                </>
                              )}

                              {/* Show search results or all stocks */}
                              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 sticky top-0">
                                {scrapeSymbolSearch.trim() ? 'SEARCH RESULTS' : 'ALL SYMBOLS'}
                              </div>
                              {(scrapeSearchResults.length > 0 ? scrapeSearchResults : stocks)
                                .filter(stock => !selectedSymbols.includes(stock._id))
                                .map(stock => (
                                  <label key={stock._id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition">
                                    <input
                                      type="checkbox"
                                      checked={false}
                                      onChange={(e) => {
                                        setSelectedSymbols([...selectedSymbols, stock._id]);
                                      }}
                                      className="w-4 h-4 cursor-pointer accent-cyan-500"
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900 dark:text-white">{stock.symbol}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">{stock.companyName}</div>
                                    </div>
                                  </label>
                                ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={scrapeStartDate}
                    onChange={(e) => setScrapeStartDate(e.target.value)}
                    disabled={isScraping}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:opacity-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={scrapeEndDate}
                    onChange={(e) => setScrapeEndDate(e.target.value)}
                    disabled={isScraping}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:opacity-50"
                    required
                  />
                </div>

                <div className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-lg p-3">
                  <p className="text-sm text-cyan-900 dark:text-cyan-300">
                    <span className="font-semibold">Note:</span> This will scrape historical OHLCV data for selected symbols from the date range above.
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={handleStartScraping}
                    disabled={isScraping || selectedSymbols.length === 0}
                    className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isScraping ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Scraping...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Start Scraping
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowScrapeModal(false);
                      setScrapeDropdownOpen(false);
                    }}
                    disabled={isScraping}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
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

