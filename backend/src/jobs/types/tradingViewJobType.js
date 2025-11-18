/**
 * TradingView Data Update Job Type Definition
 * 
 * Universal job type for updating OHLCV data from TradingView
 * Users can configure any combination of timeframes
 */

export default {
  type: 'tradingview_update',

  name: 'TradingView Data Update',
  description: 'Updates OHLCV data for any timeframe(s) from TradingView',
  category: 'data',
  icon: '📊',

  handler: 'tradingViewJob',

  parameters: [
    {
      name: 'timeframes',
      label: 'Timeframes',
      type: 'multiselect',
      default: ['daily'],
      options: [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' }
      ],
      required: true,
      description: 'Select one or more timeframes to update',
      helpText: 'You can update multiple timeframes in one job'
    }
  ],

  scheduleOptions: {
    supportedTypes: ['recurring', 'manual'],
    defaultType: 'recurring',
    defaultRecurring: {
      amount: 1,
      interval: 'days',
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      time: '17:00'  // 5:00 PM PKT
    },
    respectMarketHours: false,  // Runs after market close
    skipWeekends: false,
    skipHolidays: true
  },

  execution: {
    timeout: 900000,  // 15 minutes
    retryEnabled: true,
    maxRetries: 2,
    retryDelayMinutes: 30,
    retryStrategy: 'fixed',
    concurrentExecutions: false
  },

  constraints: {
    maxInstances: 10,  // Allow multiple instances with different configs
    requiresPythonCore: true
  },

  version: '1.0.0',
  author: 'system',
  tags: ['ohlcv', 'tradingview', 'data']
};

