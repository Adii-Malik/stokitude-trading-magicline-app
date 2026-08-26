/** Performance series tests: the ledger replayed against daily closes. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeries, maxDrawdown, xirr, flowsFrom, rebase } from './performanceService.js';

const tx = (type, overrides = {}) => ({ type, symbol: 'OGDC', ...overrides });
const bars = (symbol, rows) => ({ [symbol]: rows.map(([date, close]) => ({ date, close })) });

describe('value series', () => {
    const prices = bars('OGDC', [
        ['2025-05-01', 209], ['2025-05-02', 210], ['2025-05-05', 215]
    ]);

    test('a single buy is valued at each close', () => {
        const s = buildSeries([
            tx('BUY', { quantity: 50, price: 209, fees: 7.5, executedAt: '2025-05-01' })
        ], prices);

        assert.equal(s.length, 3);
        assert.deepEqual(s.map(r => r.value), [10450, 10500, 10750]);
        assert.equal(s[0].holdings, 1);
    });

    test('days before the first trade are excluded', () => {
        const s = buildSeries([
            tx('BUY', { quantity: 50, price: 210, executedAt: '2025-05-02' })
        ], prices);
        assert.deepEqual(s.map(r => r.date), ['2025-05-02', '2025-05-05']);
    });

    test('a sell removes the holding from later days', () => {
        const s = buildSeries([
            tx('BUY', { quantity: 50, price: 209, executedAt: '2025-05-01' }),
            tx('SELL', { quantity: 50, price: 210, executedAt: '2025-05-02' })
        ], prices);

        assert.equal(s[0].value, 10450);
        assert.equal(s[1].value, 0, 'sold, so nothing left to value');
        assert.equal(s[1].holdings, 0);
    });

    test('a non-trading day carries the last close forward', () => {
        // No bar on 05-02 for FABL; its 05-01 close must persist.
        const s = buildSeries(
            [tx('BUY', { symbol: 'FABL', quantity: 100, price: 47, executedAt: '2025-05-01' })],
            { FABL: [{ date: '2025-05-01', close: 47 }], OGDC: prices.OGDC }
        );
        assert.equal(s[1].value, 4700, 'still valued at the stale close');
    });

    test('a split scales the holding without changing cash', () => {
        const s = buildSeries([
            tx('BUY', { quantity: 50, price: 209, executedAt: '2025-05-01' }),
            tx('SPLIT', { ratio: '2:1', executedAt: '2025-05-02' })
        ], prices);
        assert.equal(s[1].value, 100 * 210);
        assert.equal(s[0].cash, s[1].cash);
    });

    test('a cash movement after the last bar still lands in the series', () => {
        // Otherwise it counts as a cash flow for XIRR while the closing total
        // still contains the money, double-counting it.
        const s = buildSeries([
            tx('BUY', { quantity: 50, price: 209, executedAt: '2025-05-01' }),
            { type: 'WITHDRAW', cashAmount: 1000, executedAt: '2025-06-30' }
        ], prices);

        const last = s[s.length - 1];
        assert.equal(last.date, '2025-06-30', 'series reaches the withdrawal');
        assert.equal(last.cash, -10450 - 1000);
        assert.equal(last.value, 50 * 215, 'valued at the last known close');
    });

    test('an empty ledger yields no series', () => {
        assert.deepEqual(buildSeries([], prices), []);
    });

    test('no price data still tracks cash, with holdings unvalued', () => {
        // performance() reports these symbols in missingPrices so the zero
        // valuation is visible rather than silently wrong.
        const s = buildSeries([tx('BUY', { quantity: 1, price: 10, executedAt: '2025-05-01' })], {});
        assert.equal(s.length, 1);
        assert.equal(s[0].cash, -10);
        assert.equal(s[0].value, 0);
    });
});

describe('cash', () => {
    const prices = bars('OGDC', [['2025-05-01', 209], ['2025-05-02', 210]]);

    test('a deposit funds the account and counts as invested capital', () => {
        const s = buildSeries([
            { type: 'DEPOSIT', cashAmount: 50000, executedAt: '2025-05-01' },
            tx('BUY', { quantity: 50, price: 209, fees: 7.5, executedAt: '2025-05-01' })
        ], prices);

        assert.equal(s[0].cash, 50000 - 10457.5);
        assert.equal(s[0].invested, 50000);
        assert.equal(s[0].total, s[0].value + s[0].cash);
    });

    test('charges leave the account alongside the purchase', () => {
        const s = buildSeries([
            tx('BUY', { quantity: 10, price: 100, fees: 15, otherCharges: 4, executedAt: '2025-05-01' })
        ], prices);
        assert.equal(s[0].cash, -1019, '1,000 plus 19 in charges');
    });

    test('dividends are cash in', () => {
        const s = buildSeries([
            tx('BUY', { quantity: 10, price: 100, executedAt: '2025-05-01' }),
            tx('DIV', { dividendCash: 500, executedAt: '2025-05-02' })
        ], prices);
        assert.equal(s[1].cash - s[0].cash, 500);
    });

    test('a withdrawal reduces invested capital', () => {
        const s = buildSeries([
            { type: 'DEPOSIT', cashAmount: 10000, executedAt: '2025-05-01' },
            { type: 'WITHDRAW', cashAmount: 4000, executedAt: '2025-05-02' }
        ], bars('OGDC', [['2025-05-01', 1], ['2025-05-02', 1]]));
        assert.equal(s[1].invested, 6000);
        assert.equal(s[1].cash, 6000);
    });
});

describe('nav', () => {
    const flat = bars('OGDC', [['2025-05-01', 100], ['2025-05-02', 100], ['2025-05-05', 110]]);

    test('a deposit does not move the unit price', () => {
        const s = buildSeries([
            { type: 'DEPOSIT', cashAmount: 10000, executedAt: '2025-05-01' },
            { type: 'DEPOSIT', cashAmount: 90000, executedAt: '2025-05-02' }
        ], flat);
        assert.equal(s[0].nav, 100);
        assert.equal(s[1].nav, 100, 'ten times the money, same unit price');
    });

    test('a withdrawal does not move it either', () => {
        const s = buildSeries([
            { type: 'DEPOSIT', cashAmount: 100000, executedAt: '2025-05-01' },
            { type: 'WITHDRAW', cashAmount: 90000, executedAt: '2025-05-02' }
        ], flat);
        assert.equal(s[1].nav, 100);
        assert.equal(s[1].total, 10000, 'equity fell, the unit price did not');
    });

    test('real gains do move it', () => {
        const s = buildSeries([
            { type: 'DEPOSIT', cashAmount: 10000, executedAt: '2025-05-01' },
            tx('BUY', { quantity: 100, price: 100, executedAt: '2025-05-01' })
        ], flat);
        assert.equal(s[0].nav, 100);
        assert.equal(s[2].nav, 110, 'shares rose 10%, so did the unit price');
    });
});

describe('drawdown', () => {
    const at = (vals) => vals.map((nav, i) => ({ date: `2025-05-0${i + 1}`, nav }));

    test('measures the largest peak-to-trough fall', () => {
        const d = maxDrawdown(at([100, 120, 90, 130]));
        assert.equal(d.amount, 30);
        assert.equal(d.pct, 25);
        assert.equal(d.from, '2025-05-02');
        assert.equal(d.to, '2025-05-03');
    });

    test('a series that only rises has none', () => {
        assert.equal(maxDrawdown(at([100, 110, 120])).amount, 0);
    });

    test('a sale is not a drawdown', () => {
        // Selling moves value into cash, so NAV is flat. On `value` it looks
        // like a 50% fall.
        const rows = [
            { date: '2025-05-01', value: 1000, nav: 100 },
            { date: '2025-05-02', value: 500, nav: 100 },
            { date: '2025-05-05', value: 500, nav: 100 }
        ];
        assert.equal(maxDrawdown(rows).amount, 0);
        assert.equal(maxDrawdown(rows, 'value').amount, 500, 'the wrong field would see a fall');
    });

    test('a withdrawal is not a drawdown', () => {
        // Equity halves because money left, not because anything lost value.
        const rows = [
            { date: '2025-05-01', total: 400000, nav: 100 },
            { date: '2025-05-02', total: 100000, nav: 100 }
        ];
        assert.equal(maxDrawdown(rows).amount, 0);
        assert.equal(maxDrawdown(rows, 'total').pct, 75, 'the wrong field would see a crash');
    });
});

describe('xirr', () => {
    test('doubling over a year is about 100%', () => {
        const r = xirr([
            { date: '2025-01-01', amount: -1000 },
            { date: '2026-01-01', amount: 2000 }
        ]);
        assert.ok(Math.abs(r - 100) < 0.5, `expected ~100, got ${r}`);
    });

    test('a flat year returns about zero', () => {
        const r = xirr([
            { date: '2025-01-01', amount: -1000 },
            { date: '2026-01-01', amount: 1000 }
        ]);
        assert.ok(Math.abs(r) < 0.01, `expected ~0, got ${r}`);
    });

    test('a loss is negative', () => {
        const r = xirr([
            { date: '2025-01-01', amount: -1000 },
            { date: '2026-01-01', amount: 800 }
        ]);
        assert.ok(r < -15 && r > -25, `expected about -20, got ${r}`);
    });

    test('a late deposit is not credited a full year of growth', () => {
        // Same 10% gain, but the money was only in for a month.
        const r = xirr([
            { date: '2025-12-01', amount: -1000 },
            { date: '2026-01-01', amount: 1100 }
        ]);
        assert.ok(r > 100, `short holding annualises high, got ${r}`);
    });

    test('flows all one way cannot be solved', () => {
        assert.equal(xirr([
            { date: '2025-01-01', amount: -100 },
            { date: '2026-01-01', amount: -100 }
        ]), null);
    });

    test('a single flow cannot be solved', () => {
        assert.equal(xirr([{ date: '2025-01-01', amount: -100 }]), null);
    });
});

describe('flows', () => {
    test('deposits are outflows and the closing position is the final inflow', () => {
        const series = [{ date: '2025-05-02', total: 12000 }];
        const flows = flowsFrom([
            { type: 'DEPOSIT', cashAmount: 10000, executedAt: '2025-05-01' },
            { type: 'BUY', symbol: 'OGDC', quantity: 1, price: 1, executedAt: '2025-05-01' }
        ], series);

        assert.deepEqual(flows, [
            { date: '2025-05-01', amount: -10000 },
            { date: '2025-05-02', amount: 12000 }
        ]);
    });
});

describe('benchmark', () => {
    const series = [
        { date: '2025-05-01', nav: 100 },
        { date: '2025-05-02', nav: 110 }
    ];
    const index = [
        { date: '2025-05-01', close: 50000 },
        { date: '2025-05-02', close: 51000 }
    ];

    test('both are rebased to 100 at the first common day', () => {
        const r = rebase(series, index);
        assert.deepEqual(r[0], { date: '2025-05-01', portfolio: 100, benchmark: 100 });
        assert.equal(r[1].portfolio, 110);
        assert.equal(r[1].benchmark, 102);
    });

    test('days the index does not cover are dropped', () => {
        const r = rebase(series, [index[0]]);
        assert.equal(r.length, 1);
    });

    test('a missing benchmark yields nothing rather than throwing', () => {
        assert.deepEqual(rebase(series, []), []);
    });
});

describe('NAV against cash flows', () => {
    const flat = (dates) => ({ X: dates.map(d => ({ date: new Date(d), close: 100 })) });

    // The old maths worked out the pre-flow NAV as (total - flow) / units. On a
    // day whose buys were funded by that same day's deposit this leaves a total
    // the book never held - it read 2,958 against a real 4,985 - and the unit
    // count then carried that invented loss for the rest of the series.
    test('a deposit spent the same day does not move NAV', () => {
        const series = buildSeries([
            { executedAt: new Date('2025-01-01'), type: 'DEPOSIT', cashAmount: 5000 },
            { executedAt: new Date('2025-01-02'), type: 'DEPOSIT', cashAmount: 50000 },
            { executedAt: new Date('2025-01-02'), type: 'BUY', symbol: 'X', quantity: 500, price: 100 }
        ], flat(['2025-01-01', '2025-01-02']));

        assert.equal(series[0].nav, 100);
        assert.equal(series[1].nav, 100);
    });

    test('a withdrawal does not move NAV either', () => {
        const series = buildSeries([
            { executedAt: new Date('2025-01-01'), type: 'DEPOSIT', cashAmount: 10000 },
            { executedAt: new Date('2025-01-02'), type: 'WITHDRAW', cashAmount: 4000 }
        ], flat(['2025-01-01', '2025-01-02']));

        assert.equal(series[1].nav, 100);
        assert.equal(series[1].total, 6000);
    });

    test('a real gain still moves NAV', () => {
        const series = buildSeries([
            { executedAt: new Date('2025-01-01'), type: 'DEPOSIT', cashAmount: 10000 },
            { executedAt: new Date('2025-01-01'), type: 'BUY', symbol: 'X', quantity: 100, price: 100 }
        ], { X: [
            { date: new Date('2025-01-01'), close: 100 },
            { date: new Date('2025-01-02'), close: 110 }
        ] });

        assert.equal(series[0].nav, 100);
        assert.equal(series[1].nav, 110);
    });
});

describe('splits against back-adjusted bars', () => {
    // Bought at 500 before a 5:1. The bar from that day is already divided by
    // five, so valuing 10 unsplit shares against it lost 80% on paper the day
    // the position opened, and never gave it back.
    const bars = { X: [
        { date: new Date('2025-01-01'), close: 100 },
        { date: new Date('2025-01-02'), close: 100 },
        { date: new Date('2025-01-03'), close: 100 }
    ] };
    const ledger = [
        { executedAt: new Date('2025-01-01'), type: 'DEPOSIT', cashAmount: 5000 },
        { executedAt: new Date('2025-01-01'), type: 'BUY', symbol: 'X', quantity: 10, price: 500 },
        { executedAt: new Date('2025-01-03'), type: 'SPLIT', symbol: 'X', ratio: '5:1' }
    ];

    test('values pre-split days at what the shares were worth', () => {
        const [day] = buildSeries(ledger, bars);
        assert.equal(day.value, 5000);
        assert.equal(day.nav, 100);
    });

    test('the split day itself does not jump', () => {
        const series = buildSeries(ledger, bars);
        const before = series[series.length - 2];
        const after = series[series.length - 1];
        assert.equal(before.value, after.value);
        assert.equal(after.nav, before.nav);
    });

    test('a symbol that never split is untouched', () => {
        const [day] = buildSeries([
            { executedAt: new Date('2025-01-01'), type: 'DEPOSIT', cashAmount: 5000 },
            { executedAt: new Date('2025-01-01'), type: 'BUY', symbol: 'X', quantity: 10, price: 100 }
        ], bars);
        assert.equal(day.value, 1000);
    });
});
