/**
 * Log Cleanup
 *
 * Trims the job execution history. Two rules, and a row must fail both to go:
 * older than the retention window, and outside the newest hundred for its job.
 *
 * It used to offer a batch size and a switch for ServiceLog. The batch size was
 * never read - the delete has always been one query - and ServiceLog had no
 * writers and no rows, so both were settings for behaviour that did not exist.
 */

export default {
  type: 'log_cleanup',

  name: 'Log Cleanup',
  description: 'Trims job execution history, keeping the newest per job',
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
      description: 'Delete execution records older than this',
      helpText: 'A record still survives if it is among the newest kept per job'
    },
    {
      name: 'keepPerJob',
      label: 'Keep Per Job',
      type: 'number',
      default: 100,
      min: 10,
      max: 1000,
      required: false,
      description: 'Always keep this many of each job\'s newest records',
      helpText: 'So a job that runs weekly still has a history to read'
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
    timeout: 300000,  // 5 minutes; two indexed queries per job
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

