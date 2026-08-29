import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';

/**
 * Drops the bar indexes that nothing reads.
 *
 * The three bar collections each carried seven indexes where three do the work.
 * $indexStats over four days, and the callers themselves, say which:
 *
 *   symbol_1_date_1  unique  the upsert filters on it, and with symbol matched
 *                            for equality it sorts date either direction
 *   date_1                   the only way into a date range across all symbols
 *   _id_                     mandatory
 *
 *   symbol_1_date_-1         identical explain to the unique index on both real
 *                            queries - same keys, same documents examined
 *   stockId_1_date_-1        zero operations; stockId is written, never queried
 *   stockId_1                zero operations, and a prefix of the above
 *   symbol_1                 a prefix of the compound; two operations in four days
 *
 * Mongoose creates indexes but never drops them, so the schema change alone
 * would leave these in place forever. Safe to re-run: it only drops what is
 * there, and any of them can be rebuilt in seconds if a query ever needs one.
 *
 *   node src/scripts/pruneBarIndexes.js --dry
 *   node src/scripts/pruneBarIndexes.js
 */
const dry = process.argv.includes('--dry');

const COLLECTIONS = ['psxdailies', 'psxweeklies', 'psxmonthlies'];
const DROP = ['symbol_1_date_-1', 'stockId_1_date_-1', 'stockId_1', 'symbol_1'];
const KEEP = ['_id_', 'symbol_1_date_1', 'date_1'];

const mb = (b) => (b / 1048576).toFixed(1) + ' MB';

const run = async () => {
    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}\n`);
    const db = mongoose.connection.db;

    let freed = 0;
    for (const name of COLLECTIONS) {
        const sizes = (await db.command({ collStats: name })).indexSizes;
        const present = Object.keys(sizes);
        console.log(name);

        for (const index of DROP) {
            if (!present.includes(index)) { console.log(`   ${index.padEnd(20)} already gone`); continue; }
            freed += sizes[index];
            console.log(`   ${index.padEnd(20)} ${dry ? 'would free' : 'freeing  '} ${mb(sizes[index])}`);
            if (!dry) await db.collection(name).dropIndex(index);
        }

        // A missing unique index is a data-integrity hole, not an optimisation.
        // Say so loudly rather than leaving it to be discovered by a duplicate.
        if (!present.includes('symbol_1_date_1')) {
            console.log('   WARNING: symbol_1_date_1 (unique) is missing - duplicate bars are possible');
        }
        console.log();
    }

    console.log(`${dry ? 'Would free' : 'Freed'} ${mb(freed)}\n`);

    if (!dry) {
        console.log('verifying what is left:');
        let ok = true;
        for (const name of COLLECTIONS) {
            const indexes = await db.collection(name).indexes();
            const left = indexes.map(i => i.name).sort();
            const unexpected = left.filter(n => !KEEP.includes(n));
            const missing = KEEP.filter(n => !left.includes(n));
            const unique = indexes.find(i => i.name === 'symbol_1_date_1')?.unique;
            console.log(`   ${name.padEnd(14)} ${left.join(', ')}`);
            if (unexpected.length) { ok = false; console.log(`      unexpected: ${unexpected.join(', ')}`); }
            if (missing.length) { ok = false; console.log(`      MISSING: ${missing.join(', ')}`); }
            if (!unique) { ok = false; console.log('      symbol_1_date_1 is no longer unique'); }
        }
        const after = [];
        for (const name of COLLECTIONS) after.push((await db.command({ collStats: name })).totalIndexSize);
        console.log(`\n   index footprint now ${mb(after.reduce((a, b) => a + b, 0))}`);
        console.log(ok ? '   three indexes on each collection, the unique one intact'
            : '   UNEXPECTED STATE - check before deploying');
        if (!ok) process.exitCode = 1;
    }

    await mongoose.disconnect();
};

run().catch((error) => {
    console.error('Prune failed:', error.message);
    process.exit(1);
});
