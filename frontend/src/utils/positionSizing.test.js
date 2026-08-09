import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sizePosition } from './positionSizing.js';

const base = { capital: 5000, riskPct: 1, entryPrice: 100, stopPrice: 95, maxPositionPct: 100 };

describe('sizing from the stop', () => {
    test('risk budget divided by risk per share', () => {
        const r = sizePosition(base);
        assert.equal(r.shares, 10, '50 budget / 5 per share');
        assert.equal(r.actualRisk, 50);
        assert.equal(r.positionValue, 1000);
    });

    test('rounds down to whole shares where the venue demands it', () => {
        const r = sizePosition({ ...base, stopPrice: 96.5 });
        assert.equal(r.shares, 14, '50 / 3.5 is 14.28');
        assert.ok(r.actualRisk <= 50, 'rounding may only reduce risk');
    });

    test('allows part shares where the venue does', () => {
        const r = sizePosition({ ...base, stopPrice: 96.5, fractionalShares: true });
        assert.equal(r.shares, 14.28);
    });

    test('a wider stop buys fewer shares for the same risk', () => {
        const tight = sizePosition({ ...base, stopPrice: 99 });
        const wide = sizePosition({ ...base, stopPrice: 90 });
        assert.ok(tight.shares > wide.shares);
        assert.ok(tight.actualRisk <= 50 && wide.actualRisk <= 50);
    });
});

describe('the gap cap', () => {
    test('a tight stop is capped by position size, not risk', () => {
        // Risk alone would buy 100 shares - 200% of the account.
        const r = sizePosition({ ...base, stopPrice: 99.5, maxPositionPct: 25 });
        assert.equal(r.byRisk, 100);
        assert.equal(r.shares, 12);
        assert.equal(r.cappedBy, 'gap cap');
        assert.ok(r.positionPct <= 25);
    });

    test('leaves a normal position alone', () => {
        const r = sizePosition({ ...base, maxPositionPct: 25 });
        assert.equal(r.cappedBy, null);
        assert.equal(r.shares, 10);
    });

    test('capping only ever reduces risk', () => {
        const r = sizePosition({ ...base, stopPrice: 99.5, maxPositionPct: 25 });
        assert.ok(r.actualRisk < r.riskBudget);
    });
});

describe('reward', () => {
    test('reports reward against actual risk', () => {
        const r = sizePosition({ ...base, targetPrice: 115 });
        assert.equal(r.rr, 3, '15 up against 5 down');
    });

    test('no target means no ratio rather than a guess', () => {
        assert.equal(sizePosition(base).rr, null);
    });
});

describe('refusals', () => {
    test('a stop at the entry is rejected', () => {
        assert.match(sizePosition({ ...base, stopPrice: 100 }).error, /Stop cannot equal/);
    });

    test('a budget too small for one share is rejected, not rounded to zero', () => {
        const r = sizePosition({ capital: 100, riskPct: 1, entryPrice: 500, stopPrice: 400 });
        assert.match(r.error, /too small/);
    });

    test('missing or nonsensical inputs return nothing', () => {
        assert.equal(sizePosition({ ...base, entryPrice: undefined }), null);
        assert.equal(sizePosition({ ...base, capital: 0 }), null);
        assert.equal(sizePosition({ ...base, capital: -100 }), null);
        assert.equal(sizePosition({ ...base, entryPrice: NaN }), null);
    });
});
