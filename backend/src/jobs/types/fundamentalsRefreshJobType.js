/**
 * Fundamentals Refresh Job Type
 * Defines configuration for automated fundamental data refresh
 */
export default {
    type: 'fundamentalsRefresh',
    name: 'Fundamentals Data Refresh',
    description: 'Automatically refresh fundamental data for all active stocks using scrapers',
    category: 'data',
    icon: '📊',
    handler: 'fundamentalsRefreshJob', // Handler filename (without .js)

    parameters: [
        {
            name: 'batchSize',
            label: 'Batch Size',
            type: 'number',
            default: 10,
            min: 1,
            max: 50,
            description: 'Number of symbols to process at once',
            helpText: 'Smaller batches = slower but more reliable'
        },
        {
            name: 'delayBetweenBatches',
            label: 'Delay Between Batches (ms)',
            type: 'number',
            default: 5000,
            min: 1000,
            max: 60000,
            description: 'Delay to avoid overwhelming servers',
            helpText: 'Recommended: 5000ms (5 seconds)'
        },
        {
            name: 'refreshStaleOnly',
            label: 'Refresh Stale Data Only',
            type: 'boolean',
            default: true,
            description: 'Only refresh data older than maxAgeHours',
            helpText: 'Saves time and resources'
        },
        {
            name: 'maxAgeHours',
            label: 'Max Age (Hours)',
            type: 'number',
            default: 24,
            min: 1,
            max: 168,
            description: 'Consider data stale after this many hours',
            helpText: '24 hours recommended for daily refresh'
        },
        {
            name: 'notifyOnComplete',
            label: 'Notify on Completion',
            type: 'boolean',
            default: false,
            description: 'Send notification when job completes'
        }
    ],

    scheduleOptions: {
        supportedTypes: ['recurring', 'manual'],
        defaultType: 'recurring',
        defaultRecurring: {
            amount: 1,
            interval: 'days',
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Daily
            time: '02:00' // 2 AM PKT (off-peak)
        },
        respectMarketHours: false,
        skipWeekends: false,
        skipHolidays: false
    },

    execution: {
        timeout: 1800000, // 30 minutes
        retryEnabled: true,
        maxRetries: 2,
        retryDelay: 300000 // 5 minutes
    },

    monitoring: {
        trackDuration: true,
        trackMemory: true,
        logLevel: 'info'
    }
};
