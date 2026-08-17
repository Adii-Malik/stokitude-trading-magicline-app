import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';

/**
 * Backfills the journal lifecycle onto entries written before it existed.
 *
 * Two changes need it. `state` did not exist, and the schema default of 'open'
 * would otherwise be applied on hydration to closed trades too. `plannedTarget`
 * became a virtual over targets[], so its stored values have to be copied across
 * or they become unreachable.
 *
 * Runs through the driver rather than the model, because the model no longer has
 * a plannedTarget path to read the old value from.
 *
 * Idempotent: only touches documents still missing the new shape.
 * Pass --dry to report without writing.
 */
const migrate = async () => {
    const dry = process.argv.includes('--dry');

    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}`);

    const entries = mongoose.connection.collection('journalentries');

    const needsState = await entries.countDocuments({ state: { $exists: false } });
    const needsTargets = await entries.countDocuments({
        plannedTarget: { $ne: null, $exists: true },
        targets: { $in: [null, []] }
    });

    console.log(`  ${needsState} entries without state`);
    console.log(`  ${needsTargets} entries with a plannedTarget to move into targets[]`);

    if (dry) {
        console.log('Dry run, nothing written.');
        await mongoose.disconnect();
        return;
    }

    // An exit price is what closes a trade. Nothing pre-existing can be planned:
    // that state only exists from this change onward.
    const closed = await entries.updateMany(
        { state: { $exists: false }, exitPrice: { $ne: null, $exists: true } },
        { $set: { state: 'closed' } }
    );
    const open = await entries.updateMany(
        { state: { $exists: false } },
        { $set: { state: 'open' } }
    );

    // Copy each stored plannedTarget into targets[0]. One at a time because the
    // new value is derived from the old one, which a single updateMany cannot do
    // without an aggregation pipeline for a handful of rows.
    const toMove = await entries.find({
        plannedTarget: { $ne: null, $exists: true },
        targets: { $in: [null, []] }
    }).project({ plannedTarget: 1 }).toArray();

    for (const doc of toMove) {
        await entries.updateOne(
            { _id: doc._id },
            { $set: { targets: [{ level: 1, price: doc.plannedTarget, isHit: false }] } }
        );
    }

    // The old field is left in place. It costs nothing, and it is the only record
    // of what the value was if this migration turns out to be wrong.
    console.log(`Set state: ${closed.modifiedCount} closed, ${open.modifiedCount} open`);
    console.log(`Moved ${toMove.length} targets`);

    await mongoose.disconnect();
};

migrate().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
