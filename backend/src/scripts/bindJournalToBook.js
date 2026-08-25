import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';
import JournalEntry from '../models/JournalEntry.js';
import Portfolio from '../models/Portfolio.js';
import Transaction from '../models/Transaction.js';
import journalService from '../services/journalService.js';

/**
 * Links journal entries that have no book to the one book in their currency.
 *
 * A journal entry without a portfolio is a note. It has no capital behind it, so
 * nothing can size it, no rule can judge it and "at risk" cannot be a share of
 * anything - every one of those features hangs off the link. Trades logged
 * before a book existed in their currency were left as notes by circumstance
 * rather than by choice.
 *
 * Only ever binds where there is exactly one candidate. Two books in a currency
 * is a decision about which account the trade actually happened in, and guessing
 * that wrong writes fills into the wrong ledger.
 *
 * Linking books both legs: a buy going in and, once there is an exit price, a
 * sell coming out. Those are real transactions in a real ledger, so the book
 * needs the cash to have made them - pass --deposit=N to seed an opening
 * balance dated before the first fill. Without one the cash simply runs
 * negative, which is honest but reconciles to nothing.
 *
 * Pass --dry to see every leg it would write.
 */
const bind = async () => {
    const dry = process.argv.includes('--dry');
    const depositArg = process.argv.find(a => a.startsWith('--deposit='));
    const deposit = depositArg ? Number(depositArg.split('=')[1]) : 0;

    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}\n`);

    const loose = await JournalEntry.find({ portfolioId: null }).sort({ entryDate: 1 });
    if (!loose.length) {
        console.log('Every journal entry already names a book.');
        await mongoose.disconnect();
        return;
    }

    const books = await Portfolio.find({ isActive: { $ne: false } }).select('name currency owner');
    const byCurrency = {};
    for (const b of books) {
        const c = (b.currency || 'PKR').toUpperCase();
        (byCurrency[c] = byCurrency[c] || []).push(b);
    }

    // Grouped so the report reads per market rather than per trade, which is how
    // the decision is actually made.
    const groups = {};
    for (const e of loose) {
        const c = (e.currency || 'PKR').toUpperCase();
        (groups[c] = groups[c] || []).push(e);
    }

    let bound = 0;
    for (const [currency, entries] of Object.entries(groups)) {
        const candidates = byCurrency[currency] || [];

        if (candidates.length !== 1) {
            console.log(`${currency}: ${entries.length} entr(ies) left alone — `
                + (candidates.length === 0
                    ? `no ${currency} book exists`
                    : `${candidates.length} ${currency} books, so which one is a decision, not a guess`));
            continue;
        }

        const book = candidates[0];
        console.log(`${currency}: ${entries.length} entr(ies) -> ${book.name}`);

        if (deposit > 0 && !dry) {
            const first = entries[0].entryDate;
            await Transaction.create({
                portfolioId: book._id,
                type: 'DEPOSIT',
                cashAmount: deposit,
                executedAt: new Date(new Date(first).getTime() - 86400000),
                currency,
                source: 'import',
                notes: 'Opening balance, seeded when the journal was bound to this book',
                createdBy: book.owner
            });
            console.log(`  opening deposit ${deposit} the day before the first fill`);
        }

        for (const entry of entries) {
            if (dry) {
                const legs = ['entry', entry.exitPrice != null ? 'exit' : null].filter(Boolean);
                console.log(`  ${entry.symbol.padEnd(6)} ${legs.join(' + ')}`);
            } else {
                // Through the service so the ledger is minted the same way the
                // form mints it - a portfolioId written straight to the document
                // links the entry without booking anything, and the two only
                // agree again on the next unrelated save.
                await journalService.update(entry._id, entry.user, { portfolioId: book._id });
                console.log(`  ${entry.symbol.padEnd(6)} booked`);
            }
            bound++;
        }
    }

    console.log(dry ? `\nDry run. Would bind ${bound} entr(ies).` : `\nBound ${bound} entr(ies).`);
    await mongoose.disconnect();
};

bind().catch((error) => {
    console.error('Bind failed:', error);
    process.exit(1);
});
