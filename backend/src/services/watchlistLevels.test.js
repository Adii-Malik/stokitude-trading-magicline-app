/** When a price you named counts as reached, and what it means. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { reached, verdictFor } from './watchlistLevels.js';

const above = (price) => ({ price, dir: 'above' });
const below = (price) => ({ price, dir: 'below' });

describe('reached', () => {
    test('an above-level needs price at or over it', () => {
        assert.equal(reached(above(88), 87.99), false);
        assert.equal(reached(above(88), 88), true);
        assert.equal(reached(above(88), 94.93), true);
    });

    test('a below-level needs price at or under it', () => {
        assert.equal(reached(below(33), 33.01), false);
        assert.equal(reached(below(33), 33), true);
        assert.equal(reached(below(33), 29.18), true);
    });

    // "88.00 when I said 88" is not a case anybody wants silence for.
    test('exactly on the number counts as reached', () => {
        assert.equal(reached(above(88), 88), true);
        assert.equal(reached(below(88), 88), true);
    });

    test('no level and no price are both simply not reached', () => {
        assert.equal(reached(null, 100), false);
        assert.equal(reached(above(88), null), false);
        assert.equal(reached({ price: null, dir: 'above' }, 100), false);
    });
});

describe('verdictFor', () => {
    const entry = { trigger: above(88), invalidation: below(79) };

    test('quiet while price sits between the two', () => {
        assert.equal(verdictFor(entry, 84), null);
    });

    test('the trigger wakes it', () => {
        assert.equal(verdictFor(entry, 94.93), 'triggered');
    });

    test('the invalidation closes it', () => {
        assert.equal(verdictFor(entry, 74), 'invalidated');
    });

    // A gap through both ends is the idea being wrong, not a setup arriving.
    test('invalidation wins when a gap reaches both', () => {
        const inverted = { trigger: below(90), invalidation: above(95) };
        assert.equal(verdictFor(inverted, 99), 'invalidated');
    });

    test('a name with only a trigger still works', () => {
        assert.equal(verdictFor({ trigger: above(88), invalidation: null }, 90), 'triggered');
        assert.equal(verdictFor({ trigger: above(88), invalidation: null }, 20), null);
    });

    test('a name with no levels at all is never anything', () => {
        assert.equal(verdictFor({ trigger: null, invalidation: null }, 100), null);
    });

    test('no price is not a verdict', () => {
        assert.equal(verdictFor(entry, null), null);
    });
});
