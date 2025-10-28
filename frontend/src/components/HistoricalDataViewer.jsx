import { useState, useEffect } from 'react';
import { ArrowLeft, Download, BarChart3, Calendar, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { getHistoricalData } from '../services/historical';

export default function HistoricalDataViewer() {
  const { symbol } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('daily');
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [message, setMessage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [jumpToPage, setJumpToPage] = useState('');

  useEffect(() => {
    fetchHistoricalData();
  }, [symbol, timeframe, pagination.page, pagination.limit, startDate, endDate]);

  const fetchHistoricalData = async () => {
    try {
      setLoading(true);
      const skip = (pagination.page - 1) * pagination.limit;
      const params = {
        timeframe,
        limit: pagination.limit,
        skip
      };

      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const result = await getHistoricalData(symbol, params);

      if (!result.success) {
        setMessage({ text: result.message || 'Failed to load data', type: 'error' });
        setData([]);
        return;
      }

      setData(result.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: result.data.pagination?.total || 0,
        pages: result.data.pagination?.pages || 0
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ text: error.response?.data?.message || 'Failed to load historical data', type: 'error' });
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    try {
      setDownloading(true);

      // Generate CSV content
      const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'];
      const rows = data.map(row => [
        new Date(row.date || row.weekStart || row.monthStart).toISOString().split('T')[0],
        row.open || '',
        row.high || '',
        row.low || '',
        row.close || '',
        row.volume || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${symbol}_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({ text: 'CSV downloaded successfully', type: 'success' });
    } catch (error) {
      console.error('Error downloading:', error);
      setMessage({ text: 'Failed to download CSV', type: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageSizeChange = (newLimit) => {
    setPagination(prev => ({
      ...prev,
      limit: parseInt(newLimit),
      page: 1
    }));
  };

  const handleJumpToPage = (e) => {
    e.preventDefault();
    const pageNum = parseInt(jumpToPage);
    if (pageNum >= 1 && pageNum <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: pageNum }));
      setJumpToPage('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/stocks')}
            className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Back to Stock Management</span>
          </button>

          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Historical Data: {symbol}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                View and download OHLCV data
              </p>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 transition-all ${message.type === 'success'
            ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/50 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-400'
            }`}>
            <span className="flex-1">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-current hover:opacity-70"
            >
              ✕
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 shadow-md">
          <div className="flex flex-col gap-6">

            {/* Top Row: Timeframe & Download */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Timeframe Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timeframe
                </label>
                <div className="flex gap-2">
                  {['daily', 'weekly', 'monthly'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => handleTimeframeChange(tf)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${timeframe === tf
                        ? 'bg-cyan-500 text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                      {tf.charAt(0).toUpperCase() + tf.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownloadCSV}
                disabled={downloading || data.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                <Download className="w-4 h-4" />
                {downloading ? 'Downloading...' : 'Download CSV'}
              </button>
            </div>

            {/* Bottom Row: Date Range Filters */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    max={endDate || undefined}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    min={startDate || undefined}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
              {(startDate || endDate) && (
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {startDate && endDate
                    ? `Showing data from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
                    : startDate
                      ? `Showing data from ${new Date(startDate).toLocaleDateString()} onwards`
                      : `Showing data up to ${new Date(endDate).toLocaleDateString()}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-md">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading historical data...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No Data Available
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                No historical data found for {symbol} in {timeframe} timeframe
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Open
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        High
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Low
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Close
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Volume
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-gray-900 dark:text-gray-300">
                            {new Date(row.date || row.weekStart || row.monthStart).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 dark:text-gray-300">
                          {row.open ? parseFloat(row.open).toFixed(2) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 dark:text-gray-300">
                          {row.high ? parseFloat(row.high).toFixed(2) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 dark:text-gray-300">
                          {row.low ? parseFloat(row.low).toFixed(2) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                            {row.close ? parseFloat(row.close).toFixed(2) : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-400 text-sm">
                          {row.volume ? row.volume.toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Left: Info & Rows per page */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {data.length > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
                    </div>

                    {/* Rows per page */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        Rows per page:
                      </label>
                      <select
                        value={pagination.limit}
                        onChange={(e) => handlePageSizeChange(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                      >
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="250">250</option>
                        <option value="500">500</option>
                      </select>
                    </div>
                  </div>

                  {/* Right: Controls */}
                  {pagination.pages > 1 && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                      {/* Jump to page */}
                      <form onSubmit={handleJumpToPage} className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Go to:</span>
                        <input
                          type="number"
                          min="1"
                          max={pagination.pages}
                          value={jumpToPage}
                          onChange={(e) => setJumpToPage(e.target.value)}
                          placeholder={`${pagination.page}`}
                          className="w-20 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <button
                          type="submit"
                          disabled={!jumpToPage || parseInt(jumpToPage) < 1 || parseInt(jumpToPage) > pagination.pages}
                          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Go
                        </button>
                      </form>

                      {/* Navigation buttons */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
                          disabled={pagination.page === 1}
                          className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="First page"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                          disabled={pagination.page === 1}
                          className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Previous page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium text-sm flex items-center">
                          {pagination.page} / {pagination.pages}
                        </span>
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                          disabled={pagination.page >= pagination.pages}
                          className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Next page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, page: pagination.pages }))}
                          disabled={pagination.page >= pagination.pages}
                          className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Last page"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
