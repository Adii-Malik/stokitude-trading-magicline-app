import FIFOCalculator from './FIFOCalculator.js';

/**
 * NCCPL settlement, which is how a PSX trade is actually closed out.
 *
 * Not plain FIFO. NCCPL settles after the close, and matches a sell against any
 * purchase of the same stock made that same day before reaching into older
 * holdings:
 *
 *   - the same-day portion settles LIFO, newest same-day lot first
 *   - anything sold beyond what was bought that day settles FIFO, oldest first
 *
 * The difference is not cosmetic. Hold 100 bought three years ago, then day-trade
 * 100 today: plain FIFO consumes the old lot, reports the whole three-year gain
 * as realised and leaves you holding a fresh short-term lot. NCCPL matches the
 * day's own purchase, reports only the day's gain, and leaves the old lot where
 * it was - still long-term, still exempt.
 *
 * Because settlement happens after the close, order within the day is irrelevant:
 * selling and buying back the same day settles identically to buying then
 * selling. That is why buys are pulled ahead of sells within a day below.
 *
 * Days are compared in UTC. Every PSX session hour (09:15-15:30 PKT) falls inside
 * the same UTC date, so the two agree for any real trade.
 */
export default class NCCPLCalculator extends FIFOCalculator {
    getName() {
        return 'NCCPL';
    }

    getDescription() {
        return 'PSX settlement: same-day trades LIFO, older holdings FIFO (as NCCPL settles)';
    }

    /**
     * Prefer a lot bought on the day of the sell, newest first. Falling back to
     * index 0 is plain FIFO, which is exactly the rule for the excess quantity.
     */
    pickLot(lots, sell) {
        const day = utcDay(sell.executedAt);

        for (let i = lots.length - 1; i >= 0; i--) {
            if (utcDay(lots[i].purchaseDate) === day) return i;
        }

        return 0;
    }

    /**
     * Settle each day as a whole: a same-day purchase is available to a same-day
     * sale whichever happened first on the clock. Only BUY is moved, and only
     * relative to SELL, so splits and bonuses keep the position they had.
     */
    orderForSettlement(sorted) {
        const rank = (tx) => (tx.type === 'BUY' ? 0 : 1);

        return sorted
            .map((tx, i) => ({ tx, i }))
            .sort((a, b) => {
                const dayA = utcDay(a.tx.executedAt);
                const dayB = utcDay(b.tx.executedAt);
                if (dayA !== dayB) return a.i - b.i;
                // Same day: buys first, otherwise keep the original order.
                return rank(a.tx) - rank(b.tx) || a.i - b.i;
            })
            .map(({ tx }) => tx);
    }
}

const utcDay = (date) => {
    const d = new Date(date);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
};
