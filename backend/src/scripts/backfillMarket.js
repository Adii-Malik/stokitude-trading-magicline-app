import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';
import { marketOfCurrency, marketOfExchange, DEFAULT_MARKET } from '../config/exchanges.js';

/**
 * Writes the market onto every document that will be scoped by it.
 *
 * Must run before the models start filtering, or a scoped query finds nothing:
 * the plugin asks for `market: 'PK'` and every existing row has no market at all.
 *
 * Only the collections that are ever *listed* without a portfolio id are here.
 * Transactions and positions are always reached through a book that is itself
 * scoped, so stamping them would cost writes on the largest collection in the
 * database and buy nothing.
 *
 *   node src/scripts/backfillMarket.js --dry
 *   node src/scripts/backfillMarket.js
 *
 * Idempotent: only touches documents that have no market yet, so running it
 * twice is the same as running it once, and it can be re-run after any import.
 */
const dry = process.argv.includes('--dry');

/** How each collection knows which market it is in. */
const SOURCES = {
    portfolios: (doc) => marketOfCurrency(doc.currency),
    journalentries: (doc) => marketOfExchange(doc.exchange),
    // Rows written before the exchange field carry none. This was a PSX-only
    // app when they were added, so that is what they are.
    stocks: (doc) => (doc.exchange ? marketOfExchange(doc.exchange) : DEFAULT_MARKET),
    stockfundamentals: (doc) => (doc.exchange ? marketOfExchange(doc.exchange) : DEFAULT_MARKET)
};

const run = async () => {
    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}\n`);
    const db = mongoose.connection.db;

    let total = 0;
    for (const [name, marketOf] of Object.entries(SOURCES)) {
        const pending = await db.collection(name).find({ market: { $exists: false } }).toArray();
        const counts = {};
        for (const doc of pending) {
            const market = marketOf(doc);
            counts[market] = (counts[market] || 0) + 1;
            if (!dry) {
                await db.collection(name).updateOne({ _id: doc._id }, { $set: { market } });
            }
        }
        total += pending.length;
        const shape = Object.entries(counts).map(([m, n]) => `${n} ${m}`).join(', ') || 'nothing to do';
        console.log(`  ${name.padEnd(20)} ${String(pending.length).padStart(5)}  ${shape}`);
    }

    // A rule belongs to a book, and takes the market of the book it judges.
    const rules = await db.collection('riskprofiles').find({ market: { $exists: false } }).toArray();
    const books = new Map(
        (await db.collection('portfolios').find({}).project({ currency: 1 }).toArray())
            .map(b => [String(b._id), marketOfCurrency(b.currency)])
    );
    let ruled = 0, orphan = 0;
    for (const rule of rules) {
        const market = books.get(String(rule.portfolioId));
        if (!market) { orphan++; continue; }
        if (!dry) await db.collection('riskprofiles').updateOne({ _id: rule._id }, { $set: { market } });
        ruled++;
    }
    total += ruled;
    console.log(`  ${'riskprofiles'.padEnd(20)} ${String(ruled).padStart(5)}  from their book`
        + (orphan ? `  (${orphan} pointing at no book, left alone)` : ''));

    console.log(`\n${total} document(s)${dry ? ' would be' : ''} stamped.`);

    /**
     * A globally unique symbol cannot survive two markets.
     *
     * Both collections carry a {symbol:1} unique index. A symbol identifies a
     * company only within a market - PSX and NASDAQ can both list one, and they
     * are not the same company - so the first US ticker sharing a symbol with a
     * PSX name would be a duplicate key error, at the worst possible moment.
     *
     * The replacements already exist in the schemas: {exchange:1, symbol:1} on
     * stocks, {market:1, symbol:1} on fundamentals. Mongoose creates indexes but
     * never drops them, so the old ones have to go by hand. Databases are at
     * different points here - dev has already lost the stocks one - so each is
     * checked rather than assumed.
     */
    console.log('\nstale unique indexes:');
    for (const [name, key] of [['stocks', 'symbol_1'], ['stockfundamentals', 'symbol_1']]) {
        const has = (await db.collection(name).indexes()).find(i => i.name === key && i.unique);
        if (!has) { console.log(`  ${name}.${key}  already gone`); continue; }
        console.log(`  ${name}.${key}  ${dry ? 'would be dropped' : 'dropping'}`);
        if (!dry) await db.collection(name).dropIndex(key);
    }

    if (!dry) {
        console.log('\nverifying nothing was left behind:');
        let ok = true;
        for (const name of [...Object.keys(SOURCES), 'riskprofiles']) {
            const missing = await db.collection(name).countDocuments({ market: { $exists: false } });
            const held = await db.collection(name).countDocuments();
            if (missing) { ok = false; console.log(`  ${name}: ${missing} of ${held} still without a market`); }
        }
        for (const [name, key] of [['stocks', 'symbol_1'], ['stockfundamentals', 'symbol_1']]) {
            const still = (await db.collection(name).indexes()).find(i => i.name === key && i.unique);
            if (still) { ok = false; console.log(`  ${name}.${key} is still unique`); }
        }
        console.log(ok ? '  every document carries a market, no global unique keys left'
            : '  INCOMPLETE - do not apply the plugin yet');
        if (!ok) process.exitCode = 1;
    }

    await mongoose.disconnect();
};

run().catch((error) => {
    console.error('Backfill failed:', error.message);
    process.exit(1);
});
