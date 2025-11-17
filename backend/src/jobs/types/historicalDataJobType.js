/**
 * Historical Data Update Job Type Definition
 * 
 * Updates historical data for symbols (deprecated - use TradingView jobs instead)
 */

export default {
  type: 'historical_data',
  
  name: 'Historical Data Update (Deprecated)',
  description: 'Updates historical data from stockanalysis.com.pk - Use TradingView jobs instead',
  category: 'data',
  icon: '📚',
  
  handler: 'historicalDataJob',
  
  parameters: [
    {
      name: 'period',
      label: 'Period',
      type: 'select',
      default: '3M',
      options: [
        { value: '1M', label: '1 Month' },
        { value: '3M', label: '3 Months' },
        { value: '6M', label: '6 Months' },
        { value: '1Y', label: '1 Year' }
      ],
      description: 'How far back to fetch data',
      helpText: 'Recommended: 3 months for daily updates'
    },
    {
      name: 'updateType',
      label: 'Update Type',
      type: 'select',
      default: 'today_only',
      options: [
        { value: 'today_only', label: 'Today Only' },
        { value: 'full_period', label: 'Full Period' }
      ],
      description: 'What data to save',
      helpText: 'Today Only for daily updates, Full Period for backfill'
    }
  ],
  
  scheduleOptions: {
    supportedTypes: ['recurring', 'once', 'manual'],
    defaultType: 'manual',  // Deprecated, manual only recommended
    defaultRecurring: {
      amount: 1,
      interval: 'days',
      daysOfWeek: [1,2,3,4,5], // Mon-Fri
      time: '17:30'  // 5:30 PM PKT
    },
    respectMarketHours: false,
    skipWeekends: false,
    skipHolidays: true
  },
  
  execution: {
    timeout: 1800000,  // 30 minutes
    retryEnabled: true,
    maxRetries: 1,
    retryDelayMinutes: 60,
    retryStrategy: 'fixed',
    concurrentExecutions: false
  },
  
  constraints: {
    maxInstances: 1,
    deprecated: true,
    deprecationMessage: 'Use TradingView Daily/Weekly jobs instead for better reliability'
  },
  
  version: '1.0.0',
  author: 'system',
  tags: ['historical', 'deprecated']
};

