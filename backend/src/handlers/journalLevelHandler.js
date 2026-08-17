import JournalEntry from '../models/JournalEntry.js';
import Stock from '../models/Stock.js';
import notificationService from '../services/notificationService.js';

/**
 * Journal Level Handler
 * Watches the levels recorded on journal entries against the prices the poll
 * has just written: the entry zone of a planned trade, and the stop and targets
 * of an open one.
 *
 * It never opens or closes a trade. A fill is a real event with a real price and
 * the ledger owns those; this only raises a hand and says the level printed.
 */

/**
 * Which of an entry's levels the current price has reached, ignoring any already
 * flagged. Pure, so the rules can be tested without a database.
 *
 * @returns {{ entryZone: boolean, stop: boolean, targets: number[] }} targets are
 *          indices into entry.targets.
 */
export function levelsReached(entry, price) {
    const out = { entryZone: false, stop: false, targets: [] };
    if (!price) return out;

    const long = entry.direction !== 'short';

    if (entry.state === 'planned') {
        // A planned trade is waiting for price to reach the band it was written
        // for. Its stop and targets are hypothetical until it is entered.
        if (entry.entryZoneHit) return out;

        const bounds = [entry.entryFrom, entry.entryTo].filter(n => n != null);
        // One bound given means an exact level rather than a band.
        out.entryZone = bounds.length > 0
            && price >= Math.min(...bounds)
            && price <= Math.max(...bounds);
        return out;
    }

    if (entry.state === 'closed') return out;

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
 * No socket broadcast here, unlike tradePlanHandler. Trade calls were public by
 * design; a journal is one person's record, and this app's sockets are neither
 * authenticated nor divided into per-user rooms, so io.emit would hand every
 * connected client someone else's levels. Notifications already go to the owner
 * alone. Live updates need authenticated sockets first.
 */
class JournalLevelHandler {
    async checkLevels() {
        try {
            const entries = await JournalEntry.find({ state: { $in: ['planned', 'open'] } });
            if (!entries.length) return { checked: 0, updated: 0 };

            // One price lookup covering every symbol involved. Per-entry findOne
            // was a round trip each, and a watchlist is mostly the same names.
            const symbols = [...new Set(entries.map(e => e.symbol))];
            const stocks = await Stock.find({ symbol: { $in: symbols } })
                .select('symbol currentPrice').lean();
            const priceOf = new Map(stocks.map(s => [s.symbol, s.currentPrice]));

            let checked = 0;
            const dirty = [];

            for (const entry of entries) {
                const price = priceOf.get(entry.symbol);
                if (!price) continue;
                checked++;

                if (this.apply(entry, price).length) dirty.push(entry);
            }

            await Promise.all(dirty.map(e => e.save()));

            return { checked, updated: dirty.length };
        } catch (error) {
            console.error('Error checking journal levels:', error);
            return { error: error.message };
        }
    }

    /** Flags what price reached and tells the owner. Returns a label per hit. */
    apply(entry, price) {
        const reached = levelsReached(entry, price);
        const hitAt = new Date();
        const updates = [];
        const warn = (what) => (err) => console.error(`Failed to send ${what} notification:`, err);

        if (reached.entryZone) {
            entry.entryZoneHit = true;
            entry.entryZoneHitDate = hitAt;
            updates.push('Entry zone reached');
            notificationService.notifyJournalEntryZone(entry, price).catch(warn('entry zone'));
        }

        if (reached.stop) {
            // Flagged, never acted on: closing the entry here would invent an
            // exit price the broker never gave.
            entry.stopHit = true;
            entry.stopHitDate = hitAt;
            updates.push('Stop level reached');
            notificationService.notifyJournalStop(entry, price).catch(warn('stop'));
        }

        for (const i of reached.targets) {
            const target = entry.targets[i];
            target.isHit = true;
            target.hitDate = hitAt;
            updates.push(`Target ${target.level} reached`);
            notificationService.notifyJournalTarget(entry, target, price).catch(warn('target'));
        }

        return updates;
    }
}

export default new JournalLevelHandler();
