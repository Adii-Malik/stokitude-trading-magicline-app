import mongoose from 'mongoose';

const backtestResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  strategyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradingStrategy',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true
  },
  dateRange: {
    from: {
      type: Date,
      required: true
    },
    to: {
      type: Date,
      required: true
    }
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  performance: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  trades: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  error: {
    type: String
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
backtestResultSchema.index({ userId: 1, createdAt: -1 });
backtestResultSchema.index({ userId: 1, status: 1, createdAt: -1 });
backtestResultSchema.index({ strategyId: 1, createdAt: -1 });
backtestResultSchema.index({ userId: 1, symbol: 1, createdAt: -1 });

// Method to mark backtest as completed
backtestResultSchema.methods.markCompleted = function(performance, trades) {
  this.status = 'completed';
  this.performance = performance;
  this.trades = trades;
  this.completedAt = new Date();
  return this.save();
};

// Method to mark backtest as failed
backtestResultSchema.methods.markFailed = function(errorMessage) {
  this.status = 'failed';
  this.error = errorMessage;
  this.completedAt = new Date();
  return this.save();
};

// Static method to get user's backtest history
backtestResultSchema.statics.getUserHistory = function(userId, limit = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('strategyId', 'name pythonStrategy');
};

// Static method to get completed backtests
backtestResultSchema.statics.getCompletedBacktests = function(userId) {
  return this.find({ userId, status: 'completed' })
    .sort({ createdAt: -1 })
    .populate('strategyId', 'name pythonStrategy');
};

// Static method to get backtest by ID with validation
backtestResultSchema.statics.getByIdForUser = function(backtestId, userId) {
  return this.findOne({ _id: backtestId, userId })
    .populate('strategyId', 'name pythonStrategy pythonConfig');
};

// Virtual for duration
backtestResultSchema.virtual('duration').get(function() {
  if (this.completedAt && this.createdAt) {
    return Math.round((this.completedAt - this.createdAt) / 1000); // in seconds
  }
  return null;
});

// Virtual for date range days
backtestResultSchema.virtual('daysInRange').get(function() {
  if (this.dateRange && this.dateRange.from && this.dateRange.to) {
    const diff = this.dateRange.to - this.dateRange.from;
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }
  return null;
});

const BacktestResult = mongoose.model('BacktestResult', backtestResultSchema);

export default BacktestResult;
