import JournalEntry from '../models/JournalEntry.js';
import notificationService from '../services/notificationService.js';
import { pricesFor } from '../services/quotes.js';

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
export function levelsReached(entry, price) {
    const out = { stop: false, targets: [] };
    if (!price) return out;

    const long = entry.direction !== 'short';

    // Only an open trade has levels worth watching. The query in checkLevels
    // already excludes the rest; this keeps the rule true on its own.
    if (entry.state !== 'open') return out;

    // The stop sits the far side of entry, so its comparison inverts.
    out.stop = !entry.stopHit
        && entry.plannedStop != null
        && (long ? price <= entry.plannedStop : price >= entry.plannedStop);

    (entry.targets || []).forEach((target, i) => {
        if (target.isHit) return;
        if (long ? price >= target.price : price <= target.price) out.targets.push(i);
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
            // Unscoped by circumstance: this runs from a job, where there is no
            // request and so no market, which is exactly right - a stop is a stop
            // in either book.
            const entries = await JournalEntry.find({ state: 'open' });
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

            const priceOf = new Map();
            for (const [market, group] of byMarket) {
                const prices = await pricesFor(group.map(e => e.symbol), market);
                for (const [symbol, price] of prices) priceOf.set(symbol, price);
            }

            let checked = 0, missing = 0;
            const dirty = [];

            for (const entry of entries) {
                const price = priceOf.get(entry.symbol);
                // Counted rather than ignored. A level that is never compared is
                // indistinguishable from one that never printed, and silence was
                // this handler's whole failure mode.
                if (!price) { missing++; continue; }
                checked++;

                const updates = await this.apply(entry, price);
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
    async apply(entry, price) {
        const reached = levelsReached(entry, price);
        const hitAt = new Date();
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
        if (reached.stop
            && await told(() => notificationService.notifyJournalStop(entry, price), 'Stop level reached')) {
            entry.stopHit = true;
            entry.stopHitDate = hitAt;
        }

        for (const i of reached.targets) {
            const target = entry.targets[i];
            const sent = await told(
                () => notificationService.notifyJournalTarget(entry, target, price),
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
