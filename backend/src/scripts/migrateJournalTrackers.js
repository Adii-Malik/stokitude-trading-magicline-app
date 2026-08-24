import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';
import { SEED_TRACKERS } from '../models/JournalEntry.js';

/**
 * Old tags that named something the app now works out for itself.
 *
 * These are the reason the vocabulary had to go. "no stop" is plannedStop being
 * null; "target hit" is the exit read against the levels; "oversized" is the
 * size against the book's cap. Carrying them forward as trackers would ask the
 * trader to type what the record already holds - and worse, lets the two
 * disagree: MAS carried "no stop" while holding a stop of 71, and the pane
 * showed both.
 */
const COMPUTED_NOW = new Set([
    // read off plannedStop
    'no stop', 'no stop placed',
    // read off the exit against the stop and targets
    'target hit', 'stop hit', 'trailing stop', 'trailed out', 'manual exit',
    'scaled out', 'took some off', 'time exit', 'time stop', 'breakeven',
    'premature exit', 'exited early', 'no profit protection',
    // read off riskAmount against the book's rule
    'oversized', 'position too large'
]);

/**
 * Old tags that describe what the market did rather than what the trader did.
 *
 * True, but not countable about you - two people can write "reversal" about
 * completely different trades. This is what the note is for, and the note is
 * searchable.
 */
const PROSE_NOW = new Set([
    'thesis played out', 'thesis broken', 'thesis broke', 'failed breakout',
    'no follow-through', 'reversal', 'gave back profit'
]);

/** Old wording for something the seed list already covers. */
const RENAMED = {
    'held through events': 'held through earnings',
    'held through event': 'held through earnings',
    'fomo exit': 'chased the move',
    'chased the move': 'chased the move',
    'lost patience': 'lost patience',
    'moved stop': 'moved my stop'
};

/** What a tag becomes: itself, a new name, or nothing. */
const carriedForward = (tag) => {
    const t = String(tag || '').trim().toLowerCase();
    if (!t || COMPUTED_NOW.has(t) || PROSE_NOW.has(t)) return null;
    return RENAMED[t] || String(tag).trim();
};

/**
 * Retires the tag vocabulary and the watched-level state.
 *
 * Two changes, both subtractions.
 *
 * The tags: the app used to serve nineteen suggestions in three groups, read
 * meaning out of whichever words came back, and call the result discipline. It
 * could not work. `ranToPlan` treated any unrecognised word as a slip while
 * `[].every()` made every untagged trade read as disciplined, so the rate mostly
 * measured whether you had tagged. Worse, most of the vocabulary named things
 * the entry already recorded - "no stop" against a row whose plannedStop is
 * null. What survives is a list the user writes themselves, counted and totalled
 * and nothing more.
 *
 * The levels: 'planned' and 'cancelled' described a level being watched, which
 * is not a trade - no fill, no P/L, no R - yet sat in the same list as
 * positions and made every column mean two things. Those rows cannot become
 * trades, because there was never a fill to record, so they are removed rather
 * than left to load as an open position with no entry price.
 *
 * Tags that survive the rule seed each user's tracker list. Ones naming
 * something the app now computes are dropped from the entries too, rather than
 * left to contradict the record they sit beside.
 *
 * Idempotent. Pass --dry to report without writing.
 */
const migrate = async () => {
    const dry = process.argv.includes('--dry');
    await connectDB(config.mongoUri);
    console.log(`Connected${dry ? ' (dry run)' : ''}`);

    const entries = mongoose.connection.db.collection('journalentries');
    const settings = mongoose.connection.db.collection('journalsettings');

    // --- 1. levels that were never trades -------------------------------------
    const watched = await entries.find({ state: { $in: ['planned', 'cancelled'] } })
        .project({ symbol: 1, state: 1, entryFrom: 1, entryTo: 1 }).toArray();
    console.log(`  ${watched.length} watched level(s) to remove`);
    for (const w of watched) {
        const zone = [w.entryFrom, w.entryTo].filter(n => n != null).join('–') || 'no level';
        console.log(`    ${w.symbol} (${w.state}, ${zone})`);
    }
    if (!dry && watched.length) {
        await entries.deleteMany({ state: { $in: ['planned', 'cancelled'] } });
    }

    // --- 2. fields with nothing left reading them -----------------------------
    const zoneFields = { entryFrom: '', entryTo: '', entryZoneHit: '', entryZoneHitDate: '' };
    const carrying = await entries.countDocuments({
        $or: Object.keys(zoneFields).map(f => ({ [f]: { $exists: true } }))
    });
    console.log(`  ${carrying} entr(ies) carrying zone fields`);
    if (!dry && carrying) await entries.updateMany({}, { $unset: zoneFields });

    // --- 3. retire the tags the app now works out ------------------------------
    const tagged = await entries.find({ whatHappened: { $exists: true, $ne: [] } })
        .project({ symbol: 1, whatHappened: 1, plannedStop: 1 }).toArray();

    let rewritten = 0;
    for (const e of tagged) {
        const kept = [...new Set(e.whatHappened.map(carriedForward).filter(Boolean))];
        if (kept.length === e.whatHappened.length
            && kept.every((t, i) => t === e.whatHappened[i])) continue;

        const gone = e.whatHappened.filter(t => !kept.includes(carriedForward(t) || ''));
        console.log(`    ${e.symbol}: [${e.whatHappened.join(', ')}] -> [${kept.join(', ')}]`
            + (gone.includes('no stop') && e.plannedStop != null
                ? '   (it had a stop of ' + e.plannedStop + ' all along)' : ''));

        if (!dry) await entries.updateOne({ _id: e._id }, { $set: { whatHappened: kept } });
        rewritten++;
    }
    console.log(`  ${rewritten} entr(ies) with tags the record already answers`);

    // --- 4. each user's tracker list ------------------------------------------
    // Their own words first, because those are words they chose; the seeds fill
    // in behind. Runs for an existing list too, so a list seeded by an earlier
    // version of this script is pruned rather than left carrying the vocabulary
    // this change exists to retire.
    const users = await entries.distinct('user');
    let touched = 0;

    for (const user of users) {
        const existing = await settings.findOne({ user });

        const mine = (await entries.distinct('whatHappened', { user }))
            .map(carriedForward).filter(Boolean);
        const fromList = (existing?.trackers || []).map(carriedForward).filter(Boolean);
        const chosen = [...new Set([...mine, ...fromList])];
        const trackers = [...chosen, ...SEED_TRACKERS.filter(t => !chosen.includes(t))].slice(0, 20);

        if (existing && existing.trackers?.length === trackers.length
            && existing.trackers.every((t, i) => t === trackers[i])) continue;

        const dropped = (existing?.trackers || []).filter(t => !trackers.includes(t));
        console.log(`  ${String(user).slice(-6)}: ${trackers.length} tracker(s)`
            + (dropped.length ? `, dropping ${dropped.join(', ')}` : ''));

        if (!dry) {
            await settings.updateOne(
                { user },
                { $set: { trackers, updatedAt: new Date() },
                  $setOnInsert: { user, askForBook: false, createdAt: new Date() } },
                { upsert: true }
            );
        }
        touched++;
    }

    // --- 5. a review belongs to a finished trade -------------------------------
    // Tags and a lesson are what you write once the trade is over. An open one
    // has an entry, levels and a thesis and nothing to conclude, so the form no
    // longer offers either - which would leave anything already there stranded,
    // visible in the pane and unreachable from the form.
    //
    // The lesson is appended to the note rather than dropped: it is the trader's
    // own sentence about their own trade, and the note is where prose lives on a
    // position still running. Tags go, since a tag is only ever a shorthand for
    // something the note can say in words.
    const openWithReview = await entries.find({
        state: 'open',
        $or: [{ lesson: { $nin: [null, ''] } }, { whatHappened: { $exists: true, $ne: [] } }]
    }).toArray();

    for (const e of openWithReview) {
        const notes = [e.notes, e.lesson].map(t => String(t || '').trim()).filter(Boolean).join(' ');
        console.log(`  ${e.symbol} is open: lesson folded into the note`
            + (e.whatHappened?.length ? `, tags dropped (${e.whatHappened.join(', ')})` : ''));
        if (!dry) {
            await entries.updateOne({ _id: e._id },
                { $set: { notes, lesson: '', whatHappened: [] } });
        }
    }
    console.log(`  ${openWithReview.length} open trade(s) carrying a review`);

    console.log(dry
        ? `Dry run. Would write ${touched} tracker list(s).`
        : `Wrote ${touched} tracker list(s).`);

    await mongoose.disconnect();
};

migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
