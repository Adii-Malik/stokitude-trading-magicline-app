/**
 * Journal level rules.
 *
 * These decide whether the system tells you a level printed, so a wrong
 * comparison is either a missed stop or an alert that cried wolf.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { levelsReached } from './journalLevelHandler.js';

const planned = (o = {}) => ({
    symbol: 'X', state: 'planned', direction: 'long',
    entryFrom: 95, entryTo: 100, entryZoneHit: false, ...o
});

const open = (o = {}) => ({
    symbol: 'X', state: 'open', direction: 'long',
    plannedStop: 90, stopHit: false,
    targets: [{ level: 1, price: 110, isHit: false }, { level: 2, price: 120, isHit: false }],
    ...o
});

describe('planned entry zones', () => {
    test('price inside the band reaches the zone', () => {
        assert.equal(levelsReached(planned(), 97).entryZone, true);
    });

    test('price either side of the band does not', () => {
        assert.equal(levelsReached(planned(), 101).entryZone, false);
        assert.equal(levelsReached(planned(), 94.99).entryZone, false);
    });

    test('the band is inclusive of both edges', () => {
        assert.equal(levelsReached(planned(), 95).entryZone, true);
        assert.equal(levelsReached(planned(), 100).entryZone, true);
    });

    test('bounds entered in either order describe the same band', () => {
        assert.equal(levelsReached(planned({ entryFrom: 100, entryTo: 95 }), 97).entryZone, true);
    });

    test('an already flagged zone is not reported twice', () => {
        assert.equal(levelsReached(planned({ entryZoneHit: true }), 97).entryZone, false);
    });

    test('no bounds means nothing to watch', () => {
        const m = levelsReached(planned({ entryFrom: undefined, entryTo: undefined }), 97);
        assert.equal(m.entryZone, false);
    });

    test('a planned trade never reports its stop or targets', () => {
        // They are hypothetical until the trade is actually entered.
        const m = levelsReached(planned({ plannedStop: 90, targets: [{ level: 1, price: 110 }] }), 80);
        assert.equal(m.stop, false);
        assert.deepEqual(m.targets, []);
    });
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

    test('a missing price reports nothing rather than treating it as zero', () => {
        // Otherwise every long in the book stops out the moment a scrape fails.
        const m = levelsReached(open(), 0);
        assert.equal(m.stop, false);
        assert.deepEqual(m.targets, []);
    });
});
