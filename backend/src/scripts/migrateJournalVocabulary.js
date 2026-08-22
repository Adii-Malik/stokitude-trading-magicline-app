import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';

/**
 * Rewrites the fixed vocabularies into the words a person would use.
 *
 * Reasons were an eight-value enum stored as codes; they are free text now, so
 * `no_stop_placed` has to become `no stop placed` or the suggestions list shows
 * snake_case forever. setupType defaulted to 'other' on every entry that was
 * never given one, which reads like an answer when it is the absence of one.
 *
 * Also renames `mistakes` to `whatHappened`. The field holds how a trade was got
 * out of as well as anything the trader would rather have done differently, and
 * "target hit" is not a mistake - a name that has to be explained away is one
 * that will mislead whoever reads the code next.
 *
 * Idempotent: only touches what still holds the old shape.
 * Pass --dry to report without writing.
 */
// The first vocabulary was three words I guessed. This one is the trader's,
// grouped by how the tags behave, so the old wording is brought onto it.
const RETAGS = {
    'no stop placed': 'no stop',
    'held through event': 'held through events',
    'thesis broke': 'thesis broken',
    'trailed out': 'trailing stop',
    'took some off': 'scaled out',
    'ran out of patience': 'lost patience',
    'time stop': 'time exit',
    'chased the move': 'fomo exit',
    'position too large': 'oversized',
    'exited early': 'premature exit',
    'moved my stop': 'moved stop'
};

const REASONS = {
    no_stop_placed: 'no stop placed',
    held_through_event: 'held through event',
    no_profit_protection: 'no profit protection',
    moved_stop_down: 'moved my stop',
    oversized: 'position too large',
    fomo_entry: 'chased the move',
    no_thesis: 'no thesis',
    exited_early: 'exited early'
};

const migrate = async () => {
    const dry = process.argv.includes('--dry');
    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}`);

    const entries = mongoose.connection.db.collection('journalentries');

    const coded = await entries.find({ mistakes: { $in: Object.keys(REASONS) } }).toArray();
    console.log(`  ${coded.length} entries with coded reasons`);
    if (!dry) {
        for (const e of coded) {
            await entries.updateOne({ _id: e._id }, {
                $set: { mistakes: (e.mistakes || []).map(m => REASONS[m] || m) }
            });
        }
    }

    // 'other' was the default, so it marks trades never categorised, not a category.
    const other = await entries.countDocuments({ setupType: 'other' });
    console.log(`  ${other} entries defaulted to setupType "other"`);
    if (!dry && other) await entries.updateMany({ setupType: 'other' }, { $unset: { setupType: '' } });

    const dropped = await entries.countDocuments({
        $or: [{ stopPlaced: { $exists: true } }, { eventChecked: { $exists: true } }, { markPrice: { $exists: true } }, { setupQuality: { $exists: true } }]
    });
    console.log(`  ${dropped} entries carrying removed fields`);
    if (!dry && dropped) {
        await entries.updateMany({}, { $unset: { stopPlaced: '', eventChecked: '', markPrice: '', setupQuality: '' } });
    }

    const stale = await entries.find({ whatHappened: { $in: Object.keys(RETAGS) } }).toArray();
    console.log(`  ${stale.length} entries on the older tag wording`);
    if (!dry) {
        for (const e of stale) {
            await entries.updateOne({ _id: e._id }, {
                $set: { whatHappened: [...new Set((e.whatHappened || []).map(t => RETAGS[t] || t))] }
            });
        }
    }

    const named = await entries.countDocuments({ mistakes: { $exists: true } });
    console.log(`  ${named} entries with the old "mistakes" field`);
    if (!dry && named) await entries.updateMany({}, { $rename: { mistakes: 'whatHappened' } });

    console.log(dry ? 'Dry run, nothing written.' : 'Done.');
    await mongoose.disconnect();
};

migrate().catch((err) => { console.error(err); process.exit(1); });
