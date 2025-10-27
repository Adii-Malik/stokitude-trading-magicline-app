import { useState, useEffect } from 'react';
import { ArrowLeft, Download, BarChart3, Calendar } from 'lucide-react';
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

  useEffect(() => {
    fetchHistoricalData();
  }, [symbol, timeframe, pagination.page, startDate, endDate]);

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

      // Filter data client-side if dates are set (backend might not support date filtering yet)
      let filteredData = result.data.data || [];
      if (startDate || endDate) {
        filteredData = filteredData.filter(row => {
          const rowDate = new Date(row.date || row.weekStart || row.monthStart);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;

          if (start && rowDate < start) return false;
          if (end && rowDate > end) return false;
          return true;
        });
      }

      setData(filteredData);
      setPagination(prev => ({
        ...prev,
        total: result.data.pagination?.total || 0,
        pages: Math.ceil((result.data.pagination?.total || 0) / pagination.limit)
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
              {pagination.pages > 1 && (
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing page {pagination.page} of {pagination.pages} ({pagination.total} total records)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">
                      Page {pagination.page}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                      disabled={pagination.page >= pagination.pages}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
