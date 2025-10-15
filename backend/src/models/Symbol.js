import mongoose from 'mongoose';

const symbolSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  originalSymbol: {
    type: String,
    required: true
  },
  magicLine: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    default: null
  },
  priceData: {
    market: String,
    st: String,
    price: Number,
    change: Number,
    changePercent: Number,
    volume: Number,
    trades: Number,
    value: Number,
    high: Number,
    low: Number,
    bid: Number,
    ask: Number,
    bidVol: Number,
    askVol: Number,
    timestamp: Number
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
symbolSchema.index({ symbol: 1 });
symbolSchema.index({ magicLine: 1 });

// Virtual field for checking if magic line is met
symbolSchema.virtual('isMet').get(function() {
  return this.currentPrice !== null && this.currentPrice >= this.magicLine;
});

// Ensure virtuals are included when converting to JSON
symbolSchema.set('toJSON', { virtuals: true });
symbolSchema.set('toObject', { virtuals: true });

const Symbol = mongoose.model('Symbol', symbolSchema);

export default Symbol;

