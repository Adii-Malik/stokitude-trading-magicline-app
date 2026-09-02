import 'dotenv/config';
import mongoose from 'mongoose';

/**
 * Clears out what the job system accumulated and no longer uses.
 *
 * Three unrelated bits of debris, in one script because they are one deploy's
 * worth of tidying and none is worth its own file.
 *
 * 1. JobExecution indexes. Fifteen, where four do the work. Every query this
 *    collection serves is a findOne on executionId, one job's history newest
 *    first, or the unfiltered recent list - nothing has ever filtered on
 *    jobType, status, queuedAt or completedAt. It matters now that Level Watch
 *    inserts a document every fifteen minutes: a write pays for every index
 *    tree whether or not anything reads it. Mongoose creates indexes and never
 *    drops them, so the schema change alone would leave these forever.
 *
 * 2. The price_polling row in agendaJobs. The five-minute poller that used to
 *    write currentPrice was deleted; its schedule was not. The type is no
 *    longer registered, so no handler exists for it - if anyone toggled it on
 *    in the admin screen it would sit there looking scheduled and silently
 *    never run, which is worse than not being listed at all.
 *
 * 3. The servicelogs collection. Zero documents, no writers, five indexes. The
 *    model and its wrapper are gone; this drops the table, and only if it is
 *    genuinely empty - a surprise row means the assumption was wrong and the
 *    right move is to stop, not to delete it.
 *
 * Safe to re-run: everything here is conditional on what it finds.
 *
 *   node src/scripts/pruneJobMachinery.js --dry
 *   node src/scripts/pruneJobMachinery.js
 */
const dry = process.argv.includes('--dry');

/** What survives on jobexecutions. Anything else on it goes. */
const KEEP = new Set(['_id_', 'executionId_1', 'jobId_1_createdAt_-1', 'createdAt_1']);

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    // 1 — indexes
    const executions = db.collection('jobexecutions');
    const present = await executions.indexes();
    const doomed = present.map((i) => i.name).filter((n) => !KEEP.has(n));
    console.log(`jobexecutions: ${present.length} index(es), dropping ${doomed.length}`);
    for (const name of doomed) {
        console.log(`  - ${name}`);
        if (!dry) await executions.dropIndex(name).catch((e) => console.log(`    (${e.message})`));
    }
    const missing = [...KEEP].filter((k) => !present.some((i) => i.name === k));
    if (missing.length) console.log(`  note: not present yet, autoIndex builds them at boot: ${missing.join(', ')}`);

    // 2 — the orphan schedule
    const orphan = await db.collection('agendaJobs').findOne({ name: 'price_polling' });
    if (!orphan) console.log('agendaJobs: no price_polling row');
    else {
        console.log(`agendaJobs: removing price_polling (last ran ${orphan.lastRunAt?.toISOString().slice(0, 10) ?? 'never'})`);
        if (!dry) await db.collection('agendaJobs').deleteOne({ _id: orphan._id });
    }

    // 3 — the empty table
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    if (!names.includes('servicelogs')) console.log('servicelogs: already gone');
    else {
        const n = await db.collection('servicelogs').countDocuments();
        if (n) console.log(`servicelogs: ${n} document(s) - NOT dropping, that was not expected`);
        else {
            console.log('servicelogs: empty, dropping');
            if (!dry) await db.collection('servicelogs').drop();
        }
    }

    if (dry) console.log('\n--dry, nothing written');
    await mongoose.disconnect();
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
