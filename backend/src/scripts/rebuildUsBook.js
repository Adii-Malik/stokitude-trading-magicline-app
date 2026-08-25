import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';
import { US_HISTORY, US_JOURNAL, EXCHANGE_OF } from './data/usBrokerHistory.js';
import portfolioService from '../services/portfolioService.js';

/**
 * Replaces the US book's ledger with the broker's own history, and corrects the
 * journal dates against it.
 *
 * The ledger it replaces was synthetic: one averaged row per journal leg and a
 * round 600 deposit invented to keep cash positive. It reconciled to nothing,
 * because nothing like it ever happened. What goes in instead is every fill the
 * broker reports, the four real deposits, the bonus share and the two settled
 * dividends.
 *
 * The journal keeps its averages - four UPS buys in one morning are one
 * decision, and that is the shape a journal entry is - but loses the
 * transaction ids that pointed at the rows being replaced. A journal entry
 * cannot be linked one-to-one to a trade that filled in four pieces, and
 * claiming otherwise is what made the old ledger wrong in the first place.
 * Naming the book is what matters: capital, the rule and the sizing all follow
 * from that, not from the link.
 *
 * Only ever touches the one USD book and the journal entries in that currency.
 * Pass --dry to see the ledger it would write and the cash it lands on.
 */
const rebuild = async () => {
    const dry = process.argv.includes('--dry');
    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}\n`);

    const db = mongoose.connection.db;
    const books = await db.collection('portfolios')
        .find({ currency: 'USD', isActive: { $ne: false } }).toArray();

    if (books.length !== 1) {
        console.log(books.length ? `${books.length} USD books — which one is a decision, not a guess.`
            : 'No USD book to rebuild.');
        await mongoose.disconnect();
        process.exitCode = 1;
        return;
    }
    const book = books[0];
    const existing = await db.collection('transactions').countDocuments({ portfolioId: book._id });
    console.log(`${book.name}: replacing ${existing} row(s) with ${US_HISTORY.length} from the broker\n`);

    const rows = [];
    let cash = 0, shares = {};
    for (const [date, type, symbol, a, b] of US_HISTORY) {
        const at = new Date(`${date}T00:00:00.000Z`);
        const base = {
            portfolioId: book._id, type, currency: 'USD', executedAt: at,
            source: 'import', createdBy: book.owner, fees: 0, otherCharges: 0,
            createdAt: new Date(), updatedAt: new Date()
        };

        if (type === 'DEPOSIT') {
            rows.push({ ...base, cashAmount: a, notes: b });
            cash += a;
        } else if (type === 'DIV') {
            rows.push({ ...base, symbol, exchange: EXCHANGE_OF[symbol],
                dividendCash: a, dividendType: 'CASH', taxWithheld: 0, notes: b });
            cash += a;
        } else {
            const value = a * b;
            rows.push({ ...base, symbol, exchange: EXCHANGE_OF[symbol], quantity: a, price: b });
            cash += type === 'BUY' ? -value : value;
            shares[symbol] = (shares[symbol] || 0) + (type === 'BUY' ? a : -a);
        }
        console.log(`  ${date}  ${type.padEnd(7)} ${String(symbol ?? '').padEnd(5)} `
            + `${type === 'BUY' || type === 'SELL' ? `${a} @ ${b}` : a}`
            + `   cash ${cash.toFixed(2)}`);
    }

    const held = Object.entries(shares).filter(([, n]) => n > 0);
    console.log(`\n  cash lands at $${cash.toFixed(2)}`);
    console.log(`  still held: ${held.map(([s, n]) => `${n} ${s}`).join(', ') || 'nothing'}`);

    if (!dry) {
        await db.collection('transactions').deleteMany({ portfolioId: book._id });
        await db.collection('positions').deleteMany({ portfolioId: book._id });
        await db.collection('transactions').insertMany(rows);
        // Positions are derived, and deleting the rows they were derived from
        // leaves the book holding nothing until they are worked out again.
        const { positions } = await portfolioService.rebuildPositions(book._id, book.owner);
        console.log(`\n  positions rebuilt: ${positions ?? 'done'}`);
    }

    // --- the journal, against the same statement ------------------------------
    console.log('\njournal:');
    let fixed = 0;
    for (const want of US_JOURNAL) {
        // Matched on price as well as size: two of these are UPS in fours, and
        // symbol-and-quantity alone picked whichever came first - which would
        // have stamped January's dates onto the June trade.
        const near = (a, b) => a != null && Math.abs(a - b) < 0.01;
        const entry = (await db.collection('journalentries')
            .find({ symbol: want.symbol, quantity: want.qty, currency: 'USD' }).toArray())
            .find(e => near(e.entryPrice, want.entry));

        if (!entry) {
            console.log(`  ${want.symbol} ${want.qty} @ ${want.entry} — no entry to correct`);
            continue;
        }

        const set = { portfolioId: book._id };
        const was = [];
        const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

        if (day(entry.entryDate) !== want.in) {
            was.push(`in ${day(entry.entryDate)} -> ${want.in}`);
            set.entryDate = new Date(`${want.in}T00:00:00.000Z`);
        }
        if (want.out && day(entry.exitDate) !== want.out) {
            was.push(`out ${day(entry.exitDate)} -> ${want.out}`);
            set.exitDate = new Date(`${want.out}T00:00:00.000Z`);
        }
        if (entry.entryTransactionId || entry.exitTransactionId) was.push('unlinked from the old rows');

        console.log(`  ${want.symbol.padEnd(5)} ${String(want.qty + ' @ ' + want.entry).padEnd(14)}`
            + `${was.length ? was.join(' · ') : 'already right'}`);
        if (was.length) fixed++;

        if (!dry) {
            await db.collection('journalentries').updateOne({ _id: entry._id }, {
                $set: set,
                $unset: { entryTransactionId: '', exitTransactionId: '', datesEstimated: '' }
            });
        }
    }
    console.log(`\n${dry ? 'Dry run. Would correct' : 'Corrected'} ${fixed} journal entr(ies).`);
    await mongoose.disconnect();
};

rebuild().catch((error) => {
    console.error('Rebuild failed:', error);
    process.exit(1);
});
