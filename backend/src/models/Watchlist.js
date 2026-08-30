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
 * There is deliberately no listId, and no per-timeframe split. Naming lists -
 * "daily", "monthly" - means choosing one while capturing, and a choice at
 * capture time is what stops you capturing. The period is recorded from the
 * board you were on as provenance; the stock is the unit. `tag` is the escape
 * hatch for the rare name that did not come from a heatmap at all: nullable,
 * never asked for.
 */
import mongoose from 'mongoose';
import { marketScoped } from './plugins/marketScoped.js';
import { PERIODS } from '../services/sectorPerformance.js';

export const STATES = ['watching', 'dropped', 'invalidated', 'traded'];

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
const levelSchema = new mongoose.Schema({
    price: { type: Number, required: true, min: [0, 'A price cannot be negative'] },
    // Which way price has to go to mean something. Never inferred from where
    // price happens to be today: a trigger set below the market is a perfectly
    // ordinary thing to want, and guessing would silently invert it.
    dir: { type: String, enum: ['above', 'below'], required: true }
}, { _id: false });

const lookSchema = new mongoose.Schema({
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: [280, 'A note cannot exceed 280 characters'] },
    chartUrl: { type: String, trim: true },
    // The levels as they stood at this look, so the thread shows what you were
    // waiting for at the time and not only what you are waiting for now.
    trigger: { type: levelSchema, default: null },
    invalidation: { type: levelSchema, default: null }
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

    /**
     * The board you found it on. Provenance, and nothing more.
     *
     * It used to be part of the identity - the same company noticed on the
     * monthly board and on the yearly one became two records - and that was
     * wrong. You do not hold a view on "the 1-month PRL"; you hold a view on
     * PRL, with one entry, one invalidation and one decision to buy or not.
     * Everything downstream already agrees: the broker has one position, the
     * journal one trade, the portfolio one holding.
     *
     * The test that settles it is what happens when the two disagree. A trigger
     * of 185 on one row and 210 on the other means the watcher tells you about
     * the same stock twice, with two numbers, and leaves you to reconcile them.
     * That is not two studies. It is one study stored badly.
     *
     * It still decides which drift column to read, which is the job it is good
     * at.
     */
    period: {
        type: String,
        required: [true, 'Period is required'],
        enum: PERIODS.map(p => p.id)
    },

    // The other boards it turned up on afterwards. Noticing a name again is
    // worth a word on the row, never a second row.
    alsoSeenOn: {
        type: [{ type: String, enum: PERIODS.map(p => p.id) }],
        default: []
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
     * What you are waiting for, right now.
     *
     * Mirrored from the most recent look that set one, rather than read out of
     * the array. The watcher runs over every live entry on every price update
     * and asks one question - has this price been crossed - so the answer has to
     * be a field it can filter on, not the last element of a subdocument list.
     *
     * Both are optional and most names will have neither. A trigger is a
     * convenience, not the point: the record is the point, and a name with no
     * levels still sits in the list and still holds its looks.
     */
    trigger: { type: levelSchema, default: null },

    /**
     * The price that would prove the idea wrong.
     *
     * This is the one that answers "how do I mark a name I am no longer
     * interested in". You do not, later, once you have forgotten why you cared -
     * you name it while you are still thinking clearly, and the watcher closes
     * the entry for you when price gets there.
     */
    invalidation: { type: levelSchema, default: null },

    // The trade this idea became, if it became one.
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },

    /**
     * When you last put a settled name back on the queue.
     *
     * The clock runs from your last look, which for a revived name is whenever
     * you last opened it - so a name you passed on in March came back overdue by
     * a hundred days the instant you asked to watch it again. Putting it back is
     * itself a fresh look: you decided just now that it was worth your time.
     * Kept apart from noticedAt because that date anchors perfWhenNoticed, and
     * moving it would make the drift lie.
     */
    resumedAt: { type: Date },

    /**
     * What the watcher saw, and when.
     *
     * The price is kept alongside the date because the notification is the only
     * other place it ever appears, and a notification is gone by morning. Two
     * days later "your level printed" is a much weaker sentence than "88.40
     * printed through the 88.00 you named" - and the second one you can check.
     */
    triggeredAt: { type: Date },
    triggeredPrice: { type: Number },
    invalidatedAt: { type: Date },
    invalidatedPrice: { type: Number },

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
 * One live flag per name. Not per name per board.
 *
 * Settled rows are excluded, so dropping a name and noticing it again months
 * later makes a fresh record rather than resurrecting an old verdict - and the
 * old thread still comes back beside it, read-only.
 */
watchlistSchema.index(
    { user: 1, market: 1, symbol: 1 },
    { unique: true, partialFilterExpression: { state: 'watching' } }
);

/**
 * The watcher's own query: live names carrying a level worth checking.
 *
 * Sparse, because most names will have neither level and there is no reason to
 * index a null for them - the whole point of the design is that a trigger is
 * the exception rather than the thing you are asked for.
 */
watchlistSchema.index(
    { state: 1, 'trigger.price': 1 },
    { partialFilterExpression: { state: 'watching' } }
);

/** A name still being watched is the only kind that can go stale and nag you. */
watchlistSchema.methods.isLive = function () {
    return this.state === 'watching';
};

/** When you last put eyes on it, or when you flagged it if you never have. */
watchlistSchema.virtual('lastLookAt').get(function () {
    const last = this.looks?.length ? this.looks[this.looks.length - 1].at : this.noticedAt;
    return this.resumedAt && this.resumedAt > last ? this.resumedAt : last;
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
