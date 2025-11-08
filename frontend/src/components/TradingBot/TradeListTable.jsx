import { useState } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

export default function TradeListTable({ trades }) {
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filter, setFilter] = useState('all'); // all, profitable, losing

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Trade List
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center py-8">
          No trades to display
        </p>
      </div>
    );
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredTrades = trades.filter(trade => {
    if (filter === 'profitable') return trade.profit_loss > 0;
    if (filter === 'losing') return trade.profit_loss < 0;
    return true;
  });

  const sortedTrades = [...filteredTrades].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === 'date') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUpIcon className="w-4 h-4 inline ml-1" />
    ) : (
      <ArrowDownIcon className="w-4 h-4 inline ml-1" />
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Trade List ({sortedTrades.length} trades)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              filter === 'all'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('profitable')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              filter === 'profitable'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Profitable
          </button>
          <button
            onClick={() => setFilter('losing')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              filter === 'losing'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Losing
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th
                className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-cyan-600"
                onClick={() => handleSort('date')}
              >
                Date <SortIcon field="date" />
              </th>
              <th
                className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-cyan-600"
                onClick={() => handleSort('type')}
              >
                Type <SortIcon field="type" />
              </th>
              <th
                className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-cyan-600"
                onClick={() => handleSort('price')}
              >
                Price <SortIcon field="price" />
              </th>
              <th
                className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-cyan-600"
                onClick={() => handleSort('shares')}
              >
                Shares <SortIcon field="shares" />
              </th>
              <th
                className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-cyan-600"
                onClick={() => handleSort('profit_loss')}
              >
                P/L <SortIcon field="profit_loss" />
              </th>
              <th
                className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-cyan-600"
                onClick={() => handleSort('profit_loss_percent')}
              >
                P/L % <SortIcon field="profit_loss_percent" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTrades.map((trade, index) => (
              <tr
                key={index}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                  {formatDate(trade.date)}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    trade.type === 'BUY'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {trade.type}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                  PKR {trade.price?.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                  {trade.shares?.toLocaleString()}
                </td>
                <td className={`py-3 px-4 text-sm text-right font-semibold ${
                  trade.profit_loss > 0
                    ? 'text-green-600 dark:text-green-400'
                    : trade.profit_loss < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {trade.profit_loss !== undefined
                    ? `PKR ${trade.profit_loss.toFixed(2)}`
                    : '-'}
                </td>
                <td className={`py-3 px-4 text-sm text-right font-semibold ${
                  trade.profit_loss_percent > 0
                    ? 'text-green-600 dark:text-green-400'
                    : trade.profit_loss_percent < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {trade.profit_loss_percent !== undefined
                    ? `${trade.profit_loss_percent.toFixed(2)}%`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Trades</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {sortedTrades.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Profitable</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              {sortedTrades.filter(t => t.profit_loss > 0).length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Losing</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
              {sortedTrades.filter(t => t.profit_loss < 0).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
