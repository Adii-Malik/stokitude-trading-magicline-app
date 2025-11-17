/**
 * TradingView Daily Update Job Type Definition
 * 
 * Updates daily OHLCV data from TradingView
 */

export default {
  type: 'tradingview_daily',
  
  name: 'TradingView Daily Updates',
  description: 'Updates daily OHLCV data for all symbols from TradingView',
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
        { value: 'daily', label: 'Daily' }
      ],
      required: true,
      description: 'Which timeframes to update',
      helpText: 'Daily timeframe only for this job type'
    },
    {
      name: 'lookbackDays',
      label: 'Lookback Days',
      type: 'number',
      default: 7,
      min: 1,
      max: 365,
      description: 'How many days of history to fetch',
      helpText: 'Recommended: 7 days for daily updates'
    }
  ],
  
  scheduleOptions: {
    supportedTypes: ['recurring', 'once', 'manual'],
    defaultType: 'recurring',
    defaultRecurring: {
      amount: 1,
      interval: 'days',
      daysOfWeek: [1,2,3,4,5], // Mon-Fri
      time: '17:00'  // 5:00 PM PKT
    },
    respectMarketHours: false,  // Runs after market close
    skipWeekends: false,
    skipHolidays: true
  },
  
  execution: {
    timeout: 600000,  // 10 minutes
    retryEnabled: true,
    maxRetries: 2,
    retryDelayMinutes: 30,
    retryStrategy: 'fixed',
    concurrentExecutions: false
  },
  
  constraints: {
    maxInstances: 1,
    requiresPythonCore: true
  },
  
  version: '1.0.0',
  author: 'system',
  tags: ['ohlcv', 'daily', 'tradingview']
};

