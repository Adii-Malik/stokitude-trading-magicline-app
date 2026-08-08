import mongoose from 'mongoose';

const serviceLogSchema = new mongoose.Schema({
    serviceName: {
        type: String,
        required: true,
        enum: [
            'pricePolling',
            'tradingViewScheduler',
            'tradingViewDaily',
            'tradingViewWeekly',
            'signalGenerationScheduler',
            'historicalDataDaily',
            'marketHoursCheck',
            'tradePlanHandler',
            'system'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: ['success', 'error', 'warning', 'info', 'started', 'stopped', 'skipped']
    },
    message: String,
    metadata: mongoose.Schema.Types.Mixed,
    duration: Number, // in milliseconds
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for quick queries
serviceLogSchema.index({ serviceName: 1, timestamp: -1 });
serviceLogSchema.index({ status: 1, timestamp: -1 });
serviceLogSchema.index({ timestamp: -1 });

// TTL index - auto-delete logs older than 30 days
serviceLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

export default mongoose.model('ServiceLog', serviceLogSchema);

