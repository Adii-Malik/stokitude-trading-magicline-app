/**
 * TradingView Weekly/Monthly Update Job Type Definition
 * 
 * Updates weekly and monthly OHLCV data from TradingView
 */

export default {
  type: 'tradingview_weekly',
  
  name: 'TradingView Weekly/Monthly Updates',
  description: 'Updates weekly and monthly OHLCV data for all symbols from TradingView',
  category: 'data',
  icon: '📈',
  
  handler: 'tradingViewJob',
  
  parameters: [
    {
      name: 'timeframes',
      label: 'Timeframes',
      type: 'multiselect',
      default: ['weekly', 'monthly'],
      options: [
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' }
      ],
      required: true,
      description: 'Which timeframes to update',
      helpText: 'Both weekly and monthly recommended'
    },
    {
      name: 'lookbackWeeks',
      label: 'Lookback Weeks',
      type: 'number',
      default: 12,
      min: 4,
      max: 52,
      description: 'How many weeks of history to fetch',
      helpText: 'Recommended: 12 weeks'
    }
  ],
  
  scheduleOptions: {
    supportedTypes: ['recurring', 'once', 'manual'],
    defaultType: 'recurring',
    defaultRecurring: {
      amount: 1,
      interval: 'weeks',
      daysOfWeek: [6], // Saturday only
      time: '17:00'  // 5:00 PM PKT
    },
    respectMarketHours: false,
    skipWeekends: false,
    skipHolidays: false
  },
  
  execution: {
    timeout: 900000,  // 15 minutes
    retryEnabled: true,
    maxRetries: 2,
    retryDelayMinutes: 60,
    retryStrategy: 'fixed',
    concurrentExecutions: false
  },
  
  constraints: {
    maxInstances: 1,
    requiresPythonCore: true
  },
  
  version: '1.0.0',
  author: 'system',
  tags: ['ohlcv', 'weekly', 'monthly', 'tradingview']
};

