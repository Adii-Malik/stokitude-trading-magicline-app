import 'dotenv/config';
import fs from 'node:fs';
import zlib from 'node:zlib';
// EJSON is a CommonJS named export, so it comes off the default rather than
// being destructured at the import - the ESM loader cannot see it otherwise.
import mongodb from 'mongodb';

const { MongoClient, EJSON } = mongodb;

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
 *   SOURCE_URI=... node src/scripts/copyCluster.js --out=backup.json.gz
 *   TARGET_URI=... node src/scripts/copyCluster.js --in=backup.json.gz
 *
 * The file form exists because a free-tier project holds one cluster, so moving
 * region can mean deleting the only copy of the data first. Written as extended
 * JSON, which keeps an ObjectId an ObjectId and a Date a Date - plain JSON
 * turns both into strings and every reference in the database with them.
 *
 * Refuses to write into a target that already holds data unless --force, so a
 * mistyped URI cannot quietly merge two databases together.
 */
const arg = (name) => {
    const found = process.argv.find(a => a.startsWith(`--${name}=`));
    return found ? found.split('=').slice(1).join('=') : null;
};

/** Everything, as extended JSON, gzipped. */
const dumpToFile = async (from, file) => {
    const collections = (await from.listCollections().toArray())
        .filter(c => c.type !== 'view' && !c.name.startsWith('system.'));

    const payload = { database: from.databaseName, at: new Date().toISOString(), collections: {} };
    let total = 0;
    for (const { name } of collections) {
        const docs = await from.collection(name).find({}).toArray();
        const indexes = (await from.collection(name).indexes()).filter(i => i.name !== '_id_');
        payload.collections[name] = { docs, indexes };
        total += docs.length;
        console.log(`  ${name.padEnd(24)} ${String(docs.length).padStart(6)} docs`);
    }

    fs.writeFileSync(file, zlib.gzipSync(EJSON.stringify(payload, { relaxed: false })));
    const mb = (fs.statSync(file).size / 1048576).toFixed(1);
    console.log(`\n${collections.length} collections, ${total} documents -> ${file} (${mb} MB)`);
    return payload;
};

const restoreFromFile = async (to, file, force) => {
    const payload = EJSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString(), { relaxed: false });
    console.log(`from ${file}, taken ${payload.at}\n`);

    for (const [name, { docs, indexes }] of Object.entries(payload.collections)) {
        const already = await to.collection(name).countDocuments();
        if (already && !force) {
            console.error(`${name} already holds ${already} documents. Refusing without --force.`);
            process.exit(1);
        }
        console.log(`  ${name.padEnd(24)} ${String(docs.length).padStart(6)} docs`);
        if (!docs.length) continue;
        await to.collection(name).deleteMany({});
        for (let i = 0; i < docs.length; i += 500) {
            await to.collection(name).insertMany(docs.slice(i, i + 500), { ordered: false });
        }
        for (const index of indexes) {
            const { key, name: indexName, v, ...options } = index;
            await to.collection(name).createIndex(key, { name: indexName, ...options });
        }
    }
    console.log('\nRestored.');
};

const copy = async () => {
    const dry = process.argv.includes('--dry');
    const force = process.argv.includes('--force');
    const out = arg('out');
    const into = arg('in');
    const sourceUri = process.env.SOURCE_URI;
    const targetUri = process.env.TARGET_URI;

    if (out) {
        if (!sourceUri) { console.error('Set SOURCE_URI.'); process.exit(1); }
        const client = new MongoClient(sourceUri);
        await client.connect();
        await dumpToFile(client.db(), out);
        await client.close();
        return;
    }

    if (into) {
        if (!targetUri) { console.error('Set TARGET_URI.'); process.exit(1); }
        const client = new MongoClient(targetUri);
        await client.connect();
        await restoreFromFile(client.db(), into, force);
        await client.close();
        return;
    }

    if (!sourceUri || !targetUri) {
        console.error('Set SOURCE_URI and TARGET_URI, or use --out= / --in=.');
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

    // Streamed, never materialised. One of these collections holds 287,000 price
    // bars, and reading it into an array to write it out again asks the process
    // to hold the whole thing at once for no reason. A large read batch matters
    // more than it looks: each one is a round trip, and the source is a quarter
    // of a second away.
    const READ_BATCH = 5000;
    const WRITE_BATCH = 1000;

    let totalDocs = 0;
    for (const { name } of collections) {
        const indexes = (await from.collection(name).indexes()).filter(i => i.name !== '_id_');

        if (dry) {
            const expected = await from.collection(name).countDocuments();
            console.log(`  ${name.padEnd(24)} ${String(expected).padStart(6)} docs, `
                + `${indexes.length} index${indexes.length === 1 ? '' : 'es'}`);
            totalDocs += expected;
            continue;
        }

        await to.collection(name).deleteMany({});

        const cursor = from.collection(name).find({}).batchSize(READ_BATCH);
        let batch = [];
        let written = 0;
        const started = Date.now();

        const flush = async () => {
            if (!batch.length) return;
            await to.collection(name).insertMany(batch, { ordered: false });
            written += batch.length;
            batch = [];
        };

        for await (const doc of cursor) {
            batch.push(doc);
            if (batch.length >= WRITE_BATCH) await flush();
        }
        await flush();

        for (const index of indexes) {
            const { key, name: indexName, v, ...options } = index;
            await to.collection(name).createIndex(key, { name: indexName, ...options });
        }

        totalDocs += written;
        console.log(`  ${name.padEnd(24)} ${String(written).padStart(6)} docs, `
            + `${indexes.length} index${indexes.length === 1 ? '' : 'es'}`
            + `  ${((Date.now() - started) / 1000).toFixed(1)}s`);
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
