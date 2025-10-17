import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Edit2, 
  Trash2, 
  Upload, 
  Search, 
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  Target,
  ArrowUp,
  ArrowDown,
  Minus,
  Filter,
  Activity,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getTradePlans, 
  createTradePlan, 
  updateTradePlan, 
  deleteTradePlan, 
  uploadTradePlansCSV,
  getTradePlanStats,
  updateTradePlanStatus,
  clearAllTradePlans
} from '../services/tradePlans';
import { searchStocks } from '../services/stocks';
import socket from '../services/socket';

export default function TradePlans() {
  const { isAdmin } = useAuth();
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'historical'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    symbol: '',
    tradeType: 'buy',
    setupQuality: 'good',
    buyLevels: [
      { priceFrom: '', priceTo: '' },
      { priceFrom: '', priceTo: '' },
      { priceFrom: '', priceTo: '' }
    ],
    targetPrices: [
      { price: '' },
      { price: '' },
      { price: '' }
    ],
    stopLoss: '',
    analysis: ''
  });
  
  // Stock autocomplete
  const [stockSuggestions, setStockSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  
  // Message state
  const [message, setMessage] = useState(null);

  // Load trade calls
  useEffect(() => {
    loadPlans();
  }, [pagination.page, activeTab, searchQuery, statusFilter]);

  // Load stats
  useEffect(() => {
    loadStats();
  }, []);

  // Handle scroll to show/hide back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Listen for auto trade plan updates via Socket.IO
  useEffect(() => {
    const handleTradePlanUpdate = (data) => {
      console.log('📢 Trade plan update received:', data);
      
      if (data.updates) {
        const messages = [];
        if (data.updates.buyHits > 0) messages.push(`${data.updates.buyHits} buy level(s)`);
        if (data.updates.tpHits > 0) messages.push(`${data.updates.tpHits} target(s)`);
        if (data.updates.slHits > 0) messages.push(`${data.updates.slHits} stop loss(es)`);
        
        if (messages.length > 0) {
          showMessage(`🎯 Auto-check: ${messages.join(', ')} hit!`, 'success');
        }
      }
      
      // Reload plans and stats to show updates
      loadPlans();
      loadStats();
    };

    socket.on('tradePlanUpdate', handleTradePlanUpdate);

    return () => {
      socket.off('tradePlanUpdate', handleTradePlanUpdate);
    };
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        symbol: searchQuery,
        status: statusFilter,
        isActive: activeTab === 'active' ? 'true' : 'false'
      };
      
      const response = await getTradePlans(params);
      setPlans(response.data.plans);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading trade calls:', error);
      showMessage('Failed to load trade calls', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getTradePlanStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete ALL trade calls? This action cannot be undone!')) {
      return;
    }
    
    try {
      const response = await clearAllTradePlans();
      showMessage(response.message || 'All trade calls cleared successfully');
      loadPlans();
      loadStats();
    } catch (error) {
      console.error('Error clearing all trade calls:', error);
      showMessage(error.response?.data?.message || 'Failed to clear trade calls', 'error');
    }
  };


  const handleAdd = () => {
    setFormData({
      symbol: '',
      tradeType: 'buy',
      setupQuality: 'good',
      buyLevels: [
        { priceFrom: '', priceTo: '' },
        { priceFrom: '', priceTo: '' },
        { priceFrom: '', priceTo: '' }
      ],
      targetPrices: [
        { price: '' },
        { price: '' },
        { price: '' }
      ],
      stopLoss: '',
      analysis: ''
    });
    setShowAddModal(true);
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      symbol: plan.symbol,
      tradeType: plan.tradeType || 'buy',
      setupQuality: plan.setupQuality || 'good',
      buyLevels: plan.buyLevels && plan.buyLevels.length > 0 ? plan.buyLevels.map(bl => ({
        priceFrom: bl.priceFrom || '',
        priceTo: bl.priceTo || ''
      })) : [
        { priceFrom: '', priceTo: '' },
        { priceFrom: '', priceTo: '' },
        { priceFrom: '', priceTo: '' }
      ],
      targetPrices: plan.targetPrices && plan.targetPrices.length > 0 ? plan.targetPrices.map(tp => ({
        price: tp.price || ''
      })) : [
        { price: '' },
        { price: '' },
        { price: '' }
      ],
      stopLoss: plan.stopLoss?.price || plan.stopLoss || '',
      analysis: plan.analysis || ''
    });
    setShowEditModal(true);
  };

  const handleDelete = async (plan) => {
    if (!confirm(`Are you sure you want to delete trade call for ${plan.symbol}?`)) return;
    
    try {
      await deleteTradePlan(plan._id);
      showMessage(`Trade call for ${plan.symbol} deleted successfully`);
      loadPlans();
      loadStats();
    } catch (error) {
      console.error('Error deleting trade call:', error);
      showMessage(error.response?.data?.message || 'Failed to delete trade call', 'error');
    }
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.symbol || !formData.stopLoss) {
      showMessage('Symbol and Stop Loss are required', 'error');
      return;
    }
    
    // Filter out empty buy levels and target prices
    const buyLevels = formData.buyLevels.filter(bl => bl.priceFrom && bl.priceTo);
    const targetPrices = formData.targetPrices.filter(tp => tp.price);
    
    if (buyLevels.length === 0) {
      showMessage('At least one buy level is required', 'error');
      return;
    }
    
    if (targetPrices.length === 0) {
      showMessage('At least one target price is required', 'error');
      return;
    }
    
    try {
      const payload = {
        ...formData,
        buyLevels,
        targetPrices
      };
      await createTradePlan(payload);
      showMessage(`Trade call for ${formData.symbol} added successfully`);
      setShowAddModal(false);
      loadPlans();
      loadStats();
    } catch (error) {
      console.error('Error creating trade call:', error);
      showMessage(error.response?.data?.message || 'Failed to create trade call', 'error');
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.symbol || !formData.stopLoss) {
      showMessage('Symbol and Stop Loss are required', 'error');
      return;
    }
    
    // Filter out empty buy levels and target prices
    const buyLevels = formData.buyLevels.filter(bl => bl.priceFrom && bl.priceTo);
    const targetPrices = formData.targetPrices.filter(tp => tp.price);
    
    if (buyLevels.length === 0) {
      showMessage('At least one buy level is required', 'error');
      return;
    }
    
    if (targetPrices.length === 0) {
      showMessage('At least one target price is required', 'error');
      return;
    }
    
    try {
      const payload = {
        ...formData,
        buyLevels,
        targetPrices
      };
      await updateTradePlan(editingPlan._id, payload);
      showMessage(`Trade call for ${formData.symbol} updated successfully`);
      setShowEditModal(false);
      loadPlans();
    } catch (error) {
      console.error('Error updating trade call:', error);
      showMessage(error.response?.data?.message || 'Failed to update trade call', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadFile) {
      showMessage('Please select a CSV file', 'error');
      return;
    }
    
    try {
      const response = await uploadTradePlansCSV(uploadFile);
      setUploadResult(response.data);
      showMessage(`Successfully uploaded ${response.data.total} trade calls`);
      setUploadFile(null);
      loadPlans();
      loadStats();
    } catch (error) {
      console.error('Error uploading CSV:', error);
      showMessage(error.response?.data?.message || 'Failed to upload CSV', 'error');
    }
  };

  // Stock symbol autocomplete
  const handleSymbolChange = async (value) => {
    setFormData({ ...formData, symbol: value.toUpperCase() });
    
    if (value.length >= 1) {
      try {
        const response = await searchStocks(value);
        setStockSuggestions(response.data);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error searching stocks:', error);
      }
    } else {
      setStockSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectStock = (stock) => {
    setFormData({ ...formData, symbol: stock.symbol });
    setShowSuggestions(false);
  };

  // Get status badge color
  const getStatusBadge = (status) => {
    const badges = {
      active: { color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30', label: 'Active' },
      tp1_hit: { color: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30', label: 'TP1 Hit' },
      tp2_hit: { color: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30', label: 'TP2 Hit' },
      tp3_hit: { color: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30', label: 'TP3 Hit' },
      sl_hit: { color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30', label: 'SL Hit' },
      closed: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300', label: 'Closed' }
    };
    return badges[status] || badges.active;
  };

  return (
    <div>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Trade Signals</h1>
                <p className="text-gray-600 dark:text-gray-400">Monitor and manage trading calls</p>
              </div>
            </div>
            
            {isAdmin() && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Trade Call
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload CSV
                </button>
                {plans.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All Calls
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Message Banner */}
          {message && (
            <div className={`p-4 rounded-lg mb-4 flex items-start gap-3 ${
              message.type === 'success'
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

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">Active Calls</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.activePlans || 0}</div>
              </div>
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-green-200 dark:border-green-500/30 rounded-lg p-4">
                <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">Targets Hit</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {(stats.tpHits || 0)}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-red-200 dark:border-red-500/30 rounded-lg p-4">
                <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">SL Hit</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.slHit || 0}</div>
              </div>
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Calls</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalPlans || 0}</div>
              </div>
            </div>
          )}

          {/* Tabs and Search */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Tabs */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('active')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'active'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  Active Calls
                </button>
                <button
                  onClick={() => setActiveTab('historical')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'historical'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Historical
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
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
        </div>

        {/* Trade Calls List */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center shadow-md">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading trade calls...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center shadow-md">
            <Target className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No {activeTab === 'active' ? 'Active' : 'Historical'} Trade Calls
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery
                ? `No calls match "${searchQuery}"`
                : activeTab === 'active'
                ? 'No active trade calls at the moment'
                : 'No historical trade calls yet'
              }
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <TradePlanCard 
                key={plan._id} 
                plan={plan} 
                onEdit={handleEdit}
                onDelete={handleDelete}
                getStatusBadge={getStatusBadge}
                isAdmin={isAdmin()}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} plans
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

        {/* Add/Edit Modal */}
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full border border-gray-200 dark:border-gray-700 my-8">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {showAddModal ? 'Add New Trade Call' : 'Edit Trade Call'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setShowSuggestions(false);
                  }}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={showAddModal ? handleSubmitAdd : handleSubmitEdit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stock Symbol <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.symbol}
                      onChange={(e) => handleSymbolChange(e.target.value)}
                      onFocus={() => formData.symbol && setShowSuggestions(true)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                      required
                    />
                    {showSuggestions && stockSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {stockSuggestions.map((stock) => (
                          <button
                            key={stock._id}
                            type="button"
                            onClick={() => selectStock(stock)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                          >
                            <div className="font-bold text-cyan-600 dark:text-cyan-400">{stock.symbol}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{stock.companyName}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Trade Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.tradeType}
                      onChange={(e) => setFormData({ ...formData, tradeType: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                      required
                    >
                      <option value="buy">Buy</option>
                      <option value="short">Short Sell</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Trade Setup Quality
                  </label>
                  <select
                    value={formData.setupQuality}
                    onChange={(e) => setFormData({ ...formData, setupQuality: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  >
                    <option value="excellent">⭐ Excellent - Low Risk / High Reward (1:3+)</option>
                    <option value="good">✅ Good - Balanced Risk/Reward (1:2 to 1:2.5)</option>
                    <option value="fair">⚠️ Fair - Moderate Risk/Reward (1:1.5)</option>
                    <option value="poor">❌ Poor - High Risk / Low Reward (1:1 or worse)</option>
                  </select>
                </div>

                {/* Buy Levels */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Buy Levels (Price Ranges) <span className="text-red-500">*</span>
                  </label>
                  {formData.buyLevels.map((level, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder={`Level ${index + 1} From`}
                        value={level.priceFrom}
                        onChange={(e) => {
                          const newLevels = [...formData.buyLevels];
                          newLevels[index].priceFrom = e.target.value;
                          setFormData({ ...formData, buyLevels: newLevels });
                        }}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder={`Level ${index + 1} To`}
                        value={level.priceTo}
                        onChange={(e) => {
                          const newLevels = [...formData.buyLevels];
                          newLevels[index].priceTo = e.target.value;
                          setFormData({ ...formData, buyLevels: newLevels });
                        }}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition text-sm"
                      />
                    </div>
                  ))}
                </div>

                {/* Target Prices */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Prices <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {formData.targetPrices.map((target, index) => (
                      <input
                        key={index}
                        type="number"
                        step="0.01"
                        placeholder={`TP${index + 1}`}
                        value={target.price}
                        onChange={(e) => {
                          const newTargets = [...formData.targetPrices];
                          newTargets[index].price = e.target.value;
                          setFormData({ ...formData, targetPrices: newTargets });
                        }}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition text-sm"
                      />
                    ))}
                  </div>
                </div>

                {/* Stop Loss */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Stop Loss <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stopLoss}
                    onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                    required
                  />
                </div>
                
                {/* Analysis */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Analysis / Notes
                  </label>
                  <textarea
                    value={formData.analysis}
                    onChange={(e) => setFormData({ ...formData, analysis: e.target.value })}
                    rows="3"
                    placeholder="Technical analysis, chart patterns, reasoning..."
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
                  >
                    {showAddModal ? 'Add Trade Call' : 'Update Trade Call'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setShowSuggestions(false);
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upload Trade Calls CSV</h2>
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
                  <code className="text-sm text-cyan-800 dark:text-cyan-300 block mb-2">
                    Symbol,CompanyName,TradeType,SetupQuality,<br/>
                    Buy1_From,Buy1_To,Buy2_From,Buy2_To,Buy3_From,Buy3_To,<br/>
                    TP1,TP2,TP3,StopLoss,Analysis
                  </code>
                  <p className="text-xs text-cyan-700 dark:text-cyan-400">
                    • Symbol, at least one Buy Level, at least one TP, and StopLoss are required<br />
                    • Trade Type: buy or short (default: buy)<br />
                    • Setup Quality: excellent, good, fair, poor (default: good)
                  </p>
                </div>
                
                {uploadResult && (
                  <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/50 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 dark:text-green-400 mb-2">Upload Result:</h4>
                    <div className="text-sm text-green-800 dark:text-green-300 space-y-1">
                      <p>Total: {uploadResult.total}</p>
                      <p>Inserted: {uploadResult.inserted}</p>
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
      </div>
    </div>
  );
}

// Trade Call Card Component
function TradePlanCard({ plan, onEdit, onDelete, getStatusBadge, isAdmin }) {
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
  const statusBadge = getStatusBadge(plan.status);
  const stopLossPrice = plan.stopLoss?.price || plan.stopLoss;

  // Truncate analysis for display
  const analysisPreview = plan.analysis && plan.analysis.length > 100 
    ? plan.analysis.substring(0, 100) + '...' 
    : plan.analysis;
  const hasLongAnalysis = plan.analysis && plan.analysis.length > 100;

  return (
    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{plan.symbol}</h3>
            <span className={`px-2 py-1 rounded text-xs font-medium border ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            {plan.tradeType === 'short' && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
                Short Sell
              </span>
            )}
            {plan.setupQuality && (
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                plan.setupQuality === 'excellent' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30' :
                plan.setupQuality === 'good' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' :
                plan.setupQuality === 'fair' ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30' :
                'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30'
              }`}>
                {plan.setupQuality === 'excellent' ? '⭐ Excellent' :
                 plan.setupQuality === 'good' ? '✅ Good' :
                 plan.setupQuality === 'fair' ? '⚠️ Fair' : '❌ Poor'} Setup
              </span>
            )}
          </div>
          {plan.companyName && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{plan.companyName}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {plan.currentPrice && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border border-green-200 dark:border-green-500/30 rounded-lg">
                <Activity className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Current: Rs. {plan.currentPrice.toFixed(2)}
                </span>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Posted: {new Date(plan.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(plan)}
              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(plan)}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Buy Levels */}
      {plan.buyLevels && plan.buyLevels.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Buy Levels:</div>
          <div className="flex flex-wrap gap-2">
            {plan.buyLevels.map((level, index) => (
              <div 
                key={index}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  level.isHit 
                    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-500/30' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                }`}
              >
                <span className="text-xs opacity-75">L{level.level}: </span>
                {level.priceFrom.toFixed(2)} - {level.priceTo.toFixed(2)}
                {level.isHit && <CheckCircle className="w-3 h-3 inline ml-1" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Target Prices & Stop Loss */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {plan.targetPrices && plan.targetPrices.length > 0 && plan.targetPrices.map((tp, index) => (
          <div key={index}>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">TP{tp.level || index + 1}</div>
            <div className={`text-lg font-bold ${tp.isHit ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              {tp.price.toFixed(2)}
              {tp.isHit && <CheckCircle className="w-4 h-4 inline ml-1" />}
            </div>
          </div>
        ))}
        
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Stop Loss</div>
          <div className="text-lg font-bold text-red-600 dark:text-red-400">
            {stopLossPrice.toFixed(2)}
            {plan.stopLoss?.isHit && <span className="text-xs ml-1">✗ Hit</span>}
          </div>
        </div>
      </div>

      {/* Target Range */}
      {plan.shortTermTPRange && plan.shortTermTPRange.from && plan.shortTermTPRange.to && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
          <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">Target Range</div>
          <div className="text-sm font-bold text-blue-900 dark:text-blue-300">
            Rs. {plan.shortTermTPRange.from.toFixed(2)} - {plan.shortTermTPRange.to.toFixed(2)}
          </div>
        </div>
      )}

      {/* Analysis */}
      {plan.analysis && (
        <div className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">Analysis</div>
            {hasLongAnalysis && (
              <button
                onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                {isAnalysisExpanded ? (
                  <>
                    <span>Show Less</span>
                    <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>Read More</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-sm text-cyan-900 dark:text-cyan-300">
            {isAnalysisExpanded || !hasLongAnalysis ? plan.analysis : analysisPreview}
          </p>
        </div>
      )}
    </div>
  );
}

