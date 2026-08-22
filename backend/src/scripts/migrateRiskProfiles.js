import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';

/**
 * Moves risk limits from one-per-currency to one-per-portfolio.
 *
 * The mandate belongs to the account: two brokers in the same currency can be
 * run to different rules, and a swing book set to 5% must not drag an investing
 * book onto the same line.
 *
 * A currency profile is copied to every active portfolio of that currency rather
 * than to one of them. Copying loses nothing - each book keeps the limits it was
 * being judged by until it is deliberately changed - where picking one would
 * silently reset the others to defaults.
 *
 * Idempotent: a portfolio that already has limits is left alone.
 * Pass --dry to report without writing.
 */
const migrate = async () => {
    const dry = process.argv.includes('--dry');
    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}`);

    const profiles = mongoose.connection.db.collection('riskprofiles');
    const portfolios = mongoose.connection.db.collection('portfolios');

    // Mongo keeps an index the schema no longer declares. The old one is unique
    // on (user, currency), and rows written by this script have no currency at
    // all - so the second book collides with the first on a null. Drop it before
    // writing anything, or the migration half-runs.
    const stale = (await profiles.indexes()).find((i) => i.name === 'user_1_currency_1');
    if (stale) {
        console.log('  dropping the stale user_1_currency_1 index');
        if (!dry) await profiles.dropIndex('user_1_currency_1');
    }

    const old = await profiles.find({ currency: { $exists: true }, portfolioId: { $exists: false } }).toArray();
    console.log(`  ${old.length} profile(s) still keyed by currency`);

    let written = 0, skipped = 0;
    for (const profile of old) {
        const books = await portfolios.find({
            owner: profile.user, isActive: true, currency: profile.currency
        }).project({ _id: 1, name: 1 }).toArray();

        console.log(`  ${profile.currency} (${profile.defaultRiskPct}% / ${profile.maxPositionPct}%) -> ${books.length} book(s)`);
        for (const book of books) {
            const exists = await profiles.findOne({ user: profile.user, portfolioId: book._id });
            if (exists) { console.log(`      ${book.name}: already set, left alone`); skipped++; continue; }
            console.log(`      ${book.name}`);
            if (!dry) {
                await profiles.insertOne({
                    user: profile.user,
                    portfolioId: book._id,
                    defaultRiskPct: profile.defaultRiskPct,
                    maxPositionPct: profile.maxPositionPct,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            written++;
        }
        if (!dry) await profiles.deleteOne({ _id: profile._id });
    }

    console.log(`${dry ? 'Would write' : 'Wrote'} ${written}, skipped ${skipped}.`);
    await mongoose.disconnect();
};

migrate().catch((err) => { console.error(err); process.exit(1); });
