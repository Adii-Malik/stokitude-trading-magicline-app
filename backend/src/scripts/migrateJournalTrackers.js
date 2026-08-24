import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';
import { SEED_TRACKERS } from '../models/JournalEntry.js';

/**
 * Retires the tag vocabulary and the watched-level state.
 *
 * Two changes, both subtractions.
 *
 * The tags: the app used to serve nineteen suggestions in three groups, read
 * meaning out of whichever words came back, and call the result discipline. It
 * could not work. `ranToPlan` treated any unrecognised word as a slip while
 * `[].every()` made every untagged trade read as disciplined, so the rate mostly
 * measured whether you had tagged. Worse, most of the vocabulary named things
 * the entry already recorded - "no stop" against a row whose plannedStop is
 * null. What survives is a list the user writes themselves, counted and totalled
 * and nothing more.
 *
 * The levels: 'planned' and 'cancelled' described a level being watched, which
 * is not a trade - no fill, no P/L, no R - yet sat in the same list as
 * positions and made every column mean two things. Those rows cannot become
 * trades, because there was never a fill to record, so they are removed rather
 * than left to load as an open position with no entry price.
 *
 * Existing tags seed each user's tracker list, so nothing anyone typed is
 * orphaned; they can then delete whatever they do not want.
 *
 * Idempotent. Pass --dry to report without writing.
 */
const migrate = async () => {
    const dry = process.argv.includes('--dry');
    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}`);

    const entries = mongoose.connection.db.collection('journalentries');
    const settings = mongoose.connection.db.collection('journalsettings');

    // --- 1. levels that were never trades -------------------------------------
    const watched = await entries.find({ state: { $in: ['planned', 'cancelled'] } })
        .project({ symbol: 1, state: 1, entryFrom: 1, entryTo: 1 }).toArray();
    console.log(`  ${watched.length} watched level(s) to remove`);
    for (const w of watched) {
        const zone = [w.entryFrom, w.entryTo].filter(n => n != null).join('–') || 'no level';
        console.log(`    ${w.symbol} (${w.state}, ${zone})`);
    }
    if (!dry && watched.length) {
        await entries.deleteMany({ state: { $in: ['planned', 'cancelled'] } });
    }

    // --- 2. fields with nothing left reading them -----------------------------
    const zoneFields = { entryFrom: '', entryTo: '', entryZoneHit: '', entryZoneHitDate: '' };
    const carrying = await entries.countDocuments({
        $or: Object.keys(zoneFields).map(f => ({ [f]: { $exists: true } }))
    });
    console.log(`  ${carrying} entr(ies) carrying zone fields`);
    if (!dry && carrying) await entries.updateMany({}, { $unset: zoneFields });

    // --- 3. seed each user's tracker list -------------------------------------
    // Whatever they wrote comes first, because those are words they chose; the
    // four seeds fill in behind. A user who already has settings is left alone,
    // which is what makes a second run harmless.
    const users = await entries.distinct('user');
    let seeded = 0, already = 0;

    for (const user of users) {
        if (await settings.findOne({ user })) { already++; continue; }

        const mine = (await entries.distinct('whatHappened', { user }))
            .map(t => String(t || '').trim())
            .filter(Boolean);
        const trackers = [...mine, ...SEED_TRACKERS.filter(t => !mine.includes(t))].slice(0, 20);

        console.log(`  ${String(user).slice(-6)}: ${trackers.length} tracker(s)`
            + (mine.length ? ` (${mine.length} of your own: ${mine.join(', ')})` : ''));

        if (!dry) {
            await settings.insertOne({
                user, trackers, askForBook: false,
                createdAt: new Date(), updatedAt: new Date()
            });
        }
        seeded++;
    }

    console.log(dry
        ? `Dry run. Would seed ${seeded} user(s), ${already} already set up.`
        : `Seeded ${seeded} user(s), ${already} already set up.`);

    await mongoose.disconnect();
};

migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
