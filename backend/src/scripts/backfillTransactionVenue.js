/**
 * The venue each transaction actually traded on.
 *
 * Transaction.exchange defaults to PSX whatever book it is written in, and the
 * stored currency defaults from that - so every fill in a dollar portfolio was
 * recorded as having traded in Pakistan, in rupees. New rows take the venue from
 * their book's market; these are the ones written before that.
 *
 * Inert today: transactions are reached through a portfolio that is already
 * market-scoped, and nothing reads the stored currency - every screen uses the
 * portfolio's. It is still a row that contradicts its own parent, it is column
 * two of the CSV export, and the day anything scopes transactions the whole US
 * ledger files itself under PK.
 *
 * Which venue *within* a market is not corrected, because it is not a question
 * this app asks: nothing here differs between NASDAQ and NYSE - not currency,
 * not rounding, not pricing, not scoping. Only rows whose venue sits in the
 * wrong market are touched.
 *
 *   node src/scripts/backfillTransactionVenue.js [--dry]
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Portfolio from '../models/Portfolio.js';
import Transaction from '../models/Transaction.js';
import { getMarket, marketOfExchange, currencyOf } from '../config/exchanges.js';

const dry = process.argv.includes('--dry');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Unscoped on purpose: a script runs outside any request and must see both.
    const books = await Portfolio.find().select('_id name market currency').lean();
    console.log(`${books.length} book(s)\n`);

    let checked = 0, wrong = 0;

    for (const book of books) {
        const venue = getMarket(book.market).exchanges[0];
        const rows = await Transaction.find({ portfolioId: book._id })
            .select('exchange currency').lean();
        checked += rows.length;

        // Only where the recorded venue lands in a different market than the
        // book. A NYSE row in a US book is right, and is left alone.
        const stale = rows.filter(r => marketOfExchange(r.exchange) !== book.market);
        if (!stale.length) {
            console.log(`  ${book.name.padEnd(24)} ${String(book.market).padEnd(3)} ${rows.length} row(s), all correct`);
            continue;
        }

        wrong += stale.length;
        console.log(`  ${book.name.padEnd(24)} ${String(book.market).padEnd(3)} `
            + `${stale.length} of ${rows.length} row(s) -> ${venue} / ${currencyOf(venue)}`);

        if (!dry) {
            await Transaction.updateMany(
                { _id: { $in: stale.map(r => r._id) } },
                { $set: { exchange: venue, currency: currencyOf(venue) } }
            );
        }
    }

    console.log(`\n${wrong} of ${checked} transaction(s) ${dry ? 'would be' : 'were'} corrected.`);
    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
