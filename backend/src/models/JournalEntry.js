/**
 * Journal Entry Model
 * One decision, not one number. Prices live here only for trades the ledger
 * doesn't own (e.g. a broker outside this app); P/L is always derived, never stored.
 */
import mongoose from 'mongoose';
import { EXCHANGE_CODES, DEFAULT_EXCHANGE, currencyOf } from '../config/exchanges.js';

export const SETUP_TYPES = ['breakout', 'reversal', 'pullback', 'trend', 'range', 'earnings', 'other'];
export const SETUP_QUALITIES = ['excellent', 'good', 'fair', 'poor'];

// The states that mean a fill actually happened, and so require entry details.
// Planned and cancelled both describe a level that was never entered - demanding
// an entry price for either makes the state impossible to record.
const ENTERED = new Set(['open', 'closed']);
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

/**
 * Orders targets nearest-first and renumbers their levels, so targets[0] is
 * always the one R:R is quoted against. A short's targets sit below its entry,
 * so for those nearest means the highest price. Mutates in place.
 */
export function orderTargets(targets, direction) {
    if (!targets?.length) return targets;
    targets.sort((a, b) => direction === 'short' ? b.price - a.price : a.price - b.price);
    targets.forEach((t, i) => { t.level = i + 1; });
    return targets;
}

/**
 * The first target sitting on the wrong side of entry, or null.
 *
 * A target is a profit objective: above entry on a long, below it on a short.
 * One on the wrong side would be flagged reached by the very next price poll,
 * and a false alert costs more than a rejected typo. Measured against the far
 * edge of a planned zone, since a target inside the band you are still waiting
 * to buy in is not a target either. Closed trades are left alone - history is
 * history, and re-validating it would block editing an old lesson.
 */
export function targetOnWrongSide({ state, direction, entryPrice, entryFrom, entryTo, targets }) {
    if (state === 'closed' || !targets?.length) return null;

    const bounds = [entryFrom, entryTo].filter(n => n != null);
    const reference = ENTERED.has(state) ? entryPrice
        : !bounds.length ? null
            : direction === 'short' ? Math.min(...bounds) : Math.max(...bounds);

    if (reference == null) return null;

    return targets.find(t => direction === 'short'
        ? t.price >= reference
        : t.price <= reference) || null;
}

const journalEntrySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Optional link to the portfolio this trade was booked in. Optional because
    // plenty of trades happen at a broker this app does not hold a ledger for.
    portfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        index: true
    },

    // The ledger rows this trade produced, once it is booked in a portfolio here.
    // Two named fields rather than an array: the journal records one entry and one
    // exit, so naming them makes minting the same leg twice impossible by
    // construction. While either is set, the ledger owns those numbers and the
    // matching fields below are read-only.
    entryTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },

    exitTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
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

    // How good the setup looked at the time, graded before the outcome is known.
    // A separate axis from setupType: this is quality, that is kind. Worth having
    // because "do my best-looking setups actually pay better" is answerable only
    // if the grade was recorded before you knew.
    //
    // No default on purpose. A default would grade every trade you never graded,
    // including the whole history, and the statistic would then claim a judgement
    // you never made.
    setupQuality: {
        type: String,
        enum: SETUP_QUALITIES
    },

    // Where the trade is in its life. A planned trade is a level being watched,
    // not a position: it has no fill yet, so the entry fields below are not
    // required until it opens.
    // Cancelled is a level that never triggered, or one you thought better of.
    // Worth keeping rather than deleting: how often a setup fails to trigger is
    // the kind of thing only a record can tell you.
    state: {
        type: String,
        enum: ['planned', 'open', 'closed', 'cancelled'],
        default: 'open',
        index: true
    },

    // ----- Entry -----
    // A price-action level is a band, not a number. Used while planned; the
    // actual fill lands in entryPrice once the trade opens.
    entryFrom: {
        type: Number,
        min: [0, 'Entry zone cannot be negative']
    },

    entryTo: {
        type: Number,
        min: [0, 'Entry zone cannot be negative']
    },

    // Set by the price poll when price trades into the zone. A flag, not an
    // action: whether to actually take the trade stays a decision.
    entryZoneHit: {
        type: Boolean,
        default: false
    },

    entryZoneHitDate: Date,

    entryDate: {
        type: Date,
        required: [function () { return ENTERED.has(this.state); }, 'Entry date is required'],
        index: true
    },

    entryPrice: {
        type: Number,
        required: [function () { return ENTERED.has(this.state); }, 'Entry price is required'],
        min: [0, 'Entry price cannot be negative']
    },

    quantity: {
        type: Number,
        required: [function () { return ENTERED.has(this.state); }, 'Quantity is required'],
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

    // Charged per leg, because they are. One combined figure meant closing a
    // booked trade billed the sell the buy's commission, and there was nowhere to
    // put the real number. Total cost is the sum of the two.
    fees: {
        type: Number,
        default: 0,
        min: [0, 'Fees cannot be negative']
    },

    exitFees: {
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

    // Set by the price poll when the stop level trades through.
    stopHit: {
        type: Boolean,
        default: false
    },

    stopHitDate: Date,

    // Staged take-profits. The single store for targets: a plannedTarget on the
    // way in is normalised into targets[0] below, so the two can never disagree.
    targets: [{
        _id: false,
        level: { type: Number, default: 1 },
        price: { type: Number, required: true, min: [0, 'Target cannot be negative'] },
        isHit: { type: Boolean, default: false },
        hitDate: Date
    }],

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
    timestamps: true,
    // plannedTarget and status are virtuals that callers already read, so they
    // have to survive serialisation.
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
});

journalEntrySchema.index({ user: 1, entryDate: -1 });
journalEntrySchema.index({ user: 1, symbol: 1 });
// The price poll scans by state, ignoring everything already closed.
journalEntrySchema.index({ state: 1, symbol: 1 });

// The lifecycle is stored, not inferred, because a planned trade looks exactly
// like an open one from the outside: neither has an exit.
journalEntrySchema.virtual('status').get(function () {
    return this.state;
});

// The single-target shorthand the entry form has always sent. Reading and
// writing it maps onto targets[0] so there is only ever one store.
journalEntrySchema.virtual('plannedTarget')
    .get(function () {
        return this.targets?.length ? this.targets[0].price : undefined;
    })
    .set(function (price) {
        if (price == null) {
            this.targets = [];
        } else if (this.targets?.length) {
            this.targets[0].price = price;
        } else {
            this.targets = [{ level: 1, price }];
        }
    });

journalEntrySchema.pre('save', function (next) {
    // A stop can't be recorded as placed if there was no stop level.
    if (this.stopPlaced && this.plannedStop == null) {
        return next(new Error('stopPlaced requires a plannedStop level'));
    }

    // An exit price closes the trade, and clearing it reopens one — the
    // behaviour update() has always relied on to correct a mistaken exit.
    // Planned is the one state an exit cannot coexist with.
    if (this.exitPrice != null) {
        this.state = 'closed';
    } else if (this.state === 'closed') {
        this.state = 'open';
    }

    orderTargets(this.targets, this.direction);

    const wrongSide = targetOnWrongSide(this);
    if (wrongSide) {
        return next(new Error(
            `Target ${wrongSide.price} is on the wrong side of entry for a ${this.direction} trade`
        ));
    }

    next();
});

export default mongoose.model('JournalEntry', journalEntrySchema);
