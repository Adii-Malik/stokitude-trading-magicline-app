/**
 * Journal level rules.
 *
 * These decide whether the system tells you a level printed, so a wrong
 * comparison is either a missed stop or an alert that cried wolf.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { levelsReached } from './journalLevelHandler.js';

const open = (o = {}) => ({
    symbol: 'X', state: 'open', direction: 'long',
    plannedStop: 90, stopHit: false,
    targets: [{ level: 1, price: 110, isHit: false }, { level: 2, price: 120, isHit: false }],
    ...o
});

/**
 * A session, the way the feed reports one. The single-argument form is a day
 * that opened, closed and never moved - which is what comparing the last price
 * alone used to assume about every day.
 */
const q = (last, high = last, low = last) => ({ last, high, low, live: true });

describe('open trade stops', () => {
    test('a long stops out when price trades down through the level', () => {
        assert.equal(levelsReached(open(), q(89)).stop, true);
        assert.equal(levelsReached(open(), q(90)).stop, true);
        assert.equal(levelsReached(open(), q(91)).stop, false);
    });

    test('a short stops out when price trades up through it', () => {
        const short = open({ direction: 'short', plannedStop: 110, targets: [] });
        assert.equal(levelsReached(short, q(111)).stop, true);
        assert.equal(levelsReached(short, q(109)).stop, false);
    });

    test('an already flagged stop is not reported twice', () => {
        assert.equal(levelsReached(open({ stopHit: true }), q(80)).stop, false);
    });

    test('no stop recorded means no stop to reach', () => {
        assert.equal(levelsReached(open({ plannedStop: undefined }), q(1)).stop, false);
    });
});

describe('open trade targets', () => {
    test('a long reaches only the targets price has passed', () => {
        assert.deepEqual(levelsReached(open(), q(112)).targets, [0]);
        assert.deepEqual(levelsReached(open(), q(125)).targets, [0, 1]);
        assert.deepEqual(levelsReached(open(), q(105)).targets, []);
    });

    test('a short reaches targets on the way down', () => {
        const short = open({
            direction: 'short',
            plannedStop: 130,
            targets: [{ level: 1, price: 90, isHit: false }, { level: 2, price: 80, isHit: false }]
        });
        assert.deepEqual(levelsReached(short, q(85)).targets, [0]);
        assert.deepEqual(levelsReached(short, q(79)).targets, [0, 1]);
        assert.deepEqual(levelsReached(short, q(95)).targets, []);
    });

    test('targets already flagged are skipped', () => {
        const entry = open({
            targets: [{ level: 1, price: 110, isHit: true }, { level: 2, price: 120, isHit: false }]
        });
        assert.deepEqual(levelsReached(entry, q(125)).targets, [1]);
    });
});

describe('what is not watched', () => {
    test('a closed trade reports nothing', () => {
        const m = levelsReached(open({ state: 'closed' }), q(1));
        assert.equal(m.stop, false);
        assert.deepEqual(m.targets, []);
    });

    test('there is no fourth thing to watch', () => {
        // Watching a level was a state with no fill, no P/L and no R, sitting in
        // the same list as positions. A broker's alerts do that job better.
        assert.deepEqual(Object.keys(levelsReached(open(), q(0))).sort(), ['stop', 'targets']);
    });

    test('a quote with no usable price reports nothing rather than treating it as zero', () => {
        // Otherwise every long in the book stops out the moment the feed answers
        // with a zero - and a quote object is always truthy, so the old `!price`
        // guard would not have caught it.
        const m = levelsReached(open(), q(0));
        assert.equal(m.stop, false);
        assert.deepEqual(m.targets, []);
    });
});
