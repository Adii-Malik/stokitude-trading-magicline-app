/**
 * Journal entry schema rules.
 *
 * Validation and the plannedTarget virtual are the two places this model can
 * silently lose data: a required field that fires on a planned trade blocks it
 * entirely, and a virtual that does not write through drops the value.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import JournalEntry, { orderTargets, targetOnWrongSide } from './JournalEntry.js';

const user = new mongoose.Types.ObjectId();
const errors = (doc) => Object.keys(doc.validateSync()?.errors || {});

describe('what a trade must have', () => {
    test('an open trade needs an entry date, price and size', () => {
        const missing = errors(new JournalEntry({ user, symbol: 'OGDC' }));
        assert.ok(missing.includes('entryDate'));
        assert.ok(missing.includes('entryPrice'));
        assert.ok(missing.includes('quantity'));
    });

    test('there is no state that excuses them', () => {
        // A journal entry is a position that exists. Watching a level used to be
        // a fourth state with no fill, no P/L and no R, sitting in the same list
        // as real trades and making every column mean two things.
        const doc = new JournalEntry({ user, symbol: 'OGDC', state: 'planned' });
        assert.deepEqual(errors(doc).sort(), ['entryDate', 'entryPrice', 'quantity', 'state'],
            'planned is not a state a trade can take, and a trade still needs a fill');
    });

    test('a closed trade still needs its entry details', () => {
        const missing = errors(new JournalEntry({ user, symbol: 'X', state: 'closed', exitPrice: 10 }));
        assert.ok(missing.includes('entryPrice'));
    });

    test('state is limited to the four real stages', () => {
        assert.ok(errors(new JournalEntry({ user, symbol: 'X', state: 'pending' })).includes('state'));
    });

    test('a setup is whatever the trader calls it, and stays unset until named', () => {
        // A fixed list put 7 of 8 entries in "other", so the vocabulary is the
        // trader's. No default either: "other" on every ungraded trade is noise
        // that reads like an answer.
        assert.equal(new JournalEntry({ user, symbol: 'X' }).setupType, undefined);
        const doc = new JournalEntry({ user, symbol: 'X', setupType: '  failed breakdown  ' });
        assert.equal(doc.setupType, 'failed breakdown', 'trimmed, so the same words are one tag');
    });

    test('trackers are trimmed, so the same words stay one row in a total', () => {
        const doc = new JournalEntry({
            user, symbol: 'X', whatHappened: ['  chased the move  ', 'revenge trade']
        });
        assert.deepEqual(doc.whatHappened.slice(), ['chased the move', 'revenge trade']);
    });

    test('a trade defaults to open, so existing callers keep working', () => {
        const doc = new JournalEntry({ user, symbol: 'X', entryDate: new Date(), entryPrice: 10, quantity: 1 });
        assert.equal(doc.state, 'open');
    });
});

describe('the plannedTarget virtual', () => {
    const doc = () => new JournalEntry({ user, symbol: 'X', state: 'planned' });

    test('writes through into targets[]', () => {
        const d = doc();
        d.plannedTarget = 120;
        assert.equal(d.targets.length, 1);
        assert.equal(d.targets[0].price, 120);
        assert.equal(d.targets[0].level, 1);
    });

    test('reads back the nearest target', () => {
        const d = doc();
        d.targets = [{ level: 1, price: 110 }, { level: 2, price: 130 }];
        assert.equal(d.plannedTarget, 110);
    });

    test('overwrites rather than appending', () => {
        const d = doc();
        d.plannedTarget = 120;
        d.plannedTarget = 125;
        assert.equal(d.targets.length, 1, 'a second write must not add a target');
        assert.equal(d.targets[0].price, 125);
    });

    test('clearing it empties the targets', () => {
        const d = doc();
        d.plannedTarget = 120;
        d.plannedTarget = null;
        assert.equal(d.targets.length, 0);
    });

    test('is undefined when nothing is set, not zero', () => {
        assert.equal(doc().plannedTarget, undefined);
    });

    test('survives serialisation, since callers read it off the JSON', () => {
        const d = doc();
        d.plannedTarget = 120;
        assert.equal(d.toObject().plannedTarget, 120);
        assert.equal(d.toJSON().plannedTarget, 120);
    });

    test('status is exposed the same way', () => {
        assert.equal(doc().toObject().status, 'planned');
    });
});

describe('targets on the wrong side of entry', () => {
    const open = (o) => ({ state: 'open', entryPrice: 1000, ...o });

    test('a long target below entry is refused', () => {
        const bad = targetOnWrongSide(open({ direction: 'long', targets: [{ price: 900 }] }));
        assert.equal(bad.price, 900);
    });

    test('a short target above entry is refused', () => {
        const bad = targetOnWrongSide(open({ direction: 'short', targets: [{ price: 1100 }] }));
        assert.equal(bad.price, 1100);
    });

    test('entry itself is not a target', () => {
        assert.ok(targetOnWrongSide(open({ direction: 'long', targets: [{ price: 1000 }] })));
    });

    test('targets on the right side pass', () => {
        assert.equal(targetOnWrongSide(open({ direction: 'long', targets: [{ price: 1100 }] })), null);
        assert.equal(targetOnWrongSide(open({ direction: 'short', targets: [{ price: 900 }] })), null);
    });

    test('it reports the first offender out of several', () => {
        const bad = targetOnWrongSide(open({
            direction: 'long', targets: [{ price: 1100 }, { price: 800 }]
        }));
        assert.equal(bad.price, 800);
    });

    test('a closed trade is left alone, whatever its targets say', () => {
        // History is history. Re-validating it would block editing an old lesson.
        assert.equal(targetOnWrongSide({
            state: 'closed', direction: 'long', entryPrice: 1000, targets: [{ price: 900 }]
        }), null);
    });

    test('no reference price means nothing to check against', () => {
        assert.equal(targetOnWrongSide({
            state: 'planned', direction: 'long', targets: [{ price: 100 }]
        }), null);
        assert.equal(targetOnWrongSide({ state: 'open', direction: 'long', targets: [] }), null);
    });
});

describe('target ordering', () => {
    test('a long counts up, nearest first', () => {
        const t = orderTargets([{ price: 130 }, { price: 110 }, { price: 120 }], 'long');
        assert.deepEqual(t.map(x => x.price), [110, 120, 130]);
        assert.deepEqual(t.map(x => x.level), [1, 2, 3]);
    });

    test('a short counts down, because its targets sit below entry', () => {
        const t = orderTargets([{ price: 80 }, { price: 95 }, { price: 90 }], 'short');
        assert.deepEqual(t.map(x => x.price), [95, 90, 80]);
        assert.deepEqual(t.map(x => x.level), [1, 2, 3], 'level 1 is the nearest, not the lowest');
    });

    test('handles nothing at all', () => {
        assert.deepEqual(orderTargets([], 'long'), []);
        assert.equal(orderTargets(undefined, 'long'), undefined);
    });
});
