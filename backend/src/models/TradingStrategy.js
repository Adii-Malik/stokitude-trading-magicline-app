import mongoose from 'mongoose';

const tradingStrategySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  pythonStrategy: {
    type: String,
    required: true,
    trim: true
  },
  pythonConfig: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: false,
    index: true
  },
  lastBacktestDate: {
    type: Date
  },
  lastSignalDate: {
    type: Date
  },
  performance: {
    winRate: Number,
    profitFactor: Number,
    sharpeRatio: Number,
    totalReturn: Number,
    maxDrawdown: Number
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
tradingStrategySchema.index({ userId: 1, isActive: 1 });
tradingStrategySchema.index({ userId: 1, createdAt: -1 });

// Virtual for strategy display name
tradingStrategySchema.virtual('displayName').get(function () {
  return `${this.name} (${this.pythonStrategy})`;
});

// Method to update performance metrics
tradingStrategySchema.methods.updatePerformance = function (performanceData) {
  this.performance = {
    winRate: performanceData.win_rate,
    profitFactor: performanceData.profit_factor,
    sharpeRatio: performanceData.sharpe_ratio,
    totalReturn: performanceData.total_return_percent,
    maxDrawdown: performanceData.max_drawdown
  };
  this.lastBacktestDate = new Date();
  return this.save();
};


// Static method to get active strategies for a user
tradingStrategySchema.statics.getActiveStrategies = function (userId) {
  return this.find({ userId, isActive: true }).sort({ createdAt: -1 });
};

// Static method to get all strategies for a user
tradingStrategySchema.statics.getUserStrategies = function (userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

const TradingStrategy = mongoose.model('TradingStrategy', tradingStrategySchema);

export default TradingStrategy;
