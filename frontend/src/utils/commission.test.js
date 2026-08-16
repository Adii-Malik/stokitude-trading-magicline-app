import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { commissionFor, brokerageFor, chargesFor, slabFor,
    DEFAULT_PSX_SLABS as SLABS, DEFAULT_PSX_CHARGES } from './commission.js';

describe('slab selection', () => {
    test('cheap shares fall in the per-share band', () => {
        assert.equal(slabFor(16.11, SLABS).type, 'PER_SHARE');
    });

    test('expensive shares fall in the percent band', () => {
        assert.equal(slabFor(250, SLABS).type, 'PERCENT');
    });

    test('boundaries belong to the band that names them', () => {
        assert.equal(slabFor(20, SLABS).type, 'PER_SHARE');
        assert.equal(slabFor(20.01, SLABS).type, 'PERCENT');
    });

    test('an open upper bound catches any price', () => {
        assert.equal(slabFor(999999, SLABS).type, 'PERCENT');
    });

    test('a price below every band matches nothing', () => {
        assert.equal(slabFor(0.001, SLABS), null);
    });
});

describe('the ETF position', () => {
    // The real trades. Rs 0.03 is per share, not per trade - entering it as a
    // flat fee is what left this portfolio's cost basis 150 short.
    const trades = [
        { quantity: 500, price: 17.35 },
        { quantity: 500, price: 16.90 },
        { quantity: 1000, price: 16.46 },
        { quantity: 500, price: 16.45 },
        { quantity: 500, price: 16.50 },
        { quantity: 1000, price: 16.32 },
        { quantity: 1000, price: 16.11 }
    ];

    test('charges three paisa on every share', () => {
        const total = trades.reduce((t, x) => t + brokerageFor({ ...x, slabs: SLABS }), 0);
        assert.equal(total, 150, '5,000 shares x 0.03');
    });

    test('a single trade is quantity times the rate', () => {
        assert.equal(brokerageFor({ quantity: 1000, price: 16.11, slabs: SLABS }), 30);
    });

    test('the fee actually charged adds sales tax and CDC', () => {
        // 30 brokerage + 4.50 tax + 5.00 CDC (1,000 shares at half a paisa).
        assert.equal(commissionFor({ quantity: 1000, price: 16.11, slabs: SLABS }), 39.5);
    });

    test('correcting the fees moves cost basis toward the broker figure', () => {
        const base = trades.reduce((t, x) => t + x.quantity * x.price, 0);
        assert.equal(base, 82490);
        const withFees = base + 150;
        assert.equal(withFees, 82640, 'against 82,490.21 recorded with a flat 0.03');
    });
});

describe('percent band', () => {
    test('applies to trade value, not share count', () => {
        assert.equal(brokerageFor({ quantity: 100, price: 200, slabs: SLABS }), 30, '0.15% of 20,000');
    });
});

describe('refusals', () => {
    test('no slabs means no fee rather than a guess', () => {
        assert.equal(commissionFor({ quantity: 100, price: 10, slabs: [] }), 0);
    });

    test('incomplete input returns zero', () => {
        assert.equal(commissionFor({ quantity: 0, price: 10, slabs: SLABS }), 0);
        assert.equal(commissionFor({ quantity: 100, price: 0, slabs: SLABS }), 0);
        assert.equal(commissionFor({ quantity: NaN, price: 10, slabs: SLABS }), 0);
    });
});

describe('a real contract note', () => {
    // TRG, 2,500 @ 61.45: brokerage 230.50, S.S.T 34.58, CDC 12.50,
    // net 153,347.43 against a gross of 153,625.00.
    const trade = { price: 61.45, quantity: 2500, slabs: SLABS };

    test('brokerage matches the 0.15% band', () => {
        assert.ok(Math.abs(brokerageFor(trade) - 230.50) < 0.1,
            `expected ~230.50, got ${brokerageFor(trade)}`);
    });

    test('sales tax is 15% of the brokerage', () => {
        const salesTax = chargesFor(trade).lines.find(l => l.name === 'Sales Tax')?.amount;
        assert.ok(Math.abs(salesTax - 34.58) < 0.1, `expected ~34.58, got ${salesTax}`);
    });

    const line = (r, name) => r.lines.find(l => l.name === name)?.amount ?? 0;

    test('CDC is half a paisa a share, which is why it looks erratic', () => {
        // 12.50 on 2,500 shares here; 1.00 on a 200-share ENGROH trade.
        assert.equal(line(chargesFor(trade), 'CDC'), 12.50);
        assert.equal(line(chargesFor({ price: 289.51, quantity: 200, slabs: SLABS }), 'CDC'), 1.00);
    });

    test('sales tax follows the brokerage, not the trade value', () => {
        // The distinction only shows when the brokerage rate moves: halve it
        // and the tax must halve too, which a percent-of-value rule would miss.
        const half = [{ from: 0.01, to: null, type: 'PERCENT', value: 0.075 }];
        const full = chargesFor(trade);
        const cheap = chargesFor({ ...trade, slabs: half });
        assert.ok(Math.abs(line(cheap, 'Sales Tax') - line(full, 'Sales Tax') / 2) < 0.01);
    });

    test('a charge can be levied on one side only', () => {
        const wht = [{ name: 'WHT', basis: 'PERCENT_OF_VALUE', value: 0.5, appliesTo: 'SELL' }];
        assert.equal(chargesFor({ ...trade, charges: wht, side: 'BUY' }).lines.length, 0);
        assert.equal(chargesFor({ ...trade, charges: wht, side: 'SELL' }).lines.length, 1);
    });

    test('the total reproduces the note to the rupee', () => {
        const { total } = chargesFor(trade);
        assert.ok(Math.abs(total - 277.58) < 0.2, `expected ~277.58, got ${total}`);
        assert.ok(Math.abs((153625 - total) - 153347.43) < 0.2, 'net amount matches');
    });

    test('a Sahulat sub-account is billed no CDC', () => {
        // PSO 200 @ 416.25: brokerage 124.88, SST 18.73, nothing else.
        const { total } = chargesFor({
            price: 416.25, quantity: 200, slabs: SLABS,
            charges: DEFAULT_PSX_CHARGES.filter(c => c.name !== 'CDC')
        });
        assert.ok(Math.abs(total - 143.61) < 0.1, `expected ~143.61, got ${total}`);
    });

    test('tax and CDC add about a fifth on top of brokerage', () => {
        const { brokerage, total } = chargesFor(trade);
        assert.ok(total / brokerage > 1.15 && total / brokerage < 1.25);
    });
});
