/**
 * Journal maths tests.
 *
 * Everything here is derived on read, so these guard the numbers the UI shows
 * without needing a database.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, decorate, statsFor } from './journalService.js';

const trade = (o = {}) => ({
    symbol: 'X', currency: 'USD', direction: 'long', quantity: 10,
    entryPrice: 100, entryDate: '2026-01-01', fees: 0,
    whatHappened: [],
    ...o
});

describe('per-trade metrics', () => {
    test('a closed long books proceeds less cost and fees', () => {
        const m = computeMetrics(trade({ exitPrice: 120, exitDate: '2026-01-05', fees: 5 }));
        assert.equal(m.status, 'closed');
        assert.equal(m.grossPnL, 200);
        assert.equal(m.netPnL, 195);
        assert.equal(m.outcome, 'win');
        assert.equal(m.pnlPct, 19.5);
    });

    test('a short profits when price falls', () => {
        const m = computeMetrics(trade({ direction: 'short', exitPrice: 90 }));
        assert.equal(m.netPnL, 100);
        assert.equal(m.outcome, 'win');
    });

    test('DXCM is exactly minus one R', () => {
        // The reference trade: stop placed at 73.71 and filled there.
        const m = computeMetrics(trade({
            entryPrice: 77.575, quantity: 5, plannedStop: 73.71,
            exitPrice: 73.71, exitDate: '2026-06-15', stopPlaced: true, eventChecked: true
        }));
        assert.equal(Math.round(m.netPnL * 100) / 100, -19.33);
        assert.equal(Math.round(m.rMultiple * 1000) / 1000, -1);
        assert.equal(m.exitReason, 'stop hit', 'exited at the level, so the record reads as the plan running');
    });

    test('an exit price alone closes a trade, even with no exit date', () => {
        // Trades reconstructed from statements often have a result and no date.
        assert.equal(computeMetrics(trade({ exitPrice: 110 })).status, 'closed');
    });

    test('an open trade claims no realized P/L', () => {
        const m = computeMetrics(trade());
        assert.equal(m.status, 'open');
        assert.equal(m.netPnL, null);
        assert.equal(m.outcome, null);
        assert.equal(m.unrealizedPnL, null);
    });

    test('a marked open trade shows unrealized only', () => {
        // lastPrice comes from the price poll, not from the trader typing it.
        const m = computeMetrics(trade({ entryPrice: 79.47, quantity: 4, lastPrice: 71.48 }));
        assert.equal(Math.round(m.unrealizedPnL * 100) / 100, -31.96);
        assert.equal(Math.round(m.unrealizedPct * 100) / 100, -10.05);
        assert.equal(m.netPnL, null, 'unrealized must never leak into realized');
    });

    test('no stop means no R multiple rather than a fabricated one', () => {
        const m = computeMetrics(trade({ exitPrice: 120 }));
        assert.equal(m.rMultiple, null);
        assert.equal(m.riskAmount, null);
    });
});

describe('fees on both legs', () => {
    // A round trip is charged twice, at different rates. One combined field meant
    // closing a booked trade billed the sell the buy's commission.
    test('net P/L subtracts the entry and the exit', () => {
        const m = computeMetrics(trade({
            entryPrice: 900, quantity: 10, exitPrice: 960, fees: 13.50, exitFees: 14.40
        }));
        assert.equal(m.grossPnL, 600);
        assert.equal(Math.round(m.netPnL * 100) / 100, 572.10);
    });

    test('an absent exit fee costs nothing rather than NaN', () => {
        const m = computeMetrics(trade({ exitPrice: 120, fees: 5 }));
        assert.equal(m.netPnL, 195);
    });

    test('fees alone can turn a gross win into a net loss', () => {
        // The reason the journal reports net rather than gross at all.
        const m = computeMetrics(trade({
            entryPrice: 100, quantity: 1, exitPrice: 101, fees: 1, exitFees: 1
        }));
        assert.equal(m.grossPnL, 1);
        assert.equal(m.netPnL, -1);
        assert.equal(m.outcome, 'loss');
    });
});

describe('how a trade ended, derived rather than asked', () => {
    test('exiting at or through the stop reads as the stop being hit', () => {
        assert.equal(computeMetrics(trade({ plannedStop: 95, exitPrice: 95 })).exitReason, 'stop hit');
        assert.equal(computeMetrics(trade({ plannedStop: 95, exitPrice: 91 })).exitReason, 'stop hit',
            'a gap through the level is still the stop being hit');
    });

    test('reaching a target beats being short of the next one', () => {
        const m = computeMetrics(trade({
            plannedStop: 95, targets: [{ level: 1, price: 110 }, { level: 2, price: 130 }], exitPrice: 115
        }));
        assert.equal(m.exitReason, 'target hit');
    });

    test('between the stop and the first target is closing early', () => {
        const m = computeMetrics(trade({
            plannedStop: 95, targets: [{ level: 1, price: 130 }], exitPrice: 105
        }));
        assert.equal(m.exitReason, 'closed early');
    });

    test('a short inverts every comparison', () => {
        const short = { direction: 'short', quantity: 10, entryPrice: 100 };
        assert.equal(computeMetrics(trade({ ...short, plannedStop: 105, exitPrice: 107 })).exitReason, 'stop hit');
        assert.equal(computeMetrics(trade({ ...short, targets: [{ level: 1, price: 90 }], exitPrice: 88 })).exitReason, 'target hit');
    });

    test('with no levels recorded there is nothing to read', () => {
        // "Closed early" against nothing would be an accusation, not a fact.
        assert.equal(computeMetrics(trade({ exitPrice: 105 })).exitReason, null);
    });

    test('an open trade has not ended', () => {
        assert.equal(computeMetrics(trade({ plannedStop: 95 })).exitReason, null);
    });
});

describe('aggregate stats', () => {
    const entries = [
        // 4 wins, 2 losses - the real shape of the seeded book.
        decorate(trade({ symbol: 'UPS', entryPrice: 107.43, quantity: 4, exitPrice: 109.155 })),
        decorate(trade({ symbol: 'UPS', entryPrice: 101.74, quantity: 5, exitPrice: 108.31 })),
        decorate(trade({ symbol: 'UPS', entryPrice: 106.095, quantity: 4, exitPrice: 110.60 })),
        decorate(trade({ symbol: 'SMCI', entryPrice: 42.027, quantity: 3, exitPrice: 50.16 })),
        decorate(trade({
            symbol: 'DXCM', entryPrice: 77.575, quantity: 5, plannedStop: 73.71,
            exitPrice: 73.71
        })),
        decorate(trade({
            symbol: 'INTC', entryPrice: 131.68, quantity: 3, exitPrice: 108.09,
            whatHappened: ['chased the move']
        })),
        decorate(trade({
            symbol: 'MAS', entryPrice: 79.47, quantity: 4, plannedStop: 74,
            whatHappened: ['held through earnings']
        }))
    ];
    const s = statsFor(entries);

    test('counts open and closed separately', () => {
        assert.equal(s.totalTrades, 7);
        assert.equal(s.closedTrades, 6);
        assert.equal(s.openTrades, 1);
    });

    test('a good win rate can still lose money', () => {
        assert.equal(s.wins, 4);
        assert.equal(s.losses, 2);
        assert.equal(Math.round(s.winRate), 67);
        assert.ok(s.netPnL < 0, 'four wins do not cover one unstopped loss');
        assert.ok(s.profitFactor < 1);
    });

    test('the open trade stays out of realized totals', () => {
        const closedSum = entries
            .filter(e => e.status === 'closed')
            .reduce((t, e) => t + e.netPnL, 0);
        assert.equal(Math.round(s.netPnL * 100), Math.round(closedSum * 100));
    });

    test('the payoff ratio compares the size of a win to the size of a loss', () => {
        // Win rate alone says nothing: this book wins two thirds of the time and
        // still loses money, because one loss is bigger than four wins.
        assert.ok(s.payoffRatio < 1, 'wins are smaller than losses here');
        assert.equal(Math.round(s.payoffRatio * 1000) / 1000,
            Math.round((s.avgWin / s.avgLoss) * 1000) / 1000);
    });

    test('open risk counts only what is still at stake', () => {
        // MAS is the one open trade: 4 shares, 79.47 down to a stop at 74.
        assert.equal(Math.round(s.openRisk * 100) / 100, 21.88);
        assert.equal(s.openWithoutStop, 0);
    });

    test('the stop checks are read off the entries, never from a tag', () => {
        // DXCM is the only closed trade carrying a stop.
        assert.deepEqual(s.stopSet, { n: 1, of: 6 });
        assert.deepEqual(s.stopHonoured, { n: 1, of: 1 }, 'exited exactly at the level');
    });

    test('a stop let through counts against you however it happened', () => {
        const gapped = decorate(trade({ plannedStop: 95, exitPrice: 88 }));
        assert.deepEqual(statsFor([gapped]).stopHonoured, { n: 0, of: 1 });
    });

    test('trackers are counted and totalled, and nothing more is read into them', () => {
        const chased = s.byTracker.find(t => t.name === 'chased the move');
        assert.equal(chased.count, 1);
        assert.ok(chased.netPnL < 0);
        // MAS is open, so its tracker contributes no realised total.
        assert.equal(s.byTracker.find(t => t.name === 'held through earnings'), undefined);
    });

    test('an empty book does not divide by zero', () => {
        const empty = statsFor([]);
        assert.equal(empty.winRate, 0);
        assert.equal(empty.profitFactor, null);
        assert.equal(empty.avgR, null);
        assert.equal(empty.payoffRatio, null);
        assert.equal(empty.openRisk, 0);
    });
});

describe('what the trader is asked for', () => {
    test('a losing trade taken properly is visible without anyone saying so', () => {
        // The whole reason for the tag taxonomy this replaced: a loss can be
        // well run. The record already knew - the stop was set and honoured.
        const m = computeMetrics(trade({ exitPrice: 95, plannedStop: 95 }));
        assert.equal(m.outcome, 'loss');
        assert.equal(m.exitReason, 'stop hit');
        assert.deepEqual(statsFor([decorate(trade({ exitPrice: 95, plannedStop: 95 }))]).stopHonoured,
            { n: 1, of: 1 });
    });

    test('an untagged trade is not read as anything', () => {
        // The old followedPlan returned true for every untagged trade, because
        // [].every() is true - so the rate measured tagging, not discipline.
        const s = statsFor([decorate(trade({ exitPrice: 120 }))]);
        assert.equal(s.byTracker.length, 0);
        assert.deepEqual(s.stopSet, { n: 0, of: 1 }, 'silence is not a pass');
    });

    test('two trades tapping the same tracker land in one row', () => {
        const s = statsFor([
            decorate(trade({ exitPrice: 90, whatHappened: ['revenge trade'] })),
            decorate(trade({ exitPrice: 95, whatHappened: ['revenge trade'] }))
        ]);
        assert.equal(s.byTracker.length, 1);
        assert.equal(s.byTracker[0].count, 2);
    });
});
