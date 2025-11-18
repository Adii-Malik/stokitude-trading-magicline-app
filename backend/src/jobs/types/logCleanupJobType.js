/**
 * Log Cleanup Job Type Definition
 * 
 * Automatically cleans up old logs to optimize database storage
 */

export default {
  type: 'log_cleanup',

  name: 'Log Cleanup',
  description: 'Removes old service logs and job execution logs to optimize database storage',
  category: 'maintenance',
  icon: '🧹',

  handler: 'logCleanupJob',

  parameters: [
    {
      name: 'retentionDays',
      label: 'Retention Days',
      type: 'number',
      default: 30,
      min: 7,
      max: 365,
      required: true,
      description: 'Keep logs for this many days',
      helpText: 'Logs older than this will be deleted (minimum 7 days)'
    },
    {
      name: 'batchSize',
      label: 'Batch Size',
      type: 'number',
      default: 1000,
      min: 100,
      max: 10000,
      required: false,
      description: 'Number of logs to delete per batch',
      helpText: 'Larger batches are faster but use more memory'
    },
    {
      name: 'cleanServiceLogs',
      label: 'Clean Service Logs',
      type: 'boolean',
      default: true,
      required: false,
      description: 'Delete old ServiceLog entries',
      helpText: 'Removes logs from legacy services'
    },
    {
      name: 'cleanJobExecutions',
      label: 'Clean Job Execution Logs',
      type: 'boolean',
      default: true,
      required: false,
      description: 'Delete old JobExecution entries',
      helpText: 'Removes old job execution history (keeps last 100 per job)'
    }
  ],

  scheduleOptions: {
    supportedTypes: ['recurring', 'manual'],
    defaultType: 'recurring',
    defaultRecurring: {
      amount: 1,
      interval: 'weeks',
      daysOfWeek: [0], // Sunday
      time: '02:00'  // 2:00 AM
    },
    respectMarketHours: false,
    skipWeekends: false,
    skipHolidays: false
  },

  execution: {
    timeout: 600000,  // 10 minutes
    retryEnabled: true,
    maxRetries: 2,
    retryDelayMinutes: 60,
    retryStrategy: 'fixed',
    concurrentExecutions: false
  },

  constraints: {
    maxInstances: 3,  // Allow multiple cleanup jobs with different configs
    requiresPythonCore: false
  },

  version: '1.0.0',
  author: 'system',
  tags: ['maintenance', 'cleanup', 'optimization']
};

