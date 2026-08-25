import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';

/**
 * Removes portfolios that were deleted in the app, and everything that belonged
 * to them.
 *
 * Deleting a portfolio sets isActive to false. Nothing reads it again, but its
 * ledger stays: sixteen retired books on this account were still holding four
 * thousand transactions and five hundred positions between them - mostly the
 * intermediate attempts from the broker import, several of them exact duplicates
 * of each other. They cost nothing to leave, and they make every book picker in
 * the app a list you have to read twice.
 *
 * Scoped by id rather than by flag at each step, so a row belonging to a live
 * book cannot be caught by a query that drifted. Anything still pointing at one
 * of these - a risk profile, a journal entry - stops the purge rather than being
 * quietly orphaned.
 *
 * Irreversible. Pass --dry first; it reports every book and every count without
 * writing.
 */
const purge = async () => {
    const dry = process.argv.includes('--dry');
    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}\n`);

    const db = mongoose.connection.db;
    const portfolios = db.collection('portfolios');

    const dead = await portfolios.find({ isActive: false })
        .project({ _id: 1, name: 1, currency: 1 }).toArray();

    if (!dead.length) {
        console.log('Nothing deleted is still here.');
        await mongoose.disconnect();
        return;
    }

    const ids = dead.map(p => p._id);
    const owned = { transactions: 0, positions: 0 };

    console.log(`${dead.length} deleted book(s):\n`);
    for (const book of dead) {
        const txns = await db.collection('transactions').countDocuments({ portfolioId: book._id });
        const pos = await db.collection('positions').countDocuments({ portfolioId: book._id });
        owned.transactions += txns;
        owned.positions += pos;
        console.log(`  ${book.name.padEnd(22)} ${String(book.currency).padEnd(4)} `
            + `${String(txns).padStart(5)} txns  ${String(pos).padStart(4)} positions`);
    }

    // A book still spoken for is not a book to remove. Better to stop and say so
    // than to leave a journal entry pointing at an id that no longer resolves.
    const holdouts = [];
    for (const [name, col] of [['risk profile', 'riskprofiles'], ['journal entry', 'journalentries']]) {
        const n = await db.collection(col).countDocuments({ portfolioId: { $in: ids } });
        if (n) holdouts.push(`${n} ${name}(s)`);
    }
    if (holdouts.length) {
        console.log(`\nRefusing: ${holdouts.join(' and ')} still point at these books.`);
        await mongoose.disconnect();
        process.exitCode = 1;
        return;
    }

    const live = await portfolios.countDocuments({ isActive: { $ne: false } });
    const keptTxns = await db.collection('transactions').countDocuments({ portfolioId: { $nin: ids } });
    console.log(`\n  removing ${owned.transactions} transactions and ${owned.positions} positions`);
    console.log(`  keeping  ${keptTxns} transactions across ${live} live book(s)`);

    if (!dry) {
        await db.collection('transactions').deleteMany({ portfolioId: { $in: ids } });
        await db.collection('positions').deleteMany({ portfolioId: { $in: ids } });
        await portfolios.deleteMany({ _id: { $in: ids } });
    }

    console.log(dry ? '\nDry run, nothing written.' : '\nDone.');
    await mongoose.disconnect();
};

purge().catch((error) => {
    console.error('Purge failed:', error);
    process.exit(1);
});
