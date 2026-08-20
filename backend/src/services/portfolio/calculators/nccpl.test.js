/**
 * NCCPL settlement matching.
 *
 * The rule decides which lot a sale consumes, and that decides three things at
 * once: the gain reported, the tax on it, and which lots survive to be taxed
 * later. Plain FIFO gets all three wrong the moment a stock is day-traded.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import NCCPLCalculator from './NCCPLCalculator.js';
import FIFOCalculator from './FIFOCalculator.js';

const nccpl = new NCCPLCalculator();
const fifo = new FIFOCalculator();

const tx = (type, quantity, price, executedAt) =>
    ({ type, quantity, price, fees: 0, executedAt: new Date(executedAt) });

const OLD = '2023-01-10T05:00:00Z';   // long-term, exempt
const DAY = '2026-08-19';

describe('same-day trades settle LIFO', () => {
    // Holding an old lot, then day-trading the same stock.
    const book = [
        tx('BUY', 100, 10, OLD),
        tx('BUY', 100, 120, `${DAY}T04:30:00Z`),
        tx('SELL', 100, 125, `${DAY}T09:00:00Z`)
    ];

    test('the day trade is matched against the day\'s own purchase', () => {
        const r = nccpl.calculate(book, 125);
        assert.equal(r.realizedPnL, 500, '100 x 5, not the three-year gain');
        assert.equal(r.disposals.length, 1);
        assert.equal(r.disposals[0].tier, 'short-term');
        assert.equal(r.cgtTax, 75, '15% of 500');
    });

    test('the old lot survives, still long-term', () => {
        const r = nccpl.calculate(book, 125);
        assert.equal(r.netShares, 100);
        assert.equal(r.lots.length, 1);
        assert.equal(r.lots[0].price, 10, 'the 2023 lot, untouched');
    });

    test('plain FIFO gets all of that wrong', () => {
        // Kept as a test so the difference stays visible, not as an endorsement.
        const r = fifo.calculate(book, 125);
        assert.equal(r.realizedPnL, 11500, 'consumes the old lot');
        assert.equal(r.cgtTax, 0, 'and reports it exempt');
        assert.equal(r.lots[0].price, 120, 'leaving a fresh short-term lot behind');
    });
});

describe('selling and buying back the same day', () => {
    // Settlement runs after the close, so the order on the clock is irrelevant.
    test('settles the same as buying then selling', () => {
        const sellFirst = nccpl.calculate([
            tx('BUY', 100, 10, OLD),
            tx('SELL', 100, 125, `${DAY}T05:00:00Z`),
            tx('BUY', 100, 120, `${DAY}T09:00:00Z`)
        ], 125);

        assert.equal(sellFirst.realizedPnL, 500, 'the buyback is what settled the sale');
        assert.equal(sellFirst.netShares, 100);
        assert.equal(sellFirst.lots[0].price, 10, 'the old lot is still there');
    });
});

describe('selling more than was bought that day', () => {
    test('the excess reaches back into older holdings, FIFO', () => {
        const r = nccpl.calculate([
            tx('BUY', 100, 10, OLD),
            tx('BUY', 50, 120, `${DAY}T04:30:00Z`),
            tx('SELL', 120, 125, `${DAY}T09:00:00Z`)
        ], 125);

        // 50 against today at 120, then 70 against the 2023 lot at 10.
        assert.equal(r.realizedPnL, 50 * 5 + 70 * 115);
        assert.equal(r.disposals.length, 2);

        const [today, older] = r.disposals;
        assert.equal(today.tier, 'short-term');
        assert.equal(older.tier, 'long-term');
        assert.equal(r.cgtTax, 37.5, 'only the same-day slice is taxed: 15% of 250');
        assert.equal(r.netShares, 30, 'what is left of the old lot');
    });
});

describe('when nothing was bought that day', () => {
    test('it is ordinary FIFO', () => {
        const book = [
            tx('BUY', 100, 10, OLD),
            tx('BUY', 100, 20, '2026-01-05T05:00:00Z'),
            tx('SELL', 150, 30, '2026-08-19T05:00:00Z')
        ];
        const a = nccpl.calculate(book, 30);
        const b = fifo.calculate(book, 30);

        assert.equal(a.realizedPnL, b.realizedPnL);
        assert.equal(a.cgtTax, b.cgtTax);
        assert.equal(a.netShares, b.netShares);
    });

    test('two same-day lots are consumed newest first', () => {
        const r = nccpl.calculate([
            tx('BUY', 50, 100, `${DAY}T04:00:00Z`),
            tx('BUY', 50, 110, `${DAY}T05:00:00Z`),
            tx('SELL', 50, 120, `${DAY}T09:00:00Z`)
        ], 120);

        assert.equal(r.realizedPnL, 500, 'the 110 lot went first: 50 x 10');
        assert.equal(r.lots[0].price, 100, 'the earlier lot of the day remains');
    });
});
