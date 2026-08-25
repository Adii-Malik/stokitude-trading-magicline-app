/**
 * Journal Settings
 *
 * The handful of things that are true across every trade, so they are answered
 * once here instead of on every form.
 *
 * One document per user, created on first read. There is deliberately very
 * little in it: a setting is only worth having when leaving it out would mean
 * asking the same question repeatedly.
 */
import mongoose from 'mongoose';
import { SEED_TRACKERS, SETUP_SUGGESTIONS } from './JournalEntry.js';

const journalSettingsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },

    /**
     * Which book a new trade logs against, per currency.
     *
     * One field could not answer this. A book holds a single currency, so a
     * default of "PSX Consolidated" opened every US trade on a book that could
     * not hold it - the picker then filtered it out and the trade started with
     * no book at all, which is the state that leaves it unsized and unjudged.
     *
     * Keyed by currency because that is what a book is exclusive to, and what
     * makes two of them incomparable in the first place.
     */
    defaultBooks: {
        type: Map,
        of: mongoose.Schema.Types.ObjectId,
        default: () => new Map()
    },

    // Set when the user would rather choose per trade. Kept separate from a null
    // default so that deleting a portfolio does not silently change the answer.
    askForBook: {
        type: Boolean,
        default: false
    },

    /**
     * The setups this user trades, named going in.
     *
     * setupType was free text with suggestions, typed at the moment of logging -
     * and it drifted on the third use: "reteset" sits in the book beside
     * "pullback" and would be its own row in any grouping forever. Naming them
     * here and tapping them after is the same guarantee the trackers give,
     * one moment earlier.
     */
    setups: {
        type: [{
            type: String,
            trim: true,
            maxlength: [40, 'A setup name cannot exceed 40 characters']
        }],
        default: () => [...SETUP_SUGGESTIONS]
    },

    /**
     * The things this user has decided to count about themselves.
     *
     * Named here, then tapped when closing a trade — never retyped, which is the
     * whole point: a list you author stays short and cannot drift into two
     * spellings of one habit. Empty is a valid state, and when it is empty the
     * close form stops asking altogether.
     */
    trackers: {
        type: [{
            type: String,
            trim: true,
            maxlength: [40, 'A tracker cannot exceed 40 characters']
        }],
        default: () => [...SEED_TRACKERS]
    }
}, { timestamps: true });

/** The settings for a user, created with the seed lists if absent. */
journalSettingsSchema.statics.forUser = async function (userId) {
    return this.findOneAndUpdate(
        { user: userId },
        { $setOnInsert: {
            user: userId,
            setups: [...SETUP_SUGGESTIONS],
            trackers: [...SEED_TRACKERS]
        } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
};

export default mongoose.model('JournalSettings', journalSettingsSchema);
