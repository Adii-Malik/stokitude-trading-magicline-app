/**
 * A name you noticed, and what you noticed about it.
 *
 * The gap this fills sits upstream of the journal. A journal entry is a position
 * that exists - it demands an entry price, a quantity and a date, and its own
 * comment explains why watching a level was thrown out of it. What was missing
 * is the stage before that: the shortlist you build off the heatmap, walk away
 * from to analyse somewhere else, and come back to having forgotten why.
 *
 * So the record is an observation, not a ticker. A watchlist that stores only
 * the symbol tells you nothing on return; storing the sector, the period and the
 * number at the time is what lets the screen open with what has moved since.
 *
 * There is deliberately no listId. Naming lists - "daily", "monthly" - means
 * choosing one while capturing, and a choice at capture time is what stops you
 * capturing. The period is recorded from the board you were on, so the grouping
 * comes free and cannot be mis-filed. `tag` is the escape hatch for the rare
 * name that did not come from a heatmap at all: nullable, never asked for.
 */
import mongoose from 'mongoose';
import { marketScoped } from './plugins/marketScoped.js';
import { PERIODS } from '../services/sectorPerformance.js';

export const STATES = ['watching', 'dropped'];

/**
 * One visit to the chart.
 *
 * The screen this replaces treated a verdict as the end: you wrote a line and
 * the name left the queue. That is not how the work goes. Four times out of
 * five the answer is "not yet", and the name stays - so a look is an entry in a
 * log, not a closing statement, and a name accumulates them until it becomes a
 * trade or a dead idea.
 *
 * The chart is why this is worth keeping. A note says what you thought; the
 * picture says what you were looking at, with the lines you had drawn on it and
 * the date you drew them, which is the thing nobody can reconstruct six weeks
 * later.
 */
const lookSchema = new mongoose.Schema({
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: [280, 'A note cannot exceed 280 characters'] },
    chartUrl: { type: String, trim: true }
}, { _id: true });

const watchlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    symbol: {
        type: String,
        required: [true, 'Symbol is required'],
        uppercase: true,
        trim: true
    },

    // Snapshotted rather than joined. The scanner is a live feed and a name can
    // fall out of it - delisted, renamed, past the thousand-row cap - and a row
    // that cannot say what it is worse than one with a stale description.
    name: {
        type: String,
        trim: true,
        maxlength: [120, 'Name cannot exceed 120 characters']
    },

    // The sector as this app groups it, which on PSX is our own taxonomy rather
    // than TradingView's. Stored, not derived, so regrouping the board later
    // cannot silently re-file a flag you made under the old grouping.
    sector: {
        type: String,
        required: [true, 'Sector is required'],
        trim: true
    },

    // The board you were looking at. This is the field that does the work a
    // named list would: it decides the horizon band, the staleness window, and
    // which drift numbers are comparable with which.
    period: {
        type: String,
        required: [true, 'Period is required'],
        enum: PERIODS.map(p => p.id)
    },

    noticedAt: {
        type: Date,
        default: Date.now
    },

    // The two numbers that were on screen when you flagged it. Both are the
    // anchor for "since you noticed" - without them the return visit has nothing
    // to compare against, and they cost nothing because the board already had them.
    perfWhenNoticed: { type: Number },
    priceWhenNoticed: { type: Number },

    // Every visit, oldest first. What you thought, and what it looked like.
    looks: { type: [lookSchema], default: [] },

    /**
     * Two states, not three.
     *
     * `analysed` used to mean finished, which was the mistake: a name you looked
     * at and passed on for now is still being watched, and clearing it off the
     * list is what made every session start from nothing. So a name is either
     * being watched or it is dead. How long since you last looked is a date, not
     * a state, and the screen works it out.
     */
    state: {
        type: String,
        enum: STATES,
        default: 'watching'
    },

    // For a name that arrived from somewhere other than a sector board.
    tag: {
        type: String,
        trim: true,
        maxlength: [40, 'Tag cannot exceed 40 characters']
    }
}, {
    timestamps: true
});

// Written in one place, which already knows the market from the request, so
// there is no venue field to derive it from.
watchlistSchema.plugin(marketScoped({ from: null }));

/**
 * One live flag per name per period, and no more.
 *
 * The same symbol noticed on the weekly board and on the yearly board is two
 * different observations that belong in two different bands, so the period is
 * part of the key. Dropped rows are excluded: dropping a name and noticing it
 * again months later should make a fresh record, not resurrect an old verdict.
 */
watchlistSchema.index(
    { user: 1, market: 1, symbol: 1, period: 1 },
    { unique: true, partialFilterExpression: { state: 'watching' } }
);

/** When you last put eyes on it, or when you flagged it if you never have. */
watchlistSchema.virtual('lastLookAt').get(function () {
    if (!this.looks?.length) return this.noticedAt;
    return this.looks[this.looks.length - 1].at;
});

watchlistSchema.set('toJSON', { virtuals: true });
watchlistSchema.set('toObject', { virtuals: true });

/**
 * The screen's own query: everything still live, newest flag first.
 *
 * These two are the whole index list. Single-field indexes on symbol, sector,
 * state and noticedAt were the obvious thing to add and would earn nothing:
 * every query this collection ever sees is filtered by user and market first,
 * and both are already the leading keys here. An index that is never the
 * planner's choice is storage and write cost with no read to pay for it.
 */
watchlistSchema.index({ user: 1, market: 1, state: 1, noticedAt: -1 });

const Watchlist = mongoose.model('Watchlist', watchlistSchema);

export default Watchlist;
