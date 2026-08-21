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
 * Idempotent: only touches what still holds the old shape.
 * Pass --dry to report without writing.
 */
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

    console.log(dry ? 'Dry run, nothing written.' : 'Done.');
    await mongoose.disconnect();
};

migrate().catch((err) => { console.error(err); process.exit(1); });
