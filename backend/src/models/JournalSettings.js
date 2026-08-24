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
import { SEED_TRACKERS } from './JournalEntry.js';

const journalSettingsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },

    // Which book a new trade logs against. Its risk rules are the ones the size
    // calculator applies, which is why this is not merely a convenience: picking
    // the wrong book silently sizes the trade against the wrong capital.
    defaultPortfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio'
    },

    // Set when the user would rather choose per trade. Kept separate from a null
    // default so that deleting a portfolio does not silently change the answer.
    askForBook: {
        type: Boolean,
        default: false
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

/** The settings for a user, created with the seed trackers if absent. */
journalSettingsSchema.statics.forUser = async function (userId) {
    return this.findOneAndUpdate(
        { user: userId },
        { $setOnInsert: { user: userId, trackers: [...SEED_TRACKERS] } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
};

export default mongoose.model('JournalSettings', journalSettingsSchema);
