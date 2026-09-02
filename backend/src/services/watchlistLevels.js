import Watchlist from '../models/Watchlist.js';
import notificationService from './notificationService.js';
import { quotesFor } from './quotes.js';

/**
 * The shortlist's own level watcher.
 *
 * The journal has one already, for the stop and targets of a trade you are in.
 * This is the same idea one step earlier: a price you named while deciding
 * whether to be in it at all.
 *
 * Two levels, and they mean opposite things. A trigger is the thing you were
 * waiting for, so it raises a hand and puts the name back at the top of the
 * queue. An invalidation is the thing that proves you wrong, so it closes the
 * idea - which is the whole answer to marking a name you are no longer
 * interested in. You never do it later, once you have forgotten why you cared;
 * you name the price while you are still thinking clearly, and this does it for
 * you.
 *
 * Most names have neither. That is by design, and it is why nothing here treats
 * an absent level as a problem.
 */

/**
 * Has the session reached this level?
 *
 * Compared against the day's extremes, not the last price, and that is the whole
 * design. A level is reached the moment price touches it - which is how you
 * think about it, and how TradingView's alerts behave - but we cannot watch
 * every tick. The high and the low run from the open, so asking "did the day get
 * there" answers the same question from a snapshot taken at any point, and keeps
 * answering it correctly if a poll is late, slow, or missed entirely.
 *
 * A previous close carries no range and arrives with `live: false`; the extremes
 * are then the close itself, so it degrades to the old one-number comparison
 * rather than inventing a session that never happened.
 *
 * Inclusive: a print exactly on the number you named has reached it. A level is
 * a decision boundary, not a strict inequality, and "530.00 when I said 530" is
 * not a case where you want silence.
 */
export function reached(level, quote) {
    if (!level || !quote || level.price == null) return false;
    return level.dir === 'above' ? quote.high >= level.price : quote.low <= level.price;
}

/** The price to report: the extreme that actually got there. */
export function printedAt(level, quote) {
    return level?.dir === 'above' ? quote.high : quote.low;
}

/**
 * What this price does to this entry: nothing, wake it, or close it.
 *
 * Invalidation wins when both are somehow reached in the same tick. A gap
 * through both ends of a range is not a setup arriving, it is the idea being
 * wrong in a way that happened to pass your entry on the way, and telling you
 * to look at it would be the wrong instruction.
 */
export function verdictFor(entry, quote) {
    if (!entry || !quote) return null;
    if (reached(entry.invalidation, quote)) return 'invalidated';
    if (reached(entry.trigger, quote)) return 'triggered';
    return null;
}

/**
 * Check every live name that carries a level, and tell the owner about the ones
 * that printed.
 *
 * Grouped by market for pricing, because the two books keep their prices in
 * different places and a symbol does not say which. Names without a level are
 * never loaded: the query asks for the ones worth asking about.
 */
export async function checkWatchlistLevels() {
    try {
        const entries = await Watchlist.find({
            state: 'watching',
            $or: [{ 'trigger.price': { $ne: null } }, { 'invalidation.price': { $ne: null } }]
        });
        if (!entries.length) return { checked: 0, triggered: 0, invalidated: 0, missing: 0 };

        const byMarket = new Map();
        for (const entry of entries) {
            const market = entry.market || 'PK';
            if (!byMarket.has(market)) byMarket.set(market, []);
            byMarket.get(market).push(entry);
        }

        const quoteOf = new Map();
        for (const [market, group] of byMarket) {
            const quotes = await quotesFor(group.map((e) => e.symbol), market);
            for (const [symbol, quote] of quotes) quoteOf.set(symbol, quote);
        }

        let checked = 0, triggered = 0, invalidated = 0, missing = 0;

        for (const entry of entries) {
            const quote = quoteOf.get(entry.symbol);
            // Counted, not skipped quietly. A level never compared is
            // indistinguishable from one that never printed, and silence is the
            // failure mode this whole area has already had once.
            if (!quote) { missing += 1; continue; }
            checked += 1;

            const verdict = verdictFor(entry, quote);
            if (!verdict) continue;

            // The number you are told is the one that reached your level, not
            // wherever price happens to be by the time the poll ran.
            const level = verdict === 'invalidated' ? entry.invalidation : entry.trigger;
            const price = printedAt(level, quote);

            /**
             * The flag is written only once the owner has been told.
             *
             * A state written on a failed send is the worst outcome available:
             * the name is closed or de-armed, every later run sees the new state
             * and stays quiet, and you are never told. Leaving it lets the next
             * run try again.
             */
            try {
                if (verdict === 'invalidated') {
                    await notificationService.notifyWatchlistInvalidated(entry, price);
                    entry.state = 'invalidated';
                    entry.invalidatedAt = new Date();
                    entry.invalidatedPrice = price;
                    await entry.save();
                    invalidated += 1;
                } else {
                    await notificationService.notifyWatchlistTrigger(entry, price);
                    // The trigger has done its job. Leaving it armed would fire
                    // again every day until you happened to open the screen.
                    entry.trigger = null;
                    entry.triggeredAt = new Date();
                    entry.triggeredPrice = price;
                    await entry.save();
                    triggered += 1;
                }
            } catch (error) {
                console.error(`Could not tell you about ${entry.symbol}, will retry:`, error.message);
            }
        }

        return { checked, triggered, invalidated, missing };
    } catch (error) {
        console.error('Error checking watchlist levels:', error);
        return { error: error.message };
    }
}

export default { reached, printedAt, verdictFor, checkWatchlistLevels };
