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

describe('reached, since you asked', () => {
    const friday = new Date('2026-09-04T04:30:00Z');
    const monday = new Date('2026-09-07T04:30:00Z');

    /** A session, with which session it is. */
    const on = (session, low, high) => ({ last: high, high, low, session, live: true });

    /** A level armed against a session, with the extreme as it stood then. */
    const armed = (price, dir, session, extreme) =>
        ({ price, dir, armedAt: new Date(), armedSession: session, armedExtreme: extreme });

    test('does not report the chart you were looking at when you set it', () => {
        // The real one: a trigger of 152 set on Sunday, when Friday's high was
        // already 153.8, fired ten minutes later against Friday.
        const level = armed(152, 'above', friday, 153.8);
        assert.equal(reached(level, on(friday, 147, 153.8)), false);
    });

    test('but reports the same level the next session', () => {
        // The suppression must last one session, not forever. This is the miss
        // that would matter, so it is the assertion that matters.
        const level = armed(152, 'above', friday, 153.8);
        assert.equal(reached(level, on(monday, 149, 152.5)), true);
    });

    test('fires inside the session when the extreme moves past it', () => {
        // Armed mid-session below the market's reach, then price gets there.
        const level = armed(152, 'above', monday, 151.5);
        assert.equal(reached(level, on(monday, 149, 153)), true);
    });

    test('a below-level works the same way round', () => {
        const already = armed(90, 'below', friday, 88);
        assert.equal(reached(already, on(friday, 88, 95)), false);
        assert.equal(reached(already, on(monday, 89, 95)), true);

        const waiting = armed(90, 'below', monday, 92);
        assert.equal(reached(waiting, on(monday, 89, 95)), true);
    });

    test('a level with no arming record behaves as it always did', () => {
        // Every level written before this existed. Reading them as "never fires"
        // would silence the whole shortlist on deploy.
        assert.equal(reached(above(88), day(80, 94)), true);
        assert.equal(reached({ price: 152, dir: 'above', armedSession: friday, armedExtreme: null },
            on(friday, 147, 153.8)), true);
    });

    test('a warehoused close has no session, so it cannot be judged on since', () => {
        // flat() carries session: null. Suppressing on an unknown session would
        // turn a stale feed into silence, which is the worse failure.
        const level = armed(152, 'above', friday, 153.8);
        assert.equal(reached(level, { ...flat(153.8), session: null }), true);
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
