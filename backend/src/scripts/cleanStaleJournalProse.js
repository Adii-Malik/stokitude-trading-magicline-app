import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';

/**
 * Removes clauses that describe fields the journal no longer has.
 *
 * The notes on the seeded book were written against a model with a "stop
 * placed at the broker" checkbox, a hand-entered mark price and an
 * "unconfirmed exit" flag. All three are gone, so sentences about them now
 * describe nothing - and one of them, on MAS, describes the opposite of the
 * record it sits beside: it says no stop was placed on a trade that holds a
 * stop of 71.
 *
 * Cuts, never rewrites. Every edit below is an exact substring lifted from the
 * text it removes, so a note this script does not recognise is one it cannot
 * touch, and a second run finds nothing to do. What is left is the observation
 * the trader actually made; only the clauses about deleted machinery go.
 *
 * A one-off, not a migration: the next book will not have this problem, because
 * there is nothing left to write these sentences about.
 *
 * Pass --dry to see the before and after without writing.
 */
const CUTS = [
    {
        symbol: 'MAS',
        field: 'notes',
        // Contradicts plannedStop: 71, and cites a mark price the model dropped.
        remove: [
            'No stop placed at the broker, and held',
            ' The mark of 71.48 is hand-entered, not a live quote.'
        ],
        insert: { 'No stop placed at the broker, and held': 'Held' }
    },
    {
        symbol: 'SMCI',
        field: 'notes',
        // "Unconfirmed" was the third state of a checkbox that no longer exists;
        // a stop is now recorded or it is not.
        remove: [' — the result was right but the protection is unconfirmed']
    },
    {
        symbol: 'DXCM',
        field: 'notes',
        // True when it was written. MAS carries a stop now too.
        remove: [' The only trade in the set with a placed stop.']
    },
    {
        // Lot 1 of the three: the only UPS note mentioning the checkbox.
        symbol: 'UPS',
        field: 'notes',
        remove: [' Whether a resting stop was in place is not recorded — left unticked rather than assumed.']
    }
];

const clean = async () => {
    const dry = process.argv.includes('--dry');
    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}\n`);

    const entries = mongoose.connection.db.collection('journalentries');
    let changed = 0;

    for (const cut of CUTS) {
        // Every match, because UPS is three lots and only one carries the clause.
        const found = await entries.find({ symbol: cut.symbol }).toArray();

        for (const entry of found) {
            const before = entry[cut.field];
            if (!before) continue;

            let after = before;
            for (const [from, to] of Object.entries(cut.insert || {})) {
                if (after.includes(from)) after = after.replace(from, to);
            }
            for (const clause of cut.remove) {
                if (after.includes(clause)) after = after.replace(clause, '');
            }
            after = after.replace(/\s+/g, ' ').trim();

            if (after === before) continue;

            console.log(`${cut.symbol} · ${cut.field}`);
            console.log(`  was: ${before}`);
            console.log(`  now: ${after}\n`);

            if (!dry) await entries.updateOne({ _id: entry._id }, { $set: { [cut.field]: after } });
            changed++;
        }
    }

    console.log(dry
        ? `Dry run. Would rewrite ${changed} note(s).`
        : `Rewrote ${changed} note(s).`);

    await mongoose.disconnect();
};

clean().catch((error) => {
    console.error('Clean-up failed:', error);
    process.exit(1);
});
