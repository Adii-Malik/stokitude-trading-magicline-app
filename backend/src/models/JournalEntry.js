/**
 * Journal Entry Model
 * One decision, not one number. Prices live here only for trades the ledger
 * doesn't own (e.g. a broker outside this app); P/L is always derived, never stored.
 */
import mongoose from 'mongoose';
import { EXCHANGE_CODES, DEFAULT_EXCHANGE, currencyOf } from '../config/exchanges.js';

export const SETUP_TYPES = ['breakout', 'reversal', 'pullback', 'trend', 'range', 'earnings', 'other'];
export const EMOTIONS = ['disciplined', 'confident', 'fearful', 'fomo', 'neutral', 'revenge'];
export const MARKET_CONDITIONS = ['bullish', 'bearish', 'sideways', 'volatile'];

// Process failures, kept separate from outcome. A trade can lose money with none
// of these set, and win with several.
export const MISTAKES = [
    'no_stop_placed',
    'held_through_event',
    'no_profit_protection',
    'moved_stop_down',
    'oversized',
    'fomo_entry',
    'no_thesis',
    'exited_early'
];

const journalEntrySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Optional link to the portfolio this trade was booked in.
    portfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        index: true
    },

    symbol: {
        type: String,
        required: [true, 'Symbol is required'],
        uppercase: true,
        trim: true,
        index: true
    },

    exchange: {
        type: String,
        enum: EXCHANGE_CODES,
        default: DEFAULT_EXCHANGE,
        uppercase: true
    },

    currency: {
        type: String,
        uppercase: true,
        default: function () { return currencyOf(this.exchange); }
    },

    direction: {
        type: String,
        enum: ['long', 'short'],
        default: 'long'
    },

    setupType: {
        type: String,
        enum: SETUP_TYPES,
        default: 'other'
    },

    // ----- Entry -----
    entryDate: {
        type: Date,
        required: [true, 'Entry date is required'],
        index: true
    },

    entryPrice: {
        type: Number,
        required: [true, 'Entry price is required'],
        min: [0, 'Entry price cannot be negative']
    },

    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0, 'Quantity cannot be negative']
    },

    // ----- Exit (absent while the trade is open) -----
    exitDate: Date,

    exitPrice: {
        type: Number,
        min: [0, 'Exit price cannot be negative']
    },

    // False means "this is my recollection, not a broker fill". Stats treat
    // unconfirmed trades separately rather than quietly trusting them.
    exitConfirmed: {
        type: Boolean,
        default: false
    },

    // Set when dates were reconstructed rather than taken from a statement.
    datesEstimated: {
        type: Boolean,
        default: false
    },

    fees: {
        type: Number,
        default: 0,
        min: [0, 'Fees cannot be negative']
    },

    // Hand-entered last price for an open trade. Not a live quote — it exists so
    // an open position can show where it stands until a US price source lands.
    markPrice: {
        type: Number,
        min: [0, 'Mark price cannot be negative']
    },

    // ----- The plan, recorded before the outcome is known -----
    plannedStop: {
        type: Number,
        min: [0, 'Stop cannot be negative']
    },

    plannedTarget: {
        type: Number,
        min: [0, 'Target cannot be negative']
    },

    // The distinction that matters: a stop you intended vs one resting at the broker.
    stopPlaced: {
        type: Boolean,
        default: false
    },

    // Earnings/event calendar checked before entry.
    eventChecked: {
        type: Boolean,
        default: false
    },

    // ----- Review -----
    emotionalState: {
        type: String,
        enum: EMOTIONS,
        default: 'neutral'
    },

    marketCondition: {
        type: String,
        enum: MARKET_CONDITIONS,
        default: 'sideways'
    },

    mistakes: [{
        type: String,
        enum: MISTAKES
    }],

    tags: [{
        type: String,
        trim: true
    }],

    notes: {
        type: String,
        maxlength: [2000, 'Notes cannot exceed 2000 characters']
    },

    lesson: {
        type: String,
        maxlength: [500, 'Lesson cannot exceed 500 characters']
    },

    reviewedAt: Date

}, {
    timestamps: true
});

journalEntrySchema.index({ user: 1, entryDate: -1 });
journalEntrySchema.index({ user: 1, symbol: 1 });

// An exit price closes the trade. The date may be unknown for older trades
// reconstructed from statements, which must not block recording the result.
journalEntrySchema.virtual('status').get(function () {
    return this.exitPrice != null ? 'closed' : 'open';
});

journalEntrySchema.pre('save', function (next) {
    // A stop can't be recorded as placed if there was no stop level.
    if (this.stopPlaced && this.plannedStop == null) {
        return next(new Error('stopPlaced requires a plannedStop level'));
    }
    next();
});

export default mongoose.model('JournalEntry', journalEntrySchema);
