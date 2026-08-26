/** The last close becomes the shown price - and says how old it is. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { priceUpdates } from './priceFromBars.js';

const bar = (date, close, rest = {}) => ({
    date: new Date(date), close, open: close, high: close, low: close, volume: 1000, ...rest
});

const only = (rows) => {
    const out = priceUpdates(rows);
    assert.equal(out.length, 1);
    return out[0];
};

describe('priceUpdates', () => {
    test('takes the newest close as the price', () => {
        const row = only([{ _id: 'NCL', top: [bar('2026-08-25', 37), bar('2026-08-24', 36.98)] }]);
        assert.equal(row.currentPrice, 37);
        assert.equal(row.previousPrice, 36.98);
    });

    test('dates the price by the bar, not by now', () => {
        const row = only([{ _id: 'NCL', top: [bar('2026-08-25', 37), bar('2026-08-24', 36.98)] }]);
        assert.deepEqual(row.lastUpdated, new Date('2026-08-25'));
    });

    test('reports the move against the session before', () => {
        const row = only([{ _id: 'OGDC', top: [bar('2026-08-25', 110), bar('2026-08-24', 100)] }]);
        assert.equal(row.priceChange, 10);
        assert.equal(row.priceChangePercent, 10);
    });

    test('rounds a change that floating point would not', () => {
        const row = only([{ _id: 'X', top: [bar('2026-08-25', 37.1), bar('2026-08-24', 36.98)] }]);
        assert.equal(row.priceChange, 0.12);
    });

    test('a fall is negative both ways', () => {
        const row = only([{ _id: 'X', top: [bar('2026-08-25', 90), bar('2026-08-24', 100)] }]);
        assert.equal(row.priceChange, -10);
        assert.equal(row.priceChangePercent, -10);
    });

    // A first session has nothing to compare against. Reporting zero would say
    // the price held steady, which is a claim the data cannot make.
    test('one session leaves the change unknown, not zero', () => {
        const row = only([{ _id: 'NEW', top: [bar('2026-08-25', 50)] }]);
        assert.equal(row.previousPrice, null);
        assert.equal(row.priceChange, null);
        assert.equal(row.priceChangePercent, null);
    });

    test('carries the rest of the session', () => {
        const row = only([{
            _id: 'NCL',
            top: [bar('2026-08-25', 37, { open: 36.8, high: 37.15, low: 36.61, volume: 41000 })]
        }]);
        assert.equal(row.open, 36.8);
        assert.equal(row.high, 37.15);
        assert.equal(row.low, 36.61);
        assert.equal(row.volume, 41000);
    });

    test('skips a symbol whose newest bar has no close', () => {
        assert.deepEqual(priceUpdates([{ _id: 'BAD', top: [bar('2026-08-25', null)] }]), []);
    });

    test('skips a symbol with no bars at all', () => {
        assert.deepEqual(priceUpdates([{ _id: 'NONE', top: [] }]), []);
    });

    test('survives an empty result', () => {
        assert.deepEqual(priceUpdates([]), []);
        assert.deepEqual(priceUpdates(null), []);
    });
});
