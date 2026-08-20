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

describe('planned trades', () => {
    // A level being watched, with no fill and therefore no size or entry price.
    const plan = (o = {}) => ({
        symbol: 'OGDC', currency: 'PKR', direction: 'long', state: 'planned',
        entryFrom: 95, entryTo: 105, plannedStop: 90,
        targets: [{ level: 1, price: 120, isHit: false }],
        mistakes: [], ...o
    });

    test('claims no P/L of any kind', () => {
        const m = computeMetrics(plan());
        assert.equal(m.status, 'planned');
        assert.equal(m.netPnL, null);
        assert.equal(m.unrealizedPnL, null);
        assert.equal(m.outcome, null);
    });

    test('risk is measured from the midpoint of the zone it waits for', () => {
        // Midpoint 100, stop 90, target 120: one unit of risk for two of reward.
        assert.equal(computeMetrics(plan()).plannedRR, 2);
    });

    test('R:R survives having no quantity yet', () => {
        const m = computeMetrics(plan());
        assert.equal(m.riskAmount, null, 'no size means no rupee risk');
        assert.equal(m.plannedRR, 2, 'but the ratio still holds');
    });

    test('a single bound is treated as the whole zone', () => {
        const m = computeMetrics(plan({ entryFrom: 100, entryTo: undefined }));
        assert.equal(m.plannedRR, 2);
    });

    test('discipline is not judged before the trade is taken', () => {
        assert.equal(computeMetrics(plan()).followedPlan, null);
    });

    test('no numeric field comes back NaN', () => {
        // The entry price fields are absent, so every derived number has to
        // either compute from the zone or return null.
        const m = computeMetrics(plan());
        for (const [key, value] of Object.entries(m)) {
            assert.ok(!Number.isNaN(value), `${key} is NaN`);
        }
    });

    test('an exit price beats a stale planned state', () => {
        // Guards the reverse of the migration hazard: state must never keep a
        // trade planned once it has a result.
        assert.equal(computeMetrics(plan({ exitPrice: 120, entryPrice: 100, quantity: 10 })).status, 'closed');
    });
});

describe('levels that never triggered', () => {
    const cancelled = (o = {}) => ({
        symbol: 'X', currency: 'PKR', direction: 'long', state: 'cancelled',
        entryFrom: 95, entryTo: 105, plannedStop: 90,
        targets: [{ level: 1, price: 120, isHit: false }], mistakes: [], ...o
    });

    test('report as cancelled rather than quietly reading open', () => {
        // The schema default is 'open', so anything that forgets cancelled here
        // turns an abandoned level into a position you think you hold.
        assert.equal(computeMetrics(cancelled()).status, 'cancelled');
    });

    test('claim no P/L', () => {
        const m = computeMetrics(cancelled());
        assert.equal(m.netPnL, null);
        assert.equal(m.unrealizedPnL, null);
        assert.equal(m.outcome, null);
    });

    test('are not judged on discipline', () => {
        assert.equal(computeMetrics(cancelled()).followedPlan, null);
    });

    test('keep the R:R they were planned at', () => {
        // Worth keeping: it says what you passed up.
        assert.equal(computeMetrics(cancelled()).plannedRR, 2);
    });

    test('are counted separately from watched and taken trades', () => {
        const s = statsFor([
            decorate(cancelled()),
            decorate(cancelled({ state: 'planned' })),
            decorate({
                symbol: 'A', currency: 'PKR', direction: 'long', quantity: 10,
                entryPrice: 100, exitPrice: 110, mistakes: [], state: 'closed'
            })
        ]);
        assert.equal(s.totalTrades, 1, 'only the trade actually taken');
        assert.equal(s.plannedTrades, 1);
        assert.equal(s.cancelledTrades, 1);
        assert.equal(s.openTrades, 0);
    });
});

describe('follow-through on levels written in advance', () => {
    // A trade keeps its entry zone after it opens, so a recorded zone is what marks
    // an entry as one that started as a plan.
    const level = (state, o = {}) => decorate({
        symbol: 'X', currency: 'PKR', direction: 'long', state,
        entryFrom: 95, entryTo: 105, mistakes: [], ...o
    });
    const taken = (state) => level(state, { entryPrice: 100, quantity: 10, entryDate: '2026-01-01' });

    test('counts planned levels that were entered against those let go', () => {
        const s = statsFor([
            taken('open'),
            taken('closed'),
            level('cancelled'),
            level('planned')
        ]);
        assert.equal(s.levelsTaken, 2);
        assert.equal(s.levelsAbandoned, 1);
        assert.equal(s.plannedTrades, 1, 'still waiting, so not settled either way');
    });

    test('follow-through counts only settled levels', () => {
        // Two of three settled were taken. The one still being watched is not
        // evidence of anything yet.
        const s = statsFor([taken('open'), taken('closed'), level('cancelled'), level('planned')]);
        assert.equal(Math.round(s.triggerRate), 67);
    });

    test('is null rather than zero when nothing has settled', () => {
        // A 0% follow-through on no evidence would read as a damning statistic.
        assert.equal(statsFor([level('planned')]).triggerRate, null);
        assert.equal(statsFor([]).triggerRate, null);
    });

    test('impulse trades with no recorded zone are not counted', () => {
        const s = statsFor([decorate({
            symbol: 'Y', currency: 'PKR', direction: 'long', state: 'closed',
            entryPrice: 100, quantity: 10, exitPrice: 110, mistakes: []
        })]);
        assert.equal(s.levelsTaken, 0, 'it was never planned, so it cannot be followed through on');
        assert.equal(s.triggerRate, null);
    });
});

describe('setup quality', () => {
    test('groups closed trades by the grade given before the outcome', () => {
        const trade = (quality, exitPrice) => decorate({
            symbol: 'X', currency: 'PKR', direction: 'long', quantity: 10,
            entryPrice: 100, exitPrice, setupQuality: quality, mistakes: [], state: 'closed'
        });
        const s = statsFor([trade('excellent', 120), trade('poor', 90), trade('poor', 95)]);

        const poor = s.byQuality.find(q => q.key === 'poor');
        const excellent = s.byQuality.find(q => q.key === 'excellent');
        assert.equal(poor.count, 2);
        assert.equal(poor.winRate, 0);
        assert.equal(excellent.winRate, 100);
    });
});

describe('planned trades in the stats', () => {
    const taken = decorate({
        symbol: 'A', currency: 'PKR', direction: 'long', quantity: 10, entryPrice: 100,
        exitPrice: 110, stopPlaced: true, eventChecked: true, mistakes: [], state: 'closed'
    });
    const watching = decorate({
        symbol: 'B', currency: 'PKR', direction: 'long', state: 'planned',
        entryFrom: 95, entryTo: 105, mistakes: []
    });
    const s = statsFor([taken, watching]);

    test('are counted apart from trades actually taken', () => {
        assert.equal(s.totalTrades, 1);
        assert.equal(s.plannedTrades, 1);
        assert.equal(s.openTrades, 0, 'watching a level is not holding a position');
    });

    test('do not dilute the discipline rates', () => {
        // The one real trade placed its stop. A watchlist entry must not drag
        // that to 50%.
        assert.equal(s.stopPlacedRate, 100);
        assert.equal(s.followedPlanRate, 100);
    });
});
