import mongoose from 'mongoose';

const tradingSignalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  signalType: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL'],
    index: true
  },
  price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  strategyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradingStrategy',
    required: true,
    index: true
  },
  strategyName: {
    type: String,
    required: true
  },
  indicators: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  reasoning: {
    type: String
  },
  source: {
    type: String,
    default: 'python_service'
  },
  isExecuted: {
    type: Boolean,
    default: false,
    index: true
  },
  executedAt: {
    type: Date
  },
  executedPrice: {
    type: Number
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
tradingSignalSchema.index({ userId: 1, createdAt: -1 });
tradingSignalSchema.index({ userId: 1, symbol: 1, createdAt: -1 });
tradingSignalSchema.index({ userId: 1, isExecuted: 1, createdAt: -1 });
tradingSignalSchema.index({ strategyId: 1, createdAt: -1 });

// Method to mark signal as executed
tradingSignalSchema.methods.markExecuted = function(executedPrice) {
  this.isExecuted = true;
  this.executedAt = new Date();
  this.executedPrice = executedPrice || this.price;
  return this.save();
};

// Static method to get recent signals for a user
tradingSignalSchema.statics.getRecentSignals = function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('strategyId', 'name pythonStrategy');
};

// Static method to get pending signals
tradingSignalSchema.statics.getPendingSignals = function(userId) {
  return this.find({ userId, isExecuted: false })
    .sort({ createdAt: -1 })
    .populate('strategyId', 'name pythonStrategy');
};

// Static method to check if signal exists for today
tradingSignalSchema.statics.signalExistsToday = async function(userId, strategyId, symbol) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const count = await this.countDocuments({
    userId,
    strategyId,
    symbol,
    date: { $gte: today }
  });
  
  return count > 0;
};

const TradingSignal = mongoose.model('TradingSignal', tradingSignalSchema);

export default TradingSignal;
