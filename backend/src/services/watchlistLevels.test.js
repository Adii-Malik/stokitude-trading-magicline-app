/** When a price you named counts as reached, and what it means. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { reached, printFor, verdictFor } from './watchlistLevels.js';

const above = (price) => ({ price, dir: 'above' });
const below = (price) => ({ price, dir: 'below' });

/** A session that never moved: the degenerate case a previous close becomes. */
const flat = (price) => ({ last: price, high: price, low: price, live: false });

/** A real session, where the extremes are the thing being tested. */
const day = (low, high, last = high) => ({ last, high, low, live: true });

describe('reached', () => {
    test('an above-level needs the high at or over it', () => {
        assert.equal(reached(above(88), flat(87.99)), false);
        assert.equal(reached(above(88), flat(88)), true);
        assert.equal(reached(above(88), flat(94.93)), true);
    });

    test('a below-level needs the low at or under it', () => {
        assert.equal(reached(below(33), flat(33.01)), false);
        assert.equal(reached(below(33), flat(33)), true);
        assert.equal(reached(below(33), flat(29.18)), true);
    });

    // The reason the whole thing reads the range: a level touched at noon and
    // closed away from is still a level you asked to be told about.
    test('a wick that closed back counts as reached', () => {
        assert.equal(reached(below(530), day(528.40, 552.10, 545)), true);
        assert.equal(reached(above(550), day(528.40, 552.10, 545)), true);
    });

    test('a range that never got there does not', () => {
        assert.equal(reached(below(530), day(535.06, 580.98, 560.67)), false);
        assert.equal(reached(above(590), day(535.06, 580.98, 560.67)), false);
    });

    // "88.00 when I said 88" is not a case anybody wants silence for.
    test('exactly on the number counts as reached', () => {
        assert.equal(reached(above(88), flat(88)), true);
        assert.equal(reached(below(88), flat(88)), true);
    });

    test('no level and no quote are both simply not reached', () => {
        assert.equal(reached(null, flat(100)), false);
        assert.equal(reached(above(88), null), false);
        assert.equal(reached({ price: null, dir: 'above' }, flat(100)), false);
    });
});

describe('printFor', () => {
    test('reports the extreme that got there, not where price ended up', () => {
        assert.equal(printFor(below(530), day(528.40, 552.10, 545)).price, 528.40);
        assert.equal(printFor(above(550), day(528.40, 552.10, 545)).price, 552.10);
    });

    test('carries the side, so the message can name the number correctly', () => {
        // "NRL is at 518.00" was the day's high described as the current price.
        assert.equal(printFor(above(550), day(528.40, 552.10)).dir, 'above');
        assert.equal(printFor(below(530), day(528.40, 552.10)).dir, 'below');
    });

    test('a previous close is never a session, so it is not live', () => {
        // Nothing built from this may say "today" about a warehoused close.
        assert.equal(printFor(below(530), flat(499.74)).live, false);
        assert.equal(printFor(below(530), day(528.40, 552.10)).live, true);
    });
});

describe('verdictFor', () => {
    const entry = { trigger: above(88), invalidation: below(79) };

    test('quiet while the session sits between the two', () => {
        assert.equal(verdictFor(entry, day(82, 84)), null);
    });

    test('the trigger wakes it', () => {
        assert.equal(verdictFor(entry, flat(94.93)), 'triggered');
    });

    test('the invalidation closes it', () => {
        assert.equal(verdictFor(entry, flat(74)), 'invalidated');
    });

    // A day that reached both ends is the idea being wrong, not a setup arriving.
    test('invalidation wins when one session reaches both', () => {
        assert.equal(verdictFor(entry, day(74, 94)), 'invalidated');
    });

    test('a name with only a trigger still works', () => {
        assert.equal(verdictFor({ trigger: above(88), invalidation: null }, flat(90)), 'triggered');
        assert.equal(verdictFor({ trigger: above(88), invalidation: null }, flat(20)), null);
    });

    test('a name with no levels at all is never anything', () => {
        assert.equal(verdictFor({ trigger: null, invalidation: null }, flat(100)), null);
    });

    test('no quote is not a verdict', () => {
        assert.equal(verdictFor(entry, null), null);
    });
});
