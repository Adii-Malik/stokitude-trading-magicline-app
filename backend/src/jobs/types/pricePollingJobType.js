/**
 * Price Polling Job Type Definition
 * 
 * Defines the configuration and behavior for the Price Polling Service
 */

export default {
  // Unique identifier
  type: 'price_polling',
  
  // Display information
  name: 'Price Polling Service',
  description: 'Fetches real-time stock prices from PSX during market hours',
  category: 'data',
  icon: '💰',
  
  // Handler reference
  handler: 'pricePollingJob',
  
  // Configurable parameters for GUI
  // Note: Scheduling (interval/frequency) is handled by universal schedule system
  parameters: [
    {
      name: 'skipMarketCheck',
      label: 'Skip Market Hours Check',
      type: 'boolean',
      default: false,
      description: 'Fetch prices even when market is closed',
      helpText: 'Enable only for testing or special circumstances'
    },
    {
      name: 'batchSize',
      label: 'Batch Size',
      type: 'number',
      default: 50,
      min: 10,
      max: 200,
      required: true,
      description: 'Number of symbols to fetch per batch',
      helpText: 'Lower values are safer but slower'
    },
    {
      name: 'maxSymbols',
      label: 'Max Symbols Per Run',
      type: 'number',
      default: 0,
      min: 0,
      max: 500,
      description: 'Maximum symbols to process (0 = all)',
      helpText: 'Use for testing with limited symbols'
    }
  ],
  
  // Schedule options (Universal - same for all jobs)
  scheduleOptions: {
    supportedTypes: ['recurring', 'manual'],
    defaultType: 'recurring',
    defaultRecurring: {
      amount: 15,
      interval: 'minutes',
      daysOfWeek: [1,2,3,4,5], // Mon-Fri (market days)
      time: null  // Any time during the day
    },
    respectMarketHours: true,  // Should check if market is open
    skipWeekends: true,
    skipHolidays: true
  },
  
  // Execution settings
  execution: {
    timeout: 300000,  // 5 minutes
    retryEnabled: true,
    maxRetries: 3,
    retryDelayMinutes: 5,
    retryStrategy: 'exponential',
    concurrentExecutions: false  // Only one execution at a time
  },
  
  // Constraints
  constraints: {
    maxInstances: 1,  // Only one price polling job allowed
    requiresMarketData: true,
    requiresActiveStocks: true
  },
  
  // Metadata
  version: '1.0.0',
  author: 'system',
  tags: ['prices', 'real-time', 'psx']
};

