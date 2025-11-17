/**
 * Signal Generation Job Type Definition
 * 
 * Generates trading signals for active strategies
 */

export default {
  type: 'signal_generation',
  
  name: 'Signal Generation',
  description: 'Generates trading signals for all active strategies',
  category: 'trading',
  icon: '🎯',
  
  handler: 'signalGenerationJob',
  
  parameters: [
    {
      name: 'onlyActiveStrategies',
      label: 'Only Active Strategies',
      type: 'boolean',
      default: true,
      description: 'Generate signals only for active strategies',
      helpText: 'Recommended: Keep enabled'
    },
    {
      name: 'batchSize',
      label: 'Batch Size',
      type: 'number',
      default: 20,
      min: 5,
      max: 100,
      description: 'Symbols to process per batch',
      helpText: 'Lower values for better progress tracking'
    },
    {
      name: 'saveToDatabase',
      label: 'Save to Database',
      type: 'boolean',
      default: true,
      description: 'Save generated signals to database',
      helpText: 'Should always be enabled for production'
    },
    {
      name: 'notifyUsers',
      label: 'Notify Users',
      type: 'boolean',
      default: true,
      description: 'Send notifications for new signals',
      helpText: 'Real-time notifications via Socket.IO'
    }
  ],
  
  scheduleOptions: {
    supportedTypes: ['recurring', 'once', 'manual'],
    defaultType: 'recurring',
    defaultRecurring: {
      amount: 1,
      interval: 'days',
      daysOfWeek: [1,2,3,4,5,6], // Mon-Sat
      time: '17:30'  // 5:30 PM PKT
    },
    respectMarketHours: false,  // Runs after market close
    skipWeekends: false,
    skipHolidays: true
  },
  
  execution: {
    timeout: 900000,  // 15 minutes
    retryEnabled: true,
    maxRetries: 2,
    retryDelayMinutes: 15,
    retryStrategy: 'fixed',
    concurrentExecutions: false
  },
  
  constraints: {
    maxInstances: 1,
    requiresPythonCore: true,
    requiresActiveStrategies: true
  },
  
  version: '1.0.0',
  author: 'system',
  tags: ['signals', 'strategies', 'trading']
};

