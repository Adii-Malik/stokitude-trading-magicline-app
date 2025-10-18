import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  sector: {
    type: String,
    trim: true,
    default: null
  },
  shariahCompliant: {
    type: String,
    enum: [null, 'Yes', 'No'],
    default: null
  },
  // Centralized price data (single source of truth)
  currentPrice: {
    type: Number,
    default: null
  },
  previousPrice: {
    type: Number,
    default: null
  },
  priceChange: {
    type: Number,
    default: null
  },
  priceChangePercent: {
    type: Number,
    default: null
  },
  // Daily trading data
  high: {
    type: Number,
    default: null
  },
  low: {
    type: Number,
    default: null
  },
  open: {
    type: Number,
    default: null
  },
  volume: {
    type: Number,
    default: null
  },
  lastUpdated: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Text index for search/autocomplete
stockSchema.index({ symbol: 'text', companyName: 'text' });

const Stock = mongoose.model('Stock', stockSchema);

export default Stock;

