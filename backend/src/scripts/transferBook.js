import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';
import portfolioService from '../services/portfolioService.js';

/**
 * Moves a book, and the journal that belongs to it, between databases.
 *
 * Written because the alternative was running five migrations against
 * production and hoping each one found the same shape it found locally. The
 * corrected data already exists here; carrying it over is one operation with
 * one thing to check afterwards.
 *
 * The book is matched by name, never by id. The two databases were seeded
 * separately and share no ObjectIds, so an export carrying them would either
 * collide with something unrelated or point at nothing at all.
 *
 *   node src/scripts/transferBook.js --export="Swing Trade (NASDAQ)" --file=us.json
 *   node src/scripts/transferBook.js --import --file=us.json --dry
 *
 * Scoped to one book throughout: its ledger, its rule, and the journal entries
 * that name it. Both are replaced on the way in - it is a transfer, not a merge
 * - and nothing outside that book is read or touched at either end.
 */
const arg = (name) => {
    const found = process.argv.find(a => a.startsWith(`--${name}=`));
    return found ? found.split('=').slice(1).join('=') : null;
};

const exportBook = async (bookName, file) => {
    const db = mongoose.connection.db;
    const book = await db.collection('portfolios').findOne({ name: bookName, isActive: { $ne: false } });
    if (!book) throw new Error(`No live book called "${bookName}"`);

    const nameOf = new Map(
        (await db.collection('portfolios').find({ owner: book.owner }).toArray())
            .map(p => [String(p._id), p.name])
    );

    const strip = ({ _id, portfolioId, createdBy, __v, createdAt, updatedAt, ...rest }) => rest;

    const transactions = (await db.collection('transactions')
        .find({ portfolioId: book._id }).sort({ executedAt: 1 }).toArray()).map(strip);

    const rule = await db.collection('riskprofiles').findOne({ portfolioId: book._id });

    // This book's entries and no others. A transfer moves one account; entries
    // belonging to a different book are that book's to move.
    const entries = (await db.collection('journalentries')
        .find({ user: book.owner, portfolioId: book._id }).toArray())
        .map(e => ({ ...strip(e), user: undefined }));

    const settings = await db.collection('journalsettings').findOne({ user: book.owner });

    const payload = {
        exportedAt: new Date().toISOString(),
        book: {
            name: book.name, currency: book.currency, description: book.description,
            calculationMethod: book.calculationMethod,
            commissionSlabs: book.commissionSlabs, charges: book.charges
        },
        transactions,
        rule: rule ? { defaultRiskPct: rule.defaultRiskPct, maxPositionPct: rule.maxPositionPct } : null,
        entries,
        settings: settings ? {
            setups: settings.setups, trackers: settings.trackers,
            askForBook: settings.askForBook,
            defaultBooks: Object.fromEntries(
                [...(settings.defaultBooks || new Map())].map(([c, id]) => [c, nameOf.get(String(id)) || null])
            )
        } : null
    };

    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    console.log(`${book.name} -> ${file}`);
    console.log(`  ${transactions.length} transactions`);
    console.log(`  ${entries.length} journal entries`);
    console.log(`  rule ${payload.rule ? `${payload.rule.defaultRiskPct}% / ${payload.rule.maxPositionPct}%` : 'none'}`);
    console.log(`  settings ${settings ? `${settings.setups?.length} setups, ${settings.trackers?.length} trackers` : 'none'}`);
};

const importBook = async (file, dry) => {
    const db = mongoose.connection.db;
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));

    // The owner is whoever holds the books here, not whoever held them there.
    const anyBook = await db.collection('portfolios').findOne({ isActive: { $ne: false } });
    if (!anyBook) throw new Error('No books here, so there is no owner to attach this to');
    const owner = anyBook.owner;

    let book = await db.collection('portfolios').findOne({ name: payload.book.name, owner });
    console.log(`book "${payload.book.name}": ${book ? 'exists' : 'will be created'}`);

    const hadTxns = book ? await db.collection('transactions').countDocuments({ portfolioId: book._id }) : 0;
    const hadEntries = book
        ? await db.collection('journalentries').countDocuments({ user: owner, portfolioId: book._id })
        : 0;
    console.log(`  ledger    ${hadTxns} here -> ${payload.transactions.length} from the file`);
    console.log(`  journal   ${hadEntries} here -> ${payload.entries.length} from the file`
        + ' (entries naming other books are untouched)');

    if (dry) {
        console.log('\nDry run, nothing written.');
        return;
    }

    if (!book) {
        const { insertedId } = await db.collection('portfolios').insertOne({
            ...payload.book, owner, isActive: true, sharedWith: [],
            createdAt: new Date(), updatedAt: new Date()
        });
        book = await db.collection('portfolios').findOne({ _id: insertedId });
    }

    await db.collection('transactions').deleteMany({ portfolioId: book._id });
    await db.collection('positions').deleteMany({ portfolioId: book._id });
    if (payload.transactions.length) {
        await db.collection('transactions').insertMany(payload.transactions.map(t => ({
            ...t, portfolioId: book._id, createdBy: owner,
            executedAt: new Date(t.executedAt),
            createdAt: new Date(), updatedAt: new Date()
        })));
    }
    await portfolioService.rebuildPositions(book._id, owner);

    if (payload.rule) {
        await db.collection('riskprofiles').updateOne(
            { user: owner, portfolioId: book._id },
            { $set: { ...payload.rule, updatedAt: new Date() },
                $setOnInsert: { user: owner, portfolioId: book._id, createdAt: new Date() } },
            { upsert: true }
        );
    }

    const idOf = async (name) => {
        if (!name) return null;
        const found = await db.collection('portfolios').findOne({ name, owner });
        return found?._id || null;
    };

    await db.collection('journalentries').deleteMany({ user: owner, portfolioId: book._id });
    if (payload.entries.length) {
        await db.collection('journalentries').insertMany(payload.entries.map(e => ({
            ...e, user: owner, portfolioId: book._id,
            entryDate: e.entryDate ? new Date(e.entryDate) : undefined,
            exitDate: e.exitDate ? new Date(e.exitDate) : undefined,
            createdAt: new Date(), updatedAt: new Date()
        })));
    }

    if (payload.settings) {
        const defaults = {};
        for (const [currency, name] of Object.entries(payload.settings.defaultBooks || {})) {
            const id = await idOf(name);
            if (id) defaults[currency] = id;
        }
        await db.collection('journalsettings').updateOne(
            { user: owner },
            { $set: {
                setups: payload.settings.setups, trackers: payload.settings.trackers,
                askForBook: payload.settings.askForBook, defaultBooks: defaults,
                updatedAt: new Date()
            }, $setOnInsert: { user: owner, createdAt: new Date() } },
            { upsert: true }
        );
    }

    console.log('\nDone.');
};

const run = async () => {
    const file = arg('file');
    const bookName = arg('export');
    const isImport = process.argv.includes('--import');
    const dry = process.argv.includes('--dry');

    if (!file || (!bookName && !isImport)) {
        console.log('Usage:\n'
            + '  --export="Book name" --file=out.json\n'
            + '  --import --file=out.json [--dry]');
        process.exitCode = 1;
        return;
    }

    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}\n`);
    if (isImport) await importBook(file, dry);
    else await exportBook(bookName, file);
    await mongoose.disconnect();
};

run().catch((error) => {
    console.error('Transfer failed:', error);
    process.exit(1);
});
