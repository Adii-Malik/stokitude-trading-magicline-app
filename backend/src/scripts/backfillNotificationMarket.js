/**
 * Which book each old notification was about.
 *
 * The market column arrived after these were written, so they carry nothing and
 * show in both books - the safe default, and the wrong one for a notification
 * that was plainly about a PSX name while you are working the US screen.
 *
 * Every price notification names the record it came from, so the answer is not
 * inferred from the symbol. `data.watchlistId` and `data.journalEntryId` point
 * at rows that are already market-scoped, and their market is the notification's
 * market by definition.
 *
 * Anything with neither id is left alone on purpose. A job that failed or a
 * message about the account belongs to both books, and absent already means
 * exactly that.
 *
 *   node src/scripts/backfillNotificationMarket.js [--dry]
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import Watchlist from '../models/Watchlist.js';
import JournalEntry from '../models/JournalEntry.js';

const dry = process.argv.includes('--dry');

/** id -> market, for one collection, in one query. */
async function marketsOf(Model, ids) {
    if (!ids.length) return new Map();
    const rows = await Model.find({ _id: { $in: ids } }).select('market').lean();
    return new Map(rows.map((r) => [String(r._id), r.market]));
}

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    const orphans = await Notification.find({
        market: { $in: [null, undefined] },
        $or: [
            { 'data.watchlistId': { $exists: true } },
            { 'data.journalEntryId': { $exists: true } }
        ]
    }).select('data').lean();

    console.log(`${orphans.length} notification(s) point at a record and carry no market`);
    if (!orphans.length) return mongoose.disconnect();

    const [watch, journal] = await Promise.all([
        marketsOf(Watchlist, orphans.map((n) => n.data?.watchlistId).filter(Boolean)),
        marketsOf(JournalEntry, orphans.map((n) => n.data?.journalEntryId).filter(Boolean))
    ]);

    const writes = [];
    let unresolved = 0;
    for (const n of orphans) {
        const market = watch.get(String(n.data?.watchlistId))
            ?? journal.get(String(n.data?.journalEntryId));
        // The record it pointed at is gone. Leaving it in both books is the same
        // answer it has now, and better than guessing at one.
        if (!market) { unresolved += 1; continue; }
        writes.push({ updateOne: { filter: { _id: n._id }, update: { $set: { market } } } });
    }

    const byMarket = writes.reduce((acc, w) => {
        const m = w.updateOne.update.$set.market;
        acc[m] = (acc[m] || 0) + 1;
        return acc;
    }, {});
    console.log('  resolved:', byMarket, unresolved ? `(${unresolved} unresolved, left in both)` : '');

    if (dry) console.log('  --dry, nothing written');
    else if (writes.length) {
        const res = await Notification.bulkWrite(writes, { ordered: false });
        console.log(`  stamped ${res.modifiedCount}`);
    }

    await mongoose.disconnect();
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
