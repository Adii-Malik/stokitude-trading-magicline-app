import { 
  TrophyIcon, 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon 
} from '@heroicons/react/24/outline';

export default function PerformanceMetricsCard({ performance }) {
  if (!performance) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-600 dark:text-gray-400">No performance data available</p>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Total Return',
      value: `${performance.total_return_percent?.toFixed(2)}%`,
      subValue: `PKR ${performance.total_return?.toFixed(2)}`,
      color: performance.total_return_percent > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bgColor: performance.total_return_percent > 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900',
      icon: performance.total_return_percent > 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon,
      progress: Math.min(Math.abs(performance.total_return_percent), 100),
    },
    {
      label: 'Win Rate',
      value: `${performance.win_rate?.toFixed(2)}%`,
      subValue: `${performance.winning_trades}/${performance.total_trades} trades`,
      color: performance.win_rate >= 60 ? 'text-green-600 dark:text-green-400' : performance.win_rate >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
      bgColor: performance.win_rate >= 60 ? 'bg-green-100 dark:bg-green-900' : performance.win_rate >= 50 ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-red-100 dark:bg-red-900',
      icon: TrophyIcon,
      progress: performance.win_rate,
    },
    {
      label: 'Profit Factor',
      value: performance.profit_factor?.toFixed(2),
      subValue: performance.profit_factor >= 2 ? 'Excellent' : performance.profit_factor >= 1.5 ? 'Good' : performance.profit_factor >= 1 ? 'Fair' : 'Poor',
      color: performance.profit_factor >= 2 ? 'text-green-600 dark:text-green-400' : performance.profit_factor >= 1.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
      bgColor: performance.profit_factor >= 2 ? 'bg-green-100 dark:bg-green-900' : performance.profit_factor >= 1.5 ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-red-100 dark:bg-red-900',
      icon: ChartBarIcon,
      progress: Math.min((performance.profit_factor / 3) * 100, 100),
    },
    {
      label: 'Sharpe Ratio',
      value: performance.sharpe_ratio?.toFixed(2),
      subValue: performance.sharpe_ratio >= 2 ? 'Excellent' : performance.sharpe_ratio >= 1 ? 'Good' : performance.sharpe_ratio >= 0 ? 'Fair' : 'Poor',
      color: performance.sharpe_ratio >= 2 ? 'text-green-600 dark:text-green-400' : performance.sharpe_ratio >= 1 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
      bgColor: performance.sharpe_ratio >= 2 ? 'bg-green-100 dark:bg-green-900' : performance.sharpe_ratio >= 1 ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-red-100 dark:bg-red-900',
      icon: ChartBarIcon,
      progress: Math.min((performance.sharpe_ratio / 3) * 100, 100),
    },
    {
      label: 'Max Drawdown',
      value: `${performance.max_drawdown?.toFixed(2)}%`,
      subValue: performance.max_drawdown < 10 ? 'Excellent' : performance.max_drawdown < 20 ? 'Good' : performance.max_drawdown < 30 ? 'Fair' : 'Poor',
      color: performance.max_drawdown < 10 ? 'text-green-600 dark:text-green-400' : performance.max_drawdown < 20 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
      bgColor: performance.max_drawdown < 10 ? 'bg-green-100 dark:bg-green-900' : performance.max_drawdown < 20 ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-red-100 dark:bg-red-900',
      icon: ArrowTrendingDownIcon,
      progress: Math.min(performance.max_drawdown, 100),
    },
    {
      label: 'Total Trades',
      value: performance.total_trades,
      subValue: `${performance.winning_trades} wins, ${performance.losing_trades} losses`,
      color: 'text-gray-900 dark:text-white',
      bgColor: 'bg-gray-100 dark:bg-gray-700',
      icon: ChartBarIcon,
      progress: 100,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Performance Metrics
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                    <Icon className={`w-5 h-5 ${metric.color}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {metric.label}
                  </span>
                </div>
              </div>
              
              <div>
                <p className={`text-2xl font-bold ${metric.color}`}>
                  {metric.value}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {metric.subValue}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    metric.color.includes('green') ? 'bg-green-600' :
                    metric.color.includes('yellow') ? 'bg-yellow-600' :
                    metric.color.includes('red') ? 'bg-red-600' :
                    'bg-gray-600'
                  }`}
                  style={{ width: `${metric.progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Initial Capital</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              PKR {performance.initial_capital?.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Final Equity</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              PKR {performance.final_equity?.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Win</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              {((performance.total_return / performance.winning_trades) || 0).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Loss</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
              {((performance.total_return / performance.losing_trades) || 0).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
