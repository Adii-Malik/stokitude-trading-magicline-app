import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { commissionFor, slabFor, DEFAULT_PSX_SLABS as SLABS } from './commission.js';

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
        const total = trades.reduce((t, x) => t + commissionFor({ ...x, slabs: SLABS }), 0);
        assert.equal(total, 150, '5,000 shares x 0.03');
    });

    test('a single trade is quantity times the rate', () => {
        assert.equal(commissionFor({ quantity: 1000, price: 16.11, slabs: SLABS }), 30);
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
        assert.equal(commissionFor({ quantity: 100, price: 200, slabs: SLABS }), 30, '0.15% of 20,000');
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
