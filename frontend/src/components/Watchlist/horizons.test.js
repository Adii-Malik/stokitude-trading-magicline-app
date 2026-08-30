/** The banding rule, which is the whole argument against named lists. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    BANDS, bandFor, daysSince, lastLookAt, daysLeft, isDue, tally, order, dueText
} from './horizons.js';

const NOW = new Date('2026-08-31T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

/** A flag, with looks given as ages in days rather than dates. */
const flag = ({ looks = [], noticed = 1, ...over } = {}) => ({
    symbol: 'PRL', sector: 'REFINERY', period: 'Perf.1M',
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

    test('dropped names are not in the list at all', () => {
        assert.equal(order(items, NOW).some((i) => i.symbol === 'ATRL'), false);
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
