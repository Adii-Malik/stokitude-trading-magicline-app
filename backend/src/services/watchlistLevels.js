import Watchlist from '../models/Watchlist.js';
import notificationService from './notificationService.js';
import { pricesFor } from './quotes.js';

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
 * Has price reached this level? Pure, so the rule can be checked without a
 * database or a network.
 *
 * Inclusive: a close exactly on the number you named has reached it. A level is
 * a decision boundary, not a strict inequality, and "88.00 when I said 88" is
 * not a case where you want silence.
 */
export function reached(level, price) {
    if (!level || price == null || level.price == null) return false;
    return level.dir === 'above' ? price >= level.price : price <= level.price;
}

/**
 * What this price does to this entry: nothing, wake it, or close it.
 *
 * Invalidation wins when both are somehow reached in the same tick. A gap
 * through both ends of a range is not a setup arriving, it is the idea being
 * wrong in a way that happened to pass your entry on the way, and telling you
 * to look at it would be the wrong instruction.
 */
export function verdictFor(entry, price) {
    if (!entry || price == null) return null;
    if (reached(entry.invalidation, price)) return 'invalidated';
    if (reached(entry.trigger, price)) return 'triggered';
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

        const priceOf = new Map();
        for (const [market, group] of byMarket) {
            const prices = await pricesFor(group.map((e) => e.symbol), market);
            for (const [symbol, price] of prices) priceOf.set(symbol, price);
        }

        let checked = 0, triggered = 0, invalidated = 0, missing = 0;

        for (const entry of entries) {
            const price = priceOf.get(entry.symbol);
            // Counted, not skipped quietly. A level never compared is
            // indistinguishable from one that never printed, and silence is the
            // failure mode this whole area has already had once.
            if (price == null) { missing += 1; continue; }
            checked += 1;

            const verdict = verdictFor(entry, price);
            if (!verdict) continue;

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

export default { reached, verdictFor, checkWatchlistLevels };
