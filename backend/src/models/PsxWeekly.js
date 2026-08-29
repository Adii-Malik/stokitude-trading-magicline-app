import mongoose from 'mongoose';

const psxWeeklySchema = new mongoose.Schema({
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  date: {
    type: Date,
    required: true,
    index: true,
    comment: 'Week start date'
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

/**
 * One index does the reading, one does the guarding.
 *
 * {symbol, date} unique is both: it stops a second bar landing on a date a
 * symbol already has - which is what the sync's upsert filters on - and, with
 * symbol matched for equality, it serves a sort on date in either direction.
 * Measured on the two real queries (a symbol's history newest-first, and the
 * performance chart's many-symbols-since-a-date): identical keys and documents
 * examined whether the planner used it or a dedicated descending index.
 *
 * So the descending twin was dropped, along with both stockId indexes - nothing
 * has ever queried these collections by stockId, only written it - and the bare
 * {symbol} index, which is a prefix of the compound and never adds anything.
 * That was 15.6 MB of 35.1 MB on psxdailies alone, and it grows with the board.
 *
 * {date} stays: it is the only way into a date range across every symbol, which
 * is what a sector view asks for.
 */
psxWeeklySchema.index({ symbol: 1, date: 1 }, { unique: true });

const PsxWeekly = mongoose.model('PsxWeekly', psxWeeklySchema);

export default PsxWeekly;
