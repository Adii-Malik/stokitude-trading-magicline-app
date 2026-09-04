import JournalEntry from '../models/JournalEntry.js';
import notificationService from '../services/notificationService.js';
import { quotesFor } from '../services/quotes.js';
import { reached, printFor } from '../services/watchlistLevels.js';

/**
 * Journal Level Handler
 * Watches the stop and targets of an open trade against the prices the poll has
 * just written.
 *
 * It never opens or closes a trade. A fill is a real event with a real price and
 * the ledger owns those; this only raises a hand and says the level printed.
 */

/**
 * Which of an entry's levels the current price has reached, ignoring any already
 * flagged. Pure, so the rules can be tested without a database.
 *
 * @returns {{ stop: boolean, targets: number[] }} targets are indices into
 *          entry.targets.
 */
/**
 * Which of this trade's levels the session reached.
 *
 * Compared against the day's extremes, through the same `reached` the shortlist
 * watcher uses. It compared the *last* price, which asks "is it there right now,
 * at the moment the poll happened to run" - so a stop breached intraday and
 * recovered before the next fifteen-minute run was never reported. On the one
 * level with real money behind it, while the shortlist beside it was already
 * being watched properly. One comparison for both now.
 *
 * A stop sits the far side of entry, so its side is the inverse of the trade's.
 */
export function levelsReached(entry, quote) {
    const out = { stop: false, targets: [] };

    // A quote with no usable extremes reports nothing. It used to be `!price`,
    // and a quote object is always truthy - without this every long in the book
    // stops out the moment the feed answers with a zero.
    if (!quote || !(quote.high > 0) || !(quote.low > 0)) return out;

    // Only an open trade has levels worth watching. The query in checkLevels
    // already excludes the rest; this keeps the rule true on its own.
    if (entry.state !== 'open') return out;

    const long = entry.direction !== 'short';
    const stopSide = long ? 'below' : 'above';
    const targetSide = long ? 'above' : 'below';

    out.stop = !entry.stopHit
        && entry.plannedStop != null
        && reached({ price: entry.plannedStop, dir: stopSide }, quote);

    (entry.targets || []).forEach((target, i) => {
        if (target.isHit) return;
        if (reached({ price: target.price, dir: targetSide }, quote)) out.targets.push(i);
    });

    return out;
}

/**
 * No socket broadcast, deliberately. A journal is one person's record, and this
 * app's sockets are neither authenticated nor divided into per-user rooms, so
 * io.emit would hand every connected client someone else's levels. Notifications
 * already go to the owner alone. Live updates need authenticated sockets first.
 */
class JournalLevelHandler {
    async checkLevels() {
        try {
            /**
             * Unscoped by circumstance: this runs from a job, where there is no
             * request and so no market, which is exactly right - a stop is a stop
             * in either book.
             *
             * Only the ones that have something to compare. An open trade with
             * no stop and no target was loaded and priced on every run to be
             * told there was nothing to check - which cost a document and a
             * symbol in the quote request, every fifteen minutes, forever.
             */
            const entries = await JournalEntry.find({
                state: 'open',
                $or: [{ plannedStop: { $ne: null } }, { 'targets.0': { $exists: true } }]
            });
            if (!entries.length) return { checked: 0, updated: 0, missing: 0 };

            /**
             * Grouped by market, because the two books keep their prices in
             * different places - PSX in the warehouse, the US on the board - and
             * a symbol alone does not say which. One lookup per market, not one
             * per entry: open positions repeat their names.
             */
            const byMarket = new Map();
            for (const entry of entries) {
                const market = entry.market || 'PK';
                if (!byMarket.has(market)) byMarket.set(market, []);
                byMarket.get(market).push(entry);
            }

            const quoteOf = new Map();
            for (const [market, group] of byMarket) {
                const quotes = await quotesFor(group.map(e => e.symbol), market);
                for (const [symbol, quote] of quotes) quoteOf.set(symbol, quote);
            }

            let checked = 0, missing = 0;
            const dirty = [];

            for (const entry of entries) {
                const quote = quoteOf.get(entry.symbol);
                // Counted rather than ignored. A level that is never compared is
                // indistinguishable from one that never printed, and silence was
                // this handler's whole failure mode.
                if (!quote) { missing++; continue; }
                checked++;

                const updates = await this.apply(entry, quote);
                if (updates.length) dirty.push(entry);
            }

            await Promise.all(dirty.map(e => e.save()));

            return { checked, updated: dirty.length, missing };
        } catch (error) {
            console.error('Error checking journal levels:', error);
            return { error: error.message };
        }
    }

    /**
     * Flags what price reached and tells the owner. Returns a label per hit.
     *
     * The flag is only set once the notification has been sent, not before. A
     * flag written on a failed send is the worst outcome available: the alert is
     * lost and every later poll sees the flag and stays quiet, so you are never
     * told. Leaving it unset lets the next poll retry.
     *
     * A notification deliberately skipped - preferences off, user inactive -
     * counts as sent, because retrying that forever would never succeed.
     */
    async apply(entry, quote) {
        const hit = levelsReached(entry, quote);
        const hitAt = new Date();

        // The side each level was crossed from, so the message can name the
        // extreme that got there rather than calling it the current price.
        const long = entry.direction !== 'short';
        const printOf = (price, dir) => printFor({ price, dir }, quote);
        const updates = [];

        const told = async (send, label) => {
            try {
                const { failed } = await send();
                if (failed) throw new Error(`${failed} recipient(s) failed`);
                updates.push(label);
                return true;
            } catch (error) {
                console.error(`Could not notify "${label}" for ${entry.symbol}, will retry:`, error.message);
                return false;
            }
        };

        // Flagged, never acted on: closing the entry here would invent an exit
        // price the broker never gave.
        if (hit.stop
            && await told(() => notificationService.notifyJournalStop(
                entry, printOf(entry.plannedStop, long ? 'below' : 'above')), 'Stop level reached')) {
            entry.stopHit = true;
            entry.stopHitDate = hitAt;
        }

        for (const i of hit.targets) {
            const target = entry.targets[i];
            const sent = await told(
                () => notificationService.notifyJournalTarget(
                    entry, target, printOf(target.price, long ? 'above' : 'below')),
                `Target ${target.level} reached`
            );
            if (sent) {
                target.isHit = true;
                target.hitDate = hitAt;
            }
        }

        return updates;
    }
}

export default new JournalLevelHandler();
