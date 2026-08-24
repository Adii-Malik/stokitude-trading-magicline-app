/**
 * Journal Entry Model
 * One decision, not one number. Prices live here only for trades the ledger
 * doesn't own (e.g. a broker outside this app); P/L is always derived, never stored.
 */
import mongoose from 'mongoose';
import { EXCHANGE_CODES, DEFAULT_EXCHANGE, currencyOf } from '../config/exchanges.js';

// Starting suggestions, not a constraint. Both of these are free text: a closed
// list can only hold the reasons someone thought of in advance, and the ones that
// matter are the ones you would not have listed. The UI suggests what you have
// used before, so a vocabulary emerges from your own trades and still counts.
export const SETUP_SUGGESTIONS = ['breakout', 'reversal', 'pullback', 'trend', 'range'];

/**
 * The few trackers a new journal starts with.
 *
 * Every one of these is something the app has no way of working out for itself:
 * whether you were late to the move, whether you were making back a loss,
 * whether you added to a loser, whether you sat through a result. Anything the
 * entry already records - no stop, size over the cap, an exit short of a target -
 * is measured from the data instead of asked for, which is what the long list of
 * suggestions this replaced got wrong.
 *
 * They seed a user's own list and can all be deleted. A tracker means nothing to
 * the system beyond a count and a total; nothing infers discipline from one.
 */
export const SEED_TRACKERS = [
    'chased the move',
    'revenge trade',
    'averaged down',
    'held through earnings'
];

export const EMOTIONS = ['disciplined', 'confident', 'fearful', 'fomo', 'neutral', 'revenge'];
export const MARKET_CONDITIONS = ['bullish', 'bearish', 'sideways', 'volatile'];

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
 * and a false alert costs more than a rejected typo. Closed trades are left
 * alone - history is history, and re-validating it would block editing an old
 * lesson.
 */
export function targetOnWrongSide({ state, direction, entryPrice, targets }) {
    if (state === 'closed' || !targets?.length || entryPrice == null) return null;

    return targets.find(t => direction === 'short'
        ? t.price >= entryPrice
        : t.price <= entryPrice) || null;
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
        trim: true,
        maxlength: [40, 'Setup name cannot exceed 40 characters']
    },

    // Where the trade is in its life. Only two states: a journal entry is a
    // position that exists. Watching a level was a fourth thing living in the
    // trade list - no fill, no P/L, no R - and it made every column mean two
    // things depending on the row. A broker's alerts do that job better.
    state: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open',
        index: true
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

    /**
     * The trackers ticked on this trade, from the list the user keeps in journal
     * settings. Named once, then tapped - never retyped, so two spellings of the
     * same habit can never split into two rows in a total.
     */
    whatHappened: [{
        type: String,
        trim: true,
        maxlength: [60, 'A note cannot exceed 60 characters']
    }],

    // The chart is the setup for a price-action trade, so it is kept with the
    // trade rather than described in prose. Stored as a path under /uploads; the
    // bytes stay on disk so a list query never drags images along with it.
    chartUrl: {
        type: String,
        trim: true
    },

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

// Kept as a virtual because every caller reads `status`, not `state`.
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
    // An exit price closes the trade, and clearing it reopens one — the
    // behaviour update() has always relied on to correct a mistaken exit.
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
