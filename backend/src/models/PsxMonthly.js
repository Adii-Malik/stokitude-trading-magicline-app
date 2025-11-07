import mongoose from 'mongoose';

const psxMonthlySchema = new mongoose.Schema({
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true,
    comment: 'Month start date'
  },
  open: {
    type: Number,
    required: true,
    comment: 'Adjusted open price'
  },
  high: {
    type: Number,
    required: true,
    comment: 'Adjusted high price'
  },
  low: {
    type: Number,
    required: true,
    comment: 'Adjusted low price'
  },
  close: {
    type: Number,
    required: true,
    comment: 'Adjusted close price (all OHLC are adjusted for dividends/splits)'
  },
  volume: {
    type: Number,
    required: true,
    comment: 'Trading volume (never adjusted)'
  }
}, {
  timestamps: true
});

// Compound index for efficient queries by symbol and date
psxMonthlySchema.index({ symbol: 1, date: -1 });
psxMonthlySchema.index({ stockId: 1, date: -1 });

// Ensure unique date per symbol
psxMonthlySchema.index({ symbol: 1, date: 1 }, { unique: true });

const PsxMonthly = mongoose.model('PsxMonthly', psxMonthlySchema);

export default PsxMonthly;
