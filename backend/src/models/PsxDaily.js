import mongoose from 'mongoose';

const psxDailySchema = new mongoose.Schema({
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
    index: true
  },
  open: {
    type: Number,
    required: true
  },
  high: {
    type: Number,
    required: true
  },
  low: {
    type: Number,
    required: true
  },
  close: {
    type: Number,
    required: true
  },
  adjClose: {
    type: Number,
    default: null
  },
  volume: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries by symbol and date
psxDailySchema.index({ symbol: 1, date: -1 });
psxDailySchema.index({ stockId: 1, date: -1 });

// Ensure unique date per symbol
psxDailySchema.index({ symbol: 1, date: 1 }, { unique: true });

const PsxDaily = mongoose.model('PsxDaily', psxDailySchema);

export default PsxDaily;
