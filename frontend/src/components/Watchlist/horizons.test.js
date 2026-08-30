/** The banding rule, which is the whole argument against named lists. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    BANDS, bandFor, daysSince, lastLookAt, daysLeft, isLive, hasFired, isDue,
    tally, order, split, matches, dueText, meterFor
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

describe('bandFor', () => {
    test('every period the heatmap offers lands in exactly one band', () => {
        const all = ['change', 'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.YTD', 'Perf.Y', 'Perf.5Y'];
        for (const period of all) {
            const hits = BANDS.filter((b) => b.periods.includes(period));
            assert.equal(hits.length, 1, `${period} should belong to one band, got ${hits.length}`);
        }
    });

    test('the daily and weekly boards are short-horizon', () => {
        assert.equal(bandFor('change').id, 'short');
        assert.equal(bandFor('Perf.W').id, 'short');
    });

    test('a five-year flag is a theme, not a trade', () => {
        assert.equal(bandFor('Perf.5Y').id, 'theme');
    });

    // A period the app stops offering must not make a flag disappear.
    test('an unknown period falls to swing rather than vanishing', () => {
        assert.equal(bandFor('Perf.42Y').id, 'swing');
    });
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

describe('daysLeft', () => {
    // The whole point of the rewrite: the clock runs from the last look, so a
    // name you checked yesterday is not overdue however long you have held it.
    test('runs from the last look, not from the day you flagged it', () => {
        const held = flag({ noticed: 90, looks: [1] });
        assert.equal(daysLeft(held, NOW), 13, 'swing gives 14 days, one has passed');
    });

    test('runs from the flag date when there are no looks', () => {
        assert.equal(daysLeft(flag({ noticed: 6, looks: [] }), NOW), 8);
    });

    test('goes negative once the horizon has run out', () => {
        assert.equal(daysLeft(flag({ period: 'Perf.W', looks: [5] }), NOW), -3);
    });

    test('the same neglect is overdue on a week and fine on a year', () => {
        assert.ok(daysLeft(flag({ period: 'Perf.W', looks: [5] }), NOW) < 0);
        assert.ok(daysLeft(flag({ period: 'Perf.Y', looks: [5] }), NOW) > 0);
    });
});

describe('isDue', () => {
    test('a name past its horizon is asking for you', () => {
        assert.equal(isDue(flag({ period: 'Perf.W', looks: [5] }), NOW), true);
    });

    test('one you looked at today is not', () => {
        assert.equal(isDue(flag({ period: 'Perf.W', looks: [0] }), NOW), false);
    });

    // A dropped idea nagging you is the fastest way to teach you to stop
    // reading the badge.
    test('a dropped name never is, however old', () => {
        assert.equal(isDue(flag({ period: 'Perf.W', looks: [400], state: 'dropped' }), NOW), false);
    });

    test('one whose level printed is, whatever the clock says', () => {
        assert.equal(isDue(flag({ looks: [0], triggeredAt: daysAgo(0) }), NOW), true);
    });
});

describe('tally', () => {
    test('counts only what is asking for you', () => {
        const items = [
            flag({ symbol: 'STJT', period: 'Perf.W', looks: [5] }),   // due
            flag({ symbol: 'PRL', looks: [40] }),                     // due
            flag({ symbol: 'PIM', looks: [1] }),                      // not due
            flag({ symbol: 'ATRL', looks: [400], state: 'dropped' })  // never
        ];
        assert.deepEqual(tally(items, NOW), { due: 2 });
    });

    test('an empty shortlist is quiet', () => {
        assert.deepEqual(tally([], NOW), { due: 0 });
    });

    // The badge should be absent, not zero: nothing wants you.
    test('a list where nothing is due is quiet too', () => {
        assert.deepEqual(tally([flag({ looks: [1] })], NOW), { due: 0 });
    });

    // A name the watcher already closed has an answer. Counting it would nag
    // you about a question that is settled.
    test('names that are already settled never count', () => {
        const settled = [
            flag({ symbol: 'PSO', state: 'invalidated', looks: [90] }),
            flag({ symbol: 'OGDC', state: 'traded', looks: [90] }),
            flag({ symbol: 'ATRL', state: 'dropped', looks: [90] })
        ];
        assert.deepEqual(tally(settled, NOW), { due: 0 });
    });

    test('a fired level counts even when the clock has not run out', () => {
        assert.deepEqual(tally([flag({ looks: [0], triggeredAt: daysAgo(0) })], NOW), { due: 1 });
    });
});

describe('hasFired', () => {
    test('true once the watcher has fired and disarmed the trigger', () => {
        assert.equal(hasFired(flag({ triggeredAt: daysAgo(1), trigger: null })), true);
    });

    // Setting a new level on your next look is how you answer the alert. Leaving
    // it flagged after that would pin the row to the top forever.
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

describe('isLive', () => {
    test('only a name you are still watching', () => {
        assert.equal(isLive(flag({})), true);
        for (const state of ['dropped', 'invalidated', 'traded']) {
            assert.equal(isLive(flag({ state })), false, state);
        }
    });
});

describe('split', () => {
    const items = [
        flag({ symbol: 'PRL', looks: [40] }),
        flag({ symbol: 'PPL', state: 'invalidated', invalidatedAt: daysAgo(2) }),
        flag({ symbol: 'PSO', state: 'invalidated', invalidatedAt: daysAgo(9) }),
        flag({ symbol: 'OGDC', state: 'traded' }),
        flag({ symbol: 'ATRL', state: 'dropped' })
    ];

    test('every name lands in exactly one of the three', () => {
        const g = split(items, NOW);
        assert.deepEqual(g.queue.map((i) => i.symbol), ['PRL']);
        assert.deepEqual(g.dead.map((i) => i.symbol), ['PPL', 'PSO']);
        assert.deepEqual(g.past.map((i) => i.symbol).sort(), ['ATRL', 'OGDC']);
        assert.equal(g.queue.length + g.dead.length + g.past.length, items.length);
    });

    test('the most recently closed idea is the one you have not seen yet', () => {
        assert.equal(split(items, NOW).dead[0].symbol, 'PPL');
    });
});

describe('matches', () => {
    const prl = flag({ symbol: 'PRL', name: 'Pakistan Refinery', sector: 'REFINERY' });

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

describe('order', () => {
    const items = [
        flag({ symbol: 'PIM', looks: [1] }),                     // +13
        flag({ symbol: 'STJT', period: 'Perf.W', looks: [5] }),  // -3
        flag({ symbol: 'PPL', period: 'Perf.Y', looks: [11] }),  // +49
        flag({ symbol: 'ATRL', state: 'dropped', looks: [1] })
    ];

    test('the most overdue leads, so the top of the screen is the next thing to do', () => {
        assert.deepEqual(order(items, NOW).map((i) => i.symbol), ['STJT', 'PIM', 'PPL']);
    });

    // You asked to be interrupted for this one. Burying it under a name that is
    // merely late would waste the only alert you set yourself.
    test('a fired level jumps the whole queue, however new it is', () => {
        const fired = flag({ symbol: 'HCAR', looks: [0], triggeredAt: daysAgo(0) });
        assert.equal(order([...items, fired], NOW)[0].symbol, 'HCAR');
    });

    test('dropped names are not in the list at all', () => {
        assert.equal(order(items, NOW).some((i) => i.symbol === 'ATRL'), false);
    });

    // The reason dead names are fetched at all is so the verdict has somewhere
    // to land - but the queue is work, and a closed idea is not work.
    test('dead and traded names are not in the queue either', () => {
        const settled = [
            flag({ symbol: 'PSO', state: 'invalidated', looks: [30] }),
            flag({ symbol: 'OGDC', state: 'traded', looks: [30] })
        ];
        assert.deepEqual(order(settled, NOW), []);
    });

    test('an empty list stays empty rather than throwing', () => {
        assert.deepEqual(order([], NOW), []);
    });
});

describe('dueText', () => {
    test('says the answer rather than the rule', () => {
        assert.equal(dueText(flag({ period: 'Perf.W', looks: [5] }), NOW).text, 'overdue by 3 days');
        assert.equal(dueText(flag({ period: 'Perf.W', looks: [2] }), NOW).text, 'due today');
        assert.equal(dueText(flag({ looks: [12] }), NOW).text, '2 days left');
        assert.equal(dueText(flag({ looks: [1] }), NOW).text, '13 days left');
    });

    test('singular reads as singular', () => {
        assert.equal(dueText(flag({ period: 'Perf.W', looks: [3] }), NOW).text, 'overdue by 1 day');
        assert.equal(dueText(flag({ period: 'Perf.W', looks: [1] }), NOW).text, '1 day left');
    });

    // A countdown beside "your level printed" reads as a contradiction, and the
    // countdown is the half that stopped mattering.
    test('a fired level replaces the countdown rather than sitting beside it', () => {
        const fired = dueText(flag({ looks: [1], triggeredAt: daysAgo(0) }), NOW);
        assert.equal(fired.text, 'your level printed');
        assert.equal(fired.tone, 'fired');
    });

    // Colour is a hint; the words carry it, so they must be right on their own.
    test('tone escalates as the deadline closes', () => {
        assert.equal(dueText(flag({ looks: [1] }), NOW).tone, 'calm');
        assert.equal(dueText(flag({ looks: [12] }), NOW).tone, 'soon');
        assert.equal(dueText(flag({ looks: [40] }), NOW).tone, 'late');
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
