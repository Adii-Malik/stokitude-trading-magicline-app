import mongoose from 'mongoose';

const psxWeeklySchema = new mongoose.Schema({
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
  weekStart: {
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
  volume: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries by symbol and week
psxWeeklySchema.index({ symbol: 1, weekStart: -1 });
psxWeeklySchema.index({ stockId: 1, weekStart: -1 });

// Ensure unique week per symbol
psxWeeklySchema.index({ symbol: 1, weekStart: 1 }, { unique: true });

const PsxWeekly = mongoose.model('PsxWeekly', psxWeeklySchema);

export default PsxWeekly;
