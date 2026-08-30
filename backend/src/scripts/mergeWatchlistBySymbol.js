/**
 * One live flag per name, where there used to be one per name per board.
 *
 * The unique key was {user, market, symbol, period}, so the same company noticed
 * on the monthly board and again on the yearly one became two records - two
 * threads, two sets of levels, and a watcher that could tell you about the same
 * stock twice with two different numbers. This merges them.
 *
 * Nothing is thrown away. The oldest record wins because it is the one whose
 * noticedAt anchors the drift; the rest hand over their looks, their levels if
 * the survivor has none, and their board as provenance.
 *
 * Only live rows are touched. A settled record is a record of what happened and
 * merging two of those would rewrite history.
 *
 *   node src/scripts/mergeWatchlistBySymbol.js [--dry]
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Watchlist from '../models/Watchlist.js';

/**
 * Both keys come off first, and that ordering is the whole trick.
 *
 * The new index cannot build over a collection that still holds duplicates, so
 * on a server whose model already declares it, autoIndex fails quietly at boot
 * and the app carries on under the old key. Dropping both before touching a
 * document makes this runnable in either state, and runnable twice.
 */
const INDEXES = ['user_1_market_1_symbol_1_period_1', 'user_1_market_1_symbol_1'];
const dry = process.argv.includes('--dry');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const col = Watchlist.collection;

    const present = (await col.indexes()).map(i => i.name);
    for (const name of INDEXES.filter(n => present.includes(n))) {
        console.log(`dropping ${name}`);
        if (!dry) await col.dropIndex(name);
    }

    const groups = await col.aggregate([
        { $match: { state: 'watching' } },
        { $group: { _id: { user: '$user', market: '$market', symbol: '$symbol' }, ids: { $push: '$_id' }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } }
    ]).toArray();

    console.log(`${groups.length} name${groups.length === 1 ? '' : 's'} flagged on more than one board`);

    for (const g of groups) {
        const docs = await col.find({ _id: { $in: g.ids } }).sort({ noticedAt: 1 }).toArray();
        const [keep, ...merge] = docs;

        const looks = docs.flatMap(d => d.looks || []).sort((a, b) => new Date(a.at) - new Date(b.at));

        // The survivor's own levels stand. Only a record with none inherits, and
        // then from the most recently noticed - a price named later is the one
        // you still believe.
        const donor = [...merge].reverse().find(d => d.trigger || d.invalidation);
        const trigger = keep.trigger || (keep.invalidation ? null : donor?.trigger) || null;
        const invalidation = keep.invalidation || (keep.trigger ? null : donor?.invalidation) || null;

        console.log(`  ${keep.symbol}: ${docs.length} rows -> 1 (${looks.length} looks)`);
        if (dry) continue;

        await col.updateOne({ _id: keep._id }, {
            $set: { looks, trigger, invalidation }
        });
        await col.deleteMany({ _id: { $in: merge.map(d => d._id) } });
    }

    if (!dry) await Watchlist.syncIndexes();
    console.log(dry ? 'dry run, nothing written' : 'done');
    await mongoose.disconnect();
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });
