/**
 * Calculator tests.
 *
 * These cover the bugs that actually corrupted live positions, so a
 * regression here fails the build rather than the portfolio.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import AverageCostCalculator from './AverageCostCalculator.js';
import FIFOCalculator from './FIFOCalculator.js';

const avg = new AverageCostCalculator();
const fifo = new FIFOCalculator();

const tx = (type, quantity, price, overrides = {}) => ({
    type, quantity, price, fees: 0,
    executedAt: '2026-08-09T00:00:00.000Z',
    ...overrides
});

describe('same-day ordering', () => {
    // The original bug: a SELL sorted ahead of its BUYs on a shared date,
    // priced against a zero basis and booked the whole proceeds as profit.
    const sameDay = [
        tx('SELL', 5000, 16.00, { createdAt: '2026-08-09T10:02:00Z', _id: 'c' }),
        tx('BUY', 5000, 17.00, { createdAt: '2026-08-09T10:00:00Z', _id: 'a' }),
        tx('BUY', 5000, 16.37, { createdAt: '2026-08-09T10:01:00Z', _id: 'b' })
    ];

    test('average cost settles the buys before the sell', () => {
        const r = avg.calculate(sameDay, 16.37);
        assert.equal(r.netShares, 5000);
        assert.equal(r.costBasis, 83425);
        assert.equal(r.realizedPnL, -3425);
    });

    test('insertion order breaks ties, not array order', () => {
        const shuffled = [sameDay[1], sameDay[0], sameDay[2]];
        assert.deepEqual(avg.calculate(shuffled, 16.37), avg.calculate(sameDay, 16.37));
    });

    test('FIFO agrees with average cost on a single-price-per-lot set', () => {
        const r = fifo.calculate(sameDay, 16.37);
        assert.equal(r.netShares, 5000);
    });
});

describe('overselling', () => {
    const oversold = [tx('BUY', 100, 10), tx('SELL', 150, 12, { createdAt: '2026-08-09T11:00:00Z' })];

    test('average cost prices only the shares actually held', () => {
        const r = avg.calculate(oversold, 12);
        assert.equal(r.netShares, 0);
        assert.equal(r.realizedPnL, 200, 'profit on 100 shares, not 150');
        assert.equal(r.oversoldShares, 50);
        assert.equal(r.costBasis, 0);
    });

    test('FIFO reports the same excess', () => {
        const r = fifo.calculate(oversold, 12);
        assert.equal(r.netShares, 0);
        assert.equal(r.oversoldShares, 50);
    });
});

describe('splits and bonuses', () => {
    test('a 2:1 split doubles shares and leaves cost untouched', () => {
        const r = avg.calculate([
            tx('BUY', 100, 50),
            tx('SPLIT', 0, 0, { ratio: '2:1', createdAt: '2026-08-09T11:00:00Z' })
        ], 25);
        assert.equal(r.netShares, 200);
        assert.equal(r.costBasis, 5000);
        assert.equal(r.avgCost, 25);
    });

    test('a 20% bonus adds a fifth of the shares', () => {
        const r = avg.calculate([
            tx('BUY', 100, 50),
            tx('BONUS', 0, 0, { ratio: '20%', createdAt: '2026-08-09T11:00:00Z' })
        ], 50);
        assert.equal(r.netShares, 120);
        assert.equal(r.costBasis, 5000);
    });

    test('FIFO scales every lot and keeps each lot cost intact', () => {
        const r = fifo.calculate([
            tx('BUY', 100, 50),
            tx('BUY', 100, 60, { createdAt: '2026-08-09T10:30:00Z' }),
            tx('SPLIT', 0, 0, { ratio: '2:1', createdAt: '2026-08-09T11:00:00Z' })
        ], 30);
        assert.equal(r.netShares, 400);
        assert.equal(r.costBasis, 11000);
    });

    test('a junk ratio is a no-op rather than wiping the position', () => {
        const r = avg.calculate([
            tx('BUY', 100, 50),
            tx('SPLIT', 0, 0, { ratio: 'nonsense', createdAt: '2026-08-09T11:00:00Z' })
        ], 50);
        assert.equal(r.netShares, 100);
    });
});

describe('FIFO lot consumption', () => {
    test('sells the oldest lot first', () => {
        // 100 @ 10 then 100 @ 20; selling 100 realises the cheap lot.
        const r = fifo.calculate([
            tx('BUY', 100, 10, { executedAt: '2026-01-01T00:00:00Z' }),
            tx('BUY', 100, 20, { executedAt: '2026-02-01T00:00:00Z' }),
            tx('SELL', 100, 30, { executedAt: '2026-03-01T00:00:00Z' })
        ], 30);
        assert.equal(r.netShares, 100);
        assert.equal(r.realizedPnL, 2000, '(30-10) x 100');
        assert.equal(r.costBasis, 2000, 'the 20 lot remains');
    });
});

describe('fees', () => {
    test('buy fees join the cost basis', () => {
        const r = avg.calculate([tx('BUY', 100, 10, { fees: 50 })], 10);
        assert.equal(r.costBasis, 1050);
        assert.equal(r.unrealizedPnL, -50);
    });

    test('sell fees come out of proceeds', () => {
        const r = avg.calculate([
            tx('BUY', 100, 10),
            tx('SELL', 100, 12, { fees: 20, createdAt: '2026-08-09T11:00:00Z' })
        ], 12);
        assert.equal(r.realizedPnL, 180, '200 profit less 20 in fees');
    });
});

describe('statutory charges', () => {
    test('other charges join the cost basis alongside commission', () => {
        const r = avg.calculate([tx('BUY', 500, 17.35, { fees: 15, otherCharges: 4 })], 17.35);
        assert.equal(r.costBasis, 8694, '8,675 + 15 commission + 4 charges');
    });

    test('the real ETF book reconciles with the broker', () => {
        // Commission is 0.03 per share; the charges column is levied separately.
        const book = [
            ['2026-07-08', 500, 17.35, 15, 4],
            ['2026-07-13', 500, 16.90, 15, 4],
            ['2026-07-14', 1000, 16.46, 30, 10],
            ['2026-07-15', 500, 16.45, 15, 0],
            ['2026-07-17', 500, 16.50, 15, 0],
            ['2026-07-22', 1000, 16.32, 30, 0],
            ['2026-07-24', 1000, 16.11, 30, 0]
        ].map(([d, q, p, f, o]) => tx('BUY', q, p, {
            fees: f, otherCharges: o, executedAt: `${d}T00:00:00.000Z`
        }));

        const r = avg.calculate(book, 16.90);
        assert.equal(r.netShares, 5000);
        assert.equal(r.costBasis, 82658, "matches the broker's statement");
        assert.equal(r.marketValue, 84500);
        assert.equal(r.unrealizedPnL, 1842);
    });

    test('FIFO carries both charges into the lot', () => {
        const r = fifo.calculate([tx('BUY', 500, 17.35, { fees: 15, otherCharges: 4 })], 17.35);
        assert.equal(r.costBasis, 8694);
    });
});

describe('holding-period CGT', () => {
    // PSX tiers: <12m short-term (filer 15%), 12-24m medium (12.5%),
    // >24m long-term (0%). NCCPL settles per disposal, FIFO.
    test('short-term gain is taxed at 15% for a filer', () => {
        const r = fifo.calculate([
            tx('BUY', 100, 10, { executedAt: '2026-01-01T00:00:00Z' }),
            tx('SELL', 100, 20, { executedAt: '2026-06-01T00:00:00Z' })
        ], 20);
        assert.equal(r.realizedPnL, 1000);
        assert.equal(r.cgtTax, 150, '15% of a 1000 short-term gain');
        assert.equal(r.disposals[0].tier, 'short-term');
    });

    test('long-term gain (>24m) is exempt', () => {
        const r = fifo.calculate([
            tx('BUY', 100, 10, { executedAt: '2023-01-01T00:00:00Z' }),
            tx('SELL', 100, 20, { executedAt: '2026-02-01T00:00:00Z' })
        ], 20);
        assert.equal(r.realizedPnL, 1000);
        assert.equal(r.cgtTax, 0);
        assert.equal(r.disposals[0].tier, 'long-term');
    });

    test('non-filer pays the higher 20% short-term rate', () => {
        const r = fifo.calculate([
            tx('BUY', 100, 10, { executedAt: '2026-01-01T00:00:00Z' }),
            tx('SELL', 100, 20, { executedAt: '2026-06-01T00:00:00Z' })
        ], 20, { filerStatus: 'NON_FILER' });
        assert.equal(r.cgtTax, 200, '20% of a 1000 gain');
    });

    test('losses are not taxed', () => {
        const r = fifo.calculate([
            tx('BUY', 100, 20, { executedAt: '2026-01-01T00:00:00Z' }),
            tx('SELL', 100, 10, { executedAt: '2026-06-01T00:00:00Z' })
        ], 10);
        assert.equal(r.realizedPnL, -1000);
        assert.equal(r.cgtTax, 0);
    });

    test('each FIFO lot is taxed on its own holding period', () => {
        // Old lot is long-term exempt; recent lot is short-term taxed.
        const r = fifo.calculate([
            tx('BUY', 100, 10, { executedAt: '2023-01-01T00:00:00Z' }),
            tx('BUY', 100, 10, { executedAt: '2026-01-01T00:00:00Z' }),
            tx('SELL', 200, 20, { executedAt: '2026-06-01T00:00:00Z' })
        ], 20);
        assert.equal(r.disposals.length, 2);
        assert.equal(r.cgtTax, 150, 'only the short-term lot: 15% of 1000');
    });
});

describe('empty and degenerate input', () => {

    test('no transactions produce a flat position', () => {
        const r = avg.calculate([], 10);
        assert.equal(r.netShares, 0);
        assert.equal(r.costBasis, 0);
        assert.equal(r.realizedPnL, 0);
    });

    test('non-position types are ignored', () => {
        const r = avg.calculate([
            tx('BUY', 100, 10),
            tx('DIV', 0, 0, { dividendCash: 500 }),
            tx('DEPOSIT', 0, 0, { cashAmount: 1000 })
        ], 10);
        assert.equal(r.netShares, 100);
        assert.equal(r.costBasis, 1000);
    });
});
