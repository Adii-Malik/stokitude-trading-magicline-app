/** The banding rule, which is the whole argument against named lists. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, bandFor, daysSince, isStale, tally, group } from './horizons.js';

const NOW = new Date('2026-08-30T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

const flag = (over) => ({
    symbol: 'PRL', sector: 'REFINERY', period: 'Perf.1M',
    noticedAt: daysAgo(1), state: 'noticed', ...over
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

    // A period the app stops offering should not make a flag disappear.
    test('an unknown period falls to swing rather than vanishing', () => {
        assert.equal(bandFor('Perf.42Y').id, 'swing');
    });
});

describe('isStale', () => {
    // The point of banding: identical age, opposite verdicts.
    test('five days is stale on a weekly idea', () => {
        assert.equal(isStale(flag({ period: 'Perf.W', noticedAt: daysAgo(5) }), NOW), true);
    });

    test('five days is nothing on a yearly one', () => {
        assert.equal(isStale(flag({ period: 'Perf.Y', noticedAt: daysAgo(5) }), NOW), false);
    });

    test('the window is exclusive, so a flag is fresh on its last day', () => {
        assert.equal(isStale(flag({ period: 'Perf.W', noticedAt: daysAgo(2) }), NOW), false);
        assert.equal(isStale(flag({ period: 'Perf.W', noticedAt: daysAgo(3) }), NOW), true);
    });

    // An idea you already looked at and wrote off must never nag: a badge that
    // cries wolf is a badge you stop reading.
    test('an analysed name never goes stale', () => {
        const old = flag({ period: 'Perf.W', noticedAt: daysAgo(90), state: 'analysed' });
        assert.equal(isStale(old, NOW), false);
    });
});

describe('tally', () => {
    test('counts what needs you, and what you are about to miss', () => {
        const items = [
            flag({ symbol: 'PRL' }),
            flag({ symbol: 'STJT', period: 'Perf.W', noticedAt: daysAgo(5) }),
            flag({ symbol: 'ATRL', state: 'analysed' })
        ];
        assert.deepEqual(tally(items, NOW), { waiting: 2, stale: 1 });
    });

    test('an empty shortlist is quiet', () => {
        assert.deepEqual(tally([], NOW), { waiting: 0, stale: 0 });
    });
});

describe('group', () => {
    const items = [
        flag({ symbol: 'STJT', sector: 'TEXTILE WEAVING', period: 'Perf.W', noticedAt: daysAgo(5) }),
        flag({ symbol: 'PRL', noticedAt: daysAgo(6) }),
        flag({ symbol: 'ATRL', noticedAt: daysAgo(6), state: 'analysed' }),
        flag({ symbol: 'PIM', sector: 'MODARABAS', noticedAt: daysAgo(2) })
    ];

    test('bands keep their declared order, so the page does not rearrange itself', () => {
        assert.deepEqual(group(items, NOW).map((b) => b.id), ['short', 'swing']);
    });

    test('empty bands are left out rather than shown as headings with nothing under them', () => {
        assert.equal(group(items, NOW).some((b) => b.id === 'theme'), false);
    });

    test('the same sector on two boards is two groups, because they are two ideas', () => {
        const both = [
            flag({ sector: 'REFINERY', period: 'Perf.W' }),
            flag({ sector: 'REFINERY', period: 'Perf.1M' })
        ];
        const bands = group(both, NOW);
        assert.equal(bands.length, 2);
        assert.equal(bands[0].groups.length, 1);
        assert.equal(bands[1].groups.length, 1);
    });

    test('within a sector, anything still waiting comes before anything analysed', () => {
        const swing = group(items, NOW).find((b) => b.id === 'swing');
        const refinery = swing.groups.find((g) => g.sector === 'REFINERY');
        assert.deepEqual(refinery.items.map((i) => i.symbol), ['PRL', 'ATRL']);
    });

    test('the freshest sector leads its band', () => {
        const swing = group(items, NOW).find((b) => b.id === 'swing');
        assert.deepEqual(swing.groups.map((g) => g.sector), ['MODARABAS', 'REFINERY']);
    });

    test('a group is stale when any name in it is', () => {
        const short = group(items, NOW).find((b) => b.id === 'short');
        assert.equal(short.groups[0].stale, true);
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
