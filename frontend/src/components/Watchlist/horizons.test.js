/** What asks for you, and what is only sitting there. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    daysSince, lastLookAt, daysIdle, isLive, hasFired, neverOpened, isDue,
    tally, order, kindOf, split, matches, statusOf, meterFor
} from './horizons.js';

const NOW = new Date('2026-08-31T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

/** A flag, with looks given as ages in days rather than dates. */
const flag = ({ looks = [], noticed = 1, ...over } = {}) => ({
    symbol: 'PRL', name: 'Pakistan Refinery', sector: 'REFINERY', period: 'Perf.1M',
    noticedAt: daysAgo(noticed), state: 'watching',
    looks: looks.map((d) => ({ at: daysAgo(d), note: 'a note' })),
    ...over
});

describe('lastLookAt', () => {
    test('is the newest look', () => {
        assert.equal(lastLookAt(flag({ looks: [9, 3] })), daysAgo(3));
    });

    test('falls back to the day you flagged it when you never looked', () => {
        assert.equal(lastLookAt(flag({ noticed: 6 })), daysAgo(6));
    });

    // The server sends it precomputed; trust that over rederiving it.
    test('prefers a value the server already worked out', () => {
        assert.equal(lastLookAt({ lastLookAt: daysAgo(2), looks: [], noticedAt: daysAgo(40) }), daysAgo(2));
    });
});

describe('isLive', () => {
    test('only a name you are still watching', () => {
        assert.equal(isLive(flag({})), true);
        for (const state of ['dropped', 'invalidated', 'traded']) {
            assert.equal(isLive(flag({ state })), false, state);
        }
    });
});

describe('hasFired', () => {
    test('true once the watcher has fired and disarmed the trigger', () => {
        assert.equal(hasFired(flag({ triggeredAt: daysAgo(1), trigger: null })), true);
    });

    // Setting a new level on your next look is how you answer the alert.
    test('re-arming it answers the alert', () => {
        assert.equal(hasFired(flag({ triggeredAt: daysAgo(1), trigger: { price: 90, dir: 'above' } })), false);
    });

    test('a name that never fired has not fired', () => {
        assert.equal(hasFired(flag({})), false);
    });

    test('a settled name is not shouting for attention', () => {
        assert.equal(hasFired(flag({ triggeredAt: daysAgo(1), state: 'traded' })), false);
    });
});

describe('neverOpened', () => {
    test('flagged and not looked at once', () => {
        assert.equal(neverOpened(flag({ noticed: 40 })), true);
    });

    // It is an unfinished action, not an ageing one, so any look at all clears
    // it - whatever you concluded and however long ago.
    test('one look clears it forever', () => {
        assert.equal(neverOpened(flag({ noticed: 400, looks: [399] })), false);
    });

    // Putting a name back is a decision you just made about it.
    test('reviving it counts as opening it', () => {
        assert.equal(neverOpened(flag({ noticed: 200, resumedAt: daysAgo(1) })), false);
    });

    test('a settled name never counts', () => {
        assert.equal(neverOpened(flag({ state: 'dropped' })), false);
    });
});

describe('isDue', () => {
    test('a fired level asks for you', () => {
        assert.equal(isDue(flag({ looks: [0], triggeredAt: daysAgo(0) })), true);
    });

    test('so does one you never opened', () => {
        assert.equal(isDue(flag({ noticed: 3 })), true);
    });

    // The whole point of the rewrite. Nothing happened to this name, so nothing
    // is asking - however long it has been.
    test('age alone never does, however old', () => {
        assert.equal(isDue(flag({ noticed: 400, looks: [380] })), false);
    });

    test('a dropped name never does', () => {
        assert.equal(isDue(flag({ state: 'dropped', noticed: 400 })), false);
    });
});

describe('tally', () => {
    test('counts only what is asking for you', () => {
        const items = [
            flag({ symbol: 'STJT', triggeredAt: daysAgo(1), looks: [1] }),  // fired
            flag({ symbol: 'PRL', noticed: 3 }),                            // never opened
            flag({ symbol: 'PIM', looks: [300], noticed: 400 }),            // old, quiet
            flag({ symbol: 'ATRL', state: 'dropped' })
        ];
        assert.deepEqual(tally(items), { due: 2 });
    });

    test('an empty shortlist is quiet', () => {
        assert.deepEqual(tally([]), { due: 0 });
    });

    // The badge should be absent, not zero: nothing wants you.
    test('a worked list is quiet too', () => {
        assert.deepEqual(tally([flag({ looks: [1] })]), { due: 0 });
    });
});

describe('order', () => {
    const items = [
        flag({ symbol: 'PIM', looks: [1] }),
        flag({ symbol: 'OGDC', looks: [90] }),
        flag({ symbol: 'STJT', triggeredAt: daysAgo(1), looks: [0] }),
        flag({ symbol: 'NRL', noticed: 2 }),
        flag({ symbol: 'ATRL', state: 'dropped', looks: [1] })
    ];

    test('fired first, then never opened, then longest since you looked', () => {
        assert.deepEqual(order(items, NOW).map((i) => i.symbol), ['STJT', 'NRL', 'OGDC', 'PIM']);
    });

    test('settled names are not in the queue at all', () => {
        const settled = [flag({ state: 'invalidated' }), flag({ state: 'traded' }), flag({ state: 'dropped' })];
        assert.deepEqual(order(settled, NOW), []);
    });

    test('an empty list stays empty rather than throwing', () => {
        assert.deepEqual(order([], NOW), []);
    });
});

describe('statusOf', () => {
    test('names the two things that actually happened', () => {
        assert.deepEqual(statusOf(flag({ triggeredAt: daysAgo(1), looks: [1] })),
            { text: 'Your level printed', tone: 'fired' });
        assert.deepEqual(statusOf(flag({ noticed: 3 })),
            { text: 'Never opened', tone: 'soon' });
    });

    // A name merely sitting there has no status worth a coloured chip; how long
    // it has been is already in the line below it, in words.
    test('says nothing about a name that is only waiting', () => {
        assert.equal(statusOf(flag({ looks: [40] })), null);
        assert.equal(statusOf(flag({ looks: [1] })), null);
    });
});

describe('daysIdle', () => {
    test('counts from the last look', () => {
        assert.equal(daysIdle(flag({ noticed: 90, looks: [4] }), NOW), 4);
    });

    test('and from the flag date when there was never a look', () => {
        assert.equal(daysIdle(flag({ noticed: 6 }), NOW), 6);
    });
});

describe('daysSince', () => {
    test('counts whole days', () => {
        assert.equal(daysSince(daysAgo(3), NOW), 3);
        assert.equal(daysSince(new Date(NOW).toISOString(), NOW), 0);
    });

    test('a missing date is not a negative age', () => {
        assert.equal(daysSince(null, NOW), 0);
    });
});

describe('kindOf', () => {
    test('names how a name stopped being live, and nothing while it is', () => {
        assert.equal(kindOf(flag({})), null);
        assert.equal(kindOf(flag({ state: 'invalidated' })), 'dead');
        assert.equal(kindOf(flag({ state: 'dropped' })), 'passed');
        assert.equal(kindOf(flag({ state: 'traded' })), 'traded');
    });
});

describe('split', () => {
    const items = [
        flag({ symbol: 'PRL', looks: [40] }),
        flag({ symbol: 'PPL', state: 'invalidated', settledAt: daysAgo(2) }),
        flag({ symbol: 'PSO', state: 'invalidated', settledAt: daysAgo(9) }),
        flag({ symbol: 'OGDC', state: 'traded', settledAt: daysAgo(5) }),
        flag({ symbol: 'ATRL', state: 'dropped', settledAt: daysAgo(30) })
    ];

    test('the work is one list and everything finished is the other', () => {
        const g = split(items, NOW);
        assert.deepEqual(g.queue.map((i) => i.symbol), ['PRL']);
        assert.deepEqual(g.past.map((i) => i.symbol), ['PPL', 'OGDC', 'PSO', 'ATRL']);
        assert.equal(g.queue.length + g.past.length, items.length);
    });

    test('history leads with whatever settled most recently', () => {
        assert.equal(split(items, NOW).past[0].symbol, 'PPL');
    });

    test('a name that never settled is never in history', () => {
        assert.deepEqual(split([flag({})], NOW).past, []);
    });
});

describe('matches', () => {
    const prl = flag({});

    test('finds a name by symbol, sector or company, ignoring case', () => {
        for (const q of ['prl', 'refin', 'Pakistan']) assert.equal(matches(prl, q), true, q);
    });

    test('an empty box filters nothing', () => {
        assert.equal(matches(prl, '   '), true);
    });

    test('says no when it does not match', () => {
        assert.equal(matches(prl, 'cement'), false);
    });
});

describe('meterFor', () => {
    const between = { invalidation: { price: 79, dir: 'below' }, trigger: { price: 88, dir: 'above' }, priceNow: 84 };

    test('places price between the two ends', () => {
        const m = meterFor(between);
        assert.equal(Math.round(m.at * 100), 56);
        assert.equal(m.past, null);
        assert.equal(m.lo.label, 'dead below');
        assert.equal(m.hi.label, 'wake me above');
    });

    // The case that matters most: the idea has run away from you.
    test('pins and reports when price is past the invalidation', () => {
        const m = meterFor({ ...between, priceNow: 70 });
        assert.equal(m.at, 0);
        assert.equal(m.past, 'invalidation');
    });

    test('pins and reports when price is past the trigger', () => {
        const m = meterFor({ ...between, priceNow: 95 });
        assert.equal(m.at, 1);
        assert.equal(m.past, 'trigger');
    });

    test('there is nothing to draw without both levels and a price', () => {
        assert.equal(meterFor({ trigger: { price: 88, dir: 'above' }, priceNow: 84 }), null);
        assert.equal(meterFor({ ...between, priceNow: null }), null);
        assert.equal(meterFor(null), null);
    });
});
