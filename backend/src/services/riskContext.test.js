import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { judge, suggestSize } from './riskContext.js';

const profile = { capital: 200000, riskPct: 2, maxPositionPct: 20 };

describe('judging a trade against the line you drew', () => {
    test('turns a bare number into a proportion of the account', () => {
        const v = judge({ ...profile, entryPrice: 100, stopPrice: 90, quantity: 400 });
        assert.equal(v.risk, 4000);
        assert.equal(v.riskPctOfCapital, 2);
        assert.equal(v.position, 40000);
        assert.equal(v.positionPctOfCapital, 20);
    });

    test('flags a breach without altering the trade', () => {
        const v = judge({ ...profile, entryPrice: 100, stopPrice: 90, quantity: 1000 });
        assert.equal(v.breaches.risk, true, '5% risked against a 2% limit');
        assert.equal(v.breaches.position, true, '50% of capital against a 20% cap');
        assert.equal(v.risk, 10000, 'the trade is recorded as taken, not corrected');
    });

    test('a missing target leaves reward:risk unknown rather than zero', () => {
        // A trailing stop has no fixed target. Inventing one would put fiction
        // into every reward:risk figure the journal reports.
        const v = judge({ ...profile, entryPrice: 100, stopPrice: 90, quantity: 400 });
        assert.equal(v.rr, null);
        const withTarget = judge({ ...profile, entryPrice: 100, stopPrice: 90, quantity: 400, targetPrice: 130 });
        assert.equal(withTarget.rr, 3);
    });

    test('no capital means no verdict, not a verdict of zero', () => {
        const v = judge({ ...profile, capital: null, entryPrice: 100, stopPrice: 90, quantity: 400 });
        assert.equal(v.riskPctOfCapital, null);
        assert.equal(v.breaches.risk, false, 'cannot breach a limit that cannot be measured');
        assert.equal(v.risk, 4000, 'the rupee risk is still knowable');
    });

    test('catches a stop on the wrong side of the entry', () => {
        assert.equal(judge({ ...profile, entryPrice: 100, stopPrice: 110, quantity: 10 }).breaches.stopBackwards, true);
        assert.equal(judge({ ...profile, direction: 'short', entryPrice: 100, stopPrice: 110, quantity: 10 }).breaches.stopBackwards, false);
    });
});

describe('suggesting a size, the one thing it decides', () => {
    test('a wide stop is bound by risk, a tight one by allocation', () => {
        const wide = suggestSize({ ...profile, entryPrice: 100, stopPrice: 80 });
        assert.equal(wide.cappedBy, 'risk', '20 per share risked, so risk binds first');
        assert.equal(wide.shares, 200);

        const tight = suggestSize({ ...profile, entryPrice: 100, stopPrice: 99 });
        assert.equal(tight.cappedBy, 'allocation', '1 per share would allow 4000 shares');
        assert.equal(tight.shares, 400, 'held to 20% of capital instead');
    });

    test('whole shares unless the venue allows parts', () => {
        assert.equal(suggestSize({ ...profile, entryPrice: 70, stopPrice: 68 }).shares, 571);
        assert.equal(
            suggestSize({ ...profile, entryPrice: 70, stopPrice: 68, fractionalShares: true }).shares,
            571.42
        );
    });

    test('nothing to suggest without a stop', () => {
        assert.equal(suggestSize({ ...profile, entryPrice: 100 }), null);
        assert.equal(suggestSize({ ...profile, entryPrice: 100, stopPrice: 100 }), null, 'no distance, no size');
    });
});
