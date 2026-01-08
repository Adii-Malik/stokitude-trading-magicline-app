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
            default: 50,
            min: 10,
            max: 100,
            required: true,
            description: 'Number of symbols to process per batch',
            helpText: 'Lower values are safer but slower'
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
            name: 'maxSymbols',
            label: 'Max Symbols Per Run',
            type: 'number',
            default: 0,
            min: 0,
            max: 1000,
            description: 'Maximum symbols to process (0 = all)',
            helpText: 'Use for testing with limited symbols'
        }
    ],

    scheduleOptions: {
        supportedTypes: ['recurring', 'manual'],
        defaultType: 'recurring',
        defaultRecurring: {
            amount: 1,
            interval: 'weeks',
            daysOfWeek: [0], // Sunday only
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
