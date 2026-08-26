import Stock from '../models/Stock.js';
import PsxDaily from '../models/PsxDaily.js';

/**
 * The price the app shows, taken from the last session that actually closed.
 *
 * Everything that values a holding reads Stock.currentPrice - the portfolio, the
 * journal ledger, the allocation engine, eight places between them. It used to be
 * written by a poller hitting PSX every five minutes, which was switched off
 * deliberately: nothing here needs a price that moves during the day.
 *
 * With the poller off, currentPrice simply stopped. By the time this was written
 * it was twelve days behind - NCL frozen at 36.27 while the bars the engine
 * fetches every night had it closing at 37.00.
 *
 * So the bars become the source, which they always should have been for a
 * swing-trading book. One aggregate for the newest two sessions per symbol, one
 * bulk write, once a night after the sync that fetched them.
 *
 * Worth stating plainly rather than discovering later: this is an end-of-day
 * price. During a session the portfolio shows the previous close - and it is
 * right about being the previous close, rather than wrong about being today's.
 */

/** Aggregate rows turned into the fields a Stock carries. */
export function priceUpdates(rows) {
    const updates = [];

    for (const { _id: symbol, top } of rows || []) {
        const [latest, previous] = top || [];
        if (!symbol || !latest || latest.close == null) continue;

        const close = latest.close;
        const prior = previous?.close ?? null;
        // A symbol with only one session has no change to report. That is not
        // the same as a change of zero, so it stays null.
        const change = prior == null ? null : Math.round((close - prior) * 100) / 100;
        const percent = prior ? Math.round((change / prior) * 10000) / 100 : null;

        updates.push({
            symbol,
            currentPrice: close,
            previousPrice: prior,
            priceChange: change,
            priceChangePercent: percent,
            open: latest.open ?? null,
            high: latest.high ?? null,
            low: latest.low ?? null,
            volume: latest.volume ?? null,
            // The date of the bar, not the time we copied it. lastUpdated is
            // read as "how current is this price", and the bar's own date is
            // the honest answer to that.
            lastUpdated: latest.date
        });
    }

    return updates;
}

/**
 * Stamps every symbol that has bars with its last close.
 *
 * Delisted names are included on purpose: their last close is still their last
 * close, and it beats whatever the poller happened to catch before it stopped.
 * They hold no shares, so nothing is valued on it either way.
 */
export async function stampPricesFromBars() {
    const rows = await PsxDaily.aggregate([
        {
            $group: {
                _id: '$symbol',
                top: {
                    $topN: {
                        n: 2,
                        sortBy: { date: -1 },
                        output: {
                            date: '$date', close: '$close', open: '$open',
                            high: '$high', low: '$low', volume: '$volume'
                        }
                    }
                }
            }
        }
    ]);

    const updates = priceUpdates(rows);
    if (!updates.length) return { symbols: 0, moved: 0 };

    const before = new Map(
        (await Stock.find({ symbol: { $in: updates.map(u => u.symbol) } })
            .select('symbol currentPrice').lean())
            .map(s => [s.symbol, s.currentPrice])
    );

    await Stock.bulkWrite(
        updates.map(({ symbol, ...set }) => ({
            updateOne: { filter: { symbol }, update: { $set: set } }
        })),
        { ordered: false }
    );

    const moved = updates.filter(u => before.get(u.symbol) !== u.currentPrice).length;
    return { symbols: updates.length, moved };
}

export default { priceUpdates, stampPricesFromBars };
