import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';
import { SEED_TRACKERS, SETUP_SUGGESTIONS } from '../models/JournalEntry.js';

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
 * Also unsets emotionalState, marketCondition and tags[] - two questions asked
 * on every close and rendered nowhere, and an array no screen ever wrote.
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

    const db = mongoose.connection.db;
    const entries = db.collection('journalentries');
    const settings = db.collection('journalsettings');

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

    // --- 3. fields nothing reads ----------------------------------------------
    // "How I felt" and "Market condition" were asked for on every close and
    // rendered nowhere - byEmotion was computed on every stats call and thrown
    // away by the browser, and marketCondition was never even grouped. The enum
    // behind the first also competed with the trackers: it offered "revenge"
    // while "revenge trade" is one of the four seeds, so the same fact was asked
    // twice in two vocabularies, one of them fixed.
    //
    // tags[] is a second tag array on the model that no screen has ever written.
    const deadFields = { emotionalState: '', marketCondition: '', tags: '' };
    const holding = await entries.countDocuments({
        $or: Object.keys(deadFields).map(f => ({ [f]: { $exists: true } }))
    });
    console.log(`  ${holding} entr(ies) carrying fields nothing reads`);
    if (!dry && holding) await entries.updateMany({}, { $unset: deadFields });

    // --- 4. retire the tags the app now works out ------------------------------
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

    // --- 5. one default book becomes one per market ----------------------------
    // A book holds a single currency, so a lone defaultPortfolioId could only
    // ever be right for one market and was silently wrong for the other - a US
    // trade opening on a PKR book, filtered out of its own picker, starting with
    // no book at all.
    const singles = await settings.find({ defaultPortfolioId: { $exists: true, $ne: null } }).toArray();
    for (const row of singles) {
        const book = await db.collection('portfolios').findOne({ _id: row.defaultPortfolioId });
        const currency = (book?.currency || 'PKR').toUpperCase();
        console.log(`  default book -> ${currency}: ${book?.name || 'a book that no longer exists'}`);
        if (!dry) {
            await settings.updateOne({ _id: row._id }, {
                $set: book ? { [`defaultBooks.${currency}`]: row.defaultPortfolioId } : {},
                $unset: { defaultPortfolioId: '' }
            });
        }
    }
    console.log(`  ${singles.length} settings row(s) with a single default book`);

    // --- 6. "other" is not a setup ---------------------------------------------
    // An earlier migration defaulted every ungraded entry to "other", which reads
    // like an answer and groups like one. A trade whose setup was never named
    // should say so by being blank.
    const othered = await entries.countDocuments({ setupType: 'other' });
    console.log(`  ${othered} entr(ies) whose setup is "other"`);
    if (!dry && othered) await entries.updateMany({ setupType: 'other' }, { $unset: { setupType: '' } });

    // --- 7. each user's lists ------------------------------------------
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

        // Setups the same way. Anything already typed is kept, misspelling and
        // all: "reteset" is on a real trade, and dropping the name would orphan
        // it. It sits in the list where it can be corrected or deleted, which is
        // more than free text ever offered.
        const setupsUsed = (await entries.distinct('setupType', { user }))
            .map(t => String(t || '').trim()).filter(t => t && t !== 'other');
        const setupsHeld = [...new Set([...setupsUsed, ...(existing?.setups || [])])];
        const setups = [...setupsHeld, ...SETUP_SUGGESTIONS.filter(t => !setupsHeld.includes(t))].slice(0, 20);

        const same = (a = [], b = []) => a.length === b.length && a.every((t, i) => t === b[i]);
        if (existing && same(existing.trackers, trackers) && same(existing.setups, setups)) continue;

        const dropped = (existing?.trackers || []).filter(t => !trackers.includes(t));
        console.log(`  ${String(user).slice(-6)}: ${setups.length} setup(s), ${trackers.length} tracker(s)`
            + (dropped.length ? `, dropping ${dropped.join(', ')}` : ''));

        if (!dry) {
            await settings.updateOne(
                { user },
                { $set: { setups, trackers, updatedAt: new Date() },
                  $setOnInsert: { user, askForBook: false, createdAt: new Date() } },
                { upsert: true }
            );
        }
        touched++;
    }

    // --- 8. a review belongs to a finished trade -------------------------------
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
        ? `Dry run. Would write ${touched} settings row(s).`
        : `Wrote ${touched} settings row(s).`);

    await mongoose.disconnect();
};

migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
