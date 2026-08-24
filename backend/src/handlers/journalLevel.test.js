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

describe('open trade stops', () => {
    test('a long stops out when price trades down through the level', () => {
        assert.equal(levelsReached(open(), 89).stop, true);
        assert.equal(levelsReached(open(), 90).stop, true);
        assert.equal(levelsReached(open(), 91).stop, false);
    });

    test('a short stops out when price trades up through it', () => {
        const short = open({ direction: 'short', plannedStop: 110, targets: [] });
        assert.equal(levelsReached(short, 111).stop, true);
        assert.equal(levelsReached(short, 109).stop, false);
    });

    test('an already flagged stop is not reported twice', () => {
        assert.equal(levelsReached(open({ stopHit: true }), 80).stop, false);
    });

    test('no stop recorded means no stop to reach', () => {
        assert.equal(levelsReached(open({ plannedStop: undefined }), 1).stop, false);
    });
});

describe('open trade targets', () => {
    test('a long reaches only the targets price has passed', () => {
        assert.deepEqual(levelsReached(open(), 112).targets, [0]);
        assert.deepEqual(levelsReached(open(), 125).targets, [0, 1]);
        assert.deepEqual(levelsReached(open(), 105).targets, []);
    });

    test('a short reaches targets on the way down', () => {
        const short = open({
            direction: 'short',
            plannedStop: 130,
            targets: [{ level: 1, price: 90, isHit: false }, { level: 2, price: 80, isHit: false }]
        });
        assert.deepEqual(levelsReached(short, 85).targets, [0]);
        assert.deepEqual(levelsReached(short, 79).targets, [0, 1]);
        assert.deepEqual(levelsReached(short, 95).targets, []);
    });

    test('targets already flagged are skipped', () => {
        const entry = open({
            targets: [{ level: 1, price: 110, isHit: true }, { level: 2, price: 120, isHit: false }]
        });
        assert.deepEqual(levelsReached(entry, 125).targets, [1]);
    });
});

describe('what is not watched', () => {
    test('a closed trade reports nothing', () => {
        const m = levelsReached(open({ state: 'closed' }), 1);
        assert.equal(m.stop, false);
        assert.deepEqual(m.targets, []);
    });

    test('there is no fourth thing to watch', () => {
        // Watching a level was a state with no fill, no P/L and no R, sitting in
        // the same list as positions. A broker's alerts do that job better.
        assert.deepEqual(Object.keys(levelsReached(open(), 0)).sort(), ['stop', 'targets']);
    });

    test('a missing price reports nothing rather than treating it as zero', () => {
        // Otherwise every long in the book stops out the moment a scrape fails.
        const m = levelsReached(open(), 0);
        assert.equal(m.stop, false);
        assert.deepEqual(m.targets, []);
    });
});
