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
    stopPlaced: false, eventChecked: false, mistakes: [], exitConfirmed: true,
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
        assert.equal(m.followedPlan, true, 'a well-run loss still followed the plan');
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
        const m = computeMetrics(trade({ entryPrice: 79.47, quantity: 4, markPrice: 71.48 }));
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

describe('followedPlan', () => {
    const base = { exitPrice: 120, plannedStop: 95 };

    test('needs a placed stop, a checked calendar and no mistakes', () => {
        assert.equal(computeMetrics(trade({ ...base, stopPlaced: true, eventChecked: true })).followedPlan, true);
    });

    test('a mistake disqualifies a winner', () => {
        const m = computeMetrics(trade({ ...base, stopPlaced: true, eventChecked: true, mistakes: ['fomo_entry'] }));
        assert.equal(m.followedPlan, false);
        assert.equal(m.outcome, 'win', 'still a win - process and outcome are independent');
    });

    test('an unplaced stop disqualifies regardless of result', () => {
        assert.equal(computeMetrics(trade({ ...base, eventChecked: true })).followedPlan, false);
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
            exitPrice: 73.71, stopPlaced: true, eventChecked: true
        })),
        decorate(trade({
            symbol: 'INTC', entryPrice: 131.68, quantity: 3, exitPrice: 108.09,
            mistakes: ['no_stop_placed', 'no_profit_protection']
        })),
        decorate(trade({
            symbol: 'MAS', entryPrice: 79.47, quantity: 4, markPrice: 71.48,
            mistakes: ['no_stop_placed', 'held_through_event']
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

    test('discipline is measured over every trade, not just closed ones', () => {
        assert.equal(Math.round(s.stopPlacedRate), 14, '1 of 7');
        assert.equal(Math.round(s.followedPlanRate), 14);
    });

    test('separates a well-run loss from a lucky win', () => {
        assert.equal(s.goodProcessBadOutcome, 1, 'DXCM');
        assert.equal(s.badProcessGoodOutcome, 4, 'the wins with no recorded stop');
    });

    test('ranks mistakes by what they cost, worst first', () => {
        assert.equal(s.byMistake[0].code, 'no_stop_placed');
        assert.ok(s.byMistake[0].cost < 0);
        // MAS is open, so only INTC contributes a realised cost.
        assert.equal(s.byMistake[0].count, 1);
    });

    test('the headline shows the book without its worst habit', () => {
        assert.equal(s.headline.mistake, 'no_stop_placed');
        assert.ok(s.headline.netWithout > 0, 'positive once the unstopped loss is removed');
        assert.ok(s.headline.cost < 0);
    });

    test('flags exits taken from memory', () => {
        const withDoubt = statsFor([decorate(trade({ exitPrice: 110, exitConfirmed: false }))]);
        assert.equal(withDoubt.unconfirmedExits, 1);
    });

    test('an empty book does not divide by zero', () => {
        const empty = statsFor([]);
        assert.equal(empty.winRate, 0);
        assert.equal(empty.profitFactor, null);
        assert.equal(empty.avgR, null);
        assert.equal(empty.headline, null);
    });
});
