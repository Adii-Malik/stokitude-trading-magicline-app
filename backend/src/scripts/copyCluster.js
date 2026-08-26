import 'dotenv/config';
import { MongoClient } from 'mongodb';

/**
 * Copies a database to another cluster, document for document.
 *
 * Written for one move: the app runs in Ashburn and the database sat in Mumbai,
 * so every query paid 257ms before it did any work - four round trips to draw
 * the portfolio list, and a full second of that was the Indian Ocean. Nothing in
 * the query plans could touch it.
 *
 * Uses the driver rather than mongodump, because the tools are not in the image
 * and this database is small enough that a straight read-and-write is simpler
 * than installing them. Documents keep their _id, so every reference between
 * collections survives - a journal entry still names its portfolio, a
 * transaction still names its book.
 *
 * Indexes are recreated from the source's own definitions. Mongoose would build
 * most of them on boot anyway, but not the ones added by hand, and a missing
 * index on a collection this size turns a fast query into a collection scan.
 *
 *   SOURCE_URI=... TARGET_URI=... node src/scripts/copyCluster.js --dry
 *
 * Refuses to write into a target that already holds data unless --force, so a
 * mistyped URI cannot quietly merge two databases together.
 */
const copy = async () => {
    const dry = process.argv.includes('--dry');
    const force = process.argv.includes('--force');
    const sourceUri = process.env.SOURCE_URI;
    const targetUri = process.env.TARGET_URI;

    if (!sourceUri || !targetUri) {
        console.error('Set SOURCE_URI and TARGET_URI.');
        process.exit(1);
    }

    const source = new MongoClient(sourceUri);
    const target = new MongoClient(targetUri);
    await Promise.all([source.connect(), target.connect()]);

    const from = source.db();
    const to = target.db();
    console.log(`${from.databaseName} -> ${to.databaseName}${dry ? '  (dry run)' : ''}\n`);

    // Latency both ways, which is the whole reason for the move.
    const ping = async (db, label) => {
        await db.command({ ping: 1 });
        const t = [];
        for (let i = 0; i < 5; i++) { const s = Date.now(); await db.command({ ping: 1 }); t.push(Date.now() - s); }
        console.log(`  ${label} ${Math.min(...t)}ms`);
    };
    await ping(from, 'source ping');
    await ping(to, 'target ping');
    console.log('');

    const collections = (await from.listCollections().toArray())
        .filter(c => c.type !== 'view' && !c.name.startsWith('system.'));

    const existing = await to.listCollections().toArray();
    const occupied = [];
    for (const c of existing) {
        const n = await to.collection(c.name).countDocuments();
        if (n) occupied.push(`${c.name} (${n})`);
    }
    if (occupied.length && !force) {
        console.error(`Target already holds data: ${occupied.join(', ')}`);
        console.error('Refusing. Pass --force only if replacing it is what you mean.');
        await Promise.all([source.close(), target.close()]);
        process.exit(1);
    }

    let totalDocs = 0;
    for (const { name } of collections) {
        const docs = await from.collection(name).find({}).toArray();
        const indexes = (await from.collection(name).indexes()).filter(i => i.name !== '_id_');
        totalDocs += docs.length;

        console.log(`  ${name.padEnd(24)} ${String(docs.length).padStart(6)} docs, `
            + `${indexes.length} index${indexes.length === 1 ? '' : 'es'}`);

        if (dry || !docs.length) continue;

        await to.collection(name).deleteMany({});
        // In batches: one insertMany of several thousand documents can exceed the
        // 16MB command limit, and this has to work on the collections that grow.
        for (let i = 0; i < docs.length; i += 500) {
            await to.collection(name).insertMany(docs.slice(i, i + 500), { ordered: false });
        }
        for (const index of indexes) {
            const { key, name: indexName, v, ...options } = index;
            await to.collection(name).createIndex(key, { name: indexName, ...options });
        }
    }

    console.log(`\n${collections.length} collections, ${totalDocs} documents`);

    if (!dry) {
        console.log('\nverifying:');
        let ok = true;
        for (const { name } of collections) {
            const [a, b] = await Promise.all([
                from.collection(name).countDocuments(),
                to.collection(name).countDocuments()
            ]);
            if (a !== b) { ok = false; console.log(`  ${name}: ${a} -> ${b}  MISMATCH`); }
        }
        console.log(ok ? '  every collection matches' : '  MISMATCH - do not switch over');
        if (!ok) process.exitCode = 1;
    }

    await Promise.all([source.close(), target.close()]);
};

copy().catch((error) => {
    console.error('Copy failed:', error.message);
    process.exit(1);
});
