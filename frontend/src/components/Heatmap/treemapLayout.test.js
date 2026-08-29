/**
 * The layout is arithmetic, so it is checked as arithmetic. The properties below
 * are the ones a reader depends on: every sector appears, none overlaps, the
 * area really is proportional, and nothing escapes the box.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { squarify, squarifyByDirection, colorStop, scaleFor, fitLabel, tileWeight } from './treemapLayout.js';

const items = [
    { key: 'a', weight: 40 }, { key: 'b', weight: 25 }, { key: 'c', weight: 20 },
    { key: 'd', weight: 10 }, { key: 'e', weight: 5 }
];

describe('squarify', () => {
    test('lays out every item', () => {
        assert.equal(squarify(items, 400, 300).length, items.length);
    });

    test('area is proportional to weight', () => {
        const tiles = squarify(items, 400, 300);
        const total = items.reduce((a, i) => a + i.weight, 0);
        for (const tile of tiles) {
            const item = items.find((i) => i.key === tile.key);
            const expected = (item.weight / total) * 400 * 300;
            const actual = tile.width * tile.height;
            assert.ok(Math.abs(actual - expected) / expected < 0.02,
                `${tile.key}: expected ~${expected.toFixed(0)}, got ${actual.toFixed(0)}`);
        }
    });

    test('nothing escapes the box', () => {
        for (const t of squarify(items, 400, 300)) {
            assert.ok(t.x >= -0.01 && t.y >= -0.01, `${t.key} starts outside`);
            assert.ok(t.x + t.width <= 400.01, `${t.key} runs off the right`);
            assert.ok(t.y + t.height <= 300.01, `${t.key} runs off the bottom`);
        }
    });

    test('no two tiles overlap', () => {
        const tiles = squarify(items, 400, 300);
        for (let i = 0; i < tiles.length; i++) {
            for (let j = i + 1; j < tiles.length; j++) {
                const a = tiles[i], b = tiles[j];
                const apart = a.x + a.width <= b.x + 0.01 || b.x + b.width <= a.x + 0.01
                    || a.y + a.height <= b.y + 0.01 || b.y + b.height <= a.y + 0.01;
                assert.ok(apart, `${a.key} overlaps ${b.key}`);
            }
        }
    });

    // A sector with no companies, or a zero market cap, has no area to give.
    // Laying it out anyway would produce a tile of width zero that no one can
    // click and nothing can label.
    test('weightless items are dropped rather than drawn invisibly', () => {
        const tiles = squarify([{ key: 'a', weight: 10 }, { key: 'z', weight: 0 }], 100, 100);
        assert.deepEqual(tiles.map((t) => t.key), ['a']);
    });

    test('degenerate boxes produce nothing rather than NaN', () => {
        assert.deepEqual(squarify(items, 0, 300), []);
        assert.deepEqual(squarify([], 400, 300), []);
    });
});

describe('colorStop', () => {
    test('zero sits in the middle, the scale ends reach the extremes', () => {
        assert.equal(colorStop(0, 10), 0.5);
        assert.equal(colorStop(10, 10), 1);
        assert.equal(colorStop(-10, 10), 0);
    });

    test('beyond the scale is clamped, not wrapped', () => {
        assert.equal(colorStop(999, 10), 1);
        assert.equal(colorStop(-999, 10), 0);
    });

    // The reason for easing: a tenth of the scale should still be visibly
    // coloured, not a rounding error away from neutral grey.
    test('a small move is still visible', () => {
        const stop = colorStop(1, 10);
        assert.ok(stop > 0.63, `expected a visible green, got ${stop}`);
    });
});

describe('scaleFor', () => {
    test('one runaway sector does not flatten the rest', () => {
        const ordinary = [1, -2, 3, -1, 2, -3, 1, -2];
        assert.ok(scaleFor([...ordinary, 240]) < 10,
            'a single 240% move must not set the scale for everything else');
    });

    test('never returns zero, so a flat day still divides safely', () => {
        assert.ok(scaleFor([0, 0, 0]) > 0);
        assert.ok(scaleFor([]) > 0);
    });
});

describe('fitLabel', () => {
    test('a label that fits is left alone', () => {
        assert.equal(fitLabel('CEMENT', 200, 12), 'CEMENT');
    });

    // The front of a PSX sector name is the part that identifies it. Clipping a
    // centred label ate both ends and left "BANKS / INV. COS." on screen.
    test('a long label keeps its beginning', () => {
        const out = fitLabel('INV. BANKS / INV. COS. / SECURITIES COS.', 80, 11.5);
        assert.ok(out.startsWith('INV.'), `lost the front: ${out}`);
        assert.ok(out.endsWith('\u2026'), `no ellipsis: ${out}`);
    });

    test('a tile too small for any word gets no label at all', () => {
        assert.equal(fitLabel('CEMENT', 10, 11.5), null);
    });
});

describe('tileWeight', () => {
    test('order is preserved', () => {
        assert.ok(tileWeight(900) > tileWeight(100));
        assert.ok(tileWeight(100) > tileWeight(1));
    });

    // The point of flattening: PSX's largest sector is ~8000x the smallest, and
    // at that ratio everything but the banks is a crumb.
    test('the spread is pulled in hard', () => {
        const raw = 8000;
        assert.ok(tileWeight(raw) / tileWeight(1) < raw / 8,
            'an 8000x cap gap must not stay an 8000x area gap');
    });

    test('a sector with no cap gets no area rather than NaN', () => {
        assert.equal(tileWeight(0), 0);
        assert.equal(tileWeight(null), 0);
    });
});

describe('squarifyByDirection', () => {
    const mixed = [
        { key: 'bigLoser', weight: 100, value: -2 },
        { key: 'smallWinner', weight: 5, value: 20 },
        { key: 'midWinner', weight: 30, value: 4 },
        { key: 'midLoser', weight: 20, value: -6 }
    ];

    // The whole point: the biggest sector on the board is down, and it must not
    // take the leading position on a map about performance.
    test('no decliner starts left of any gainer', () => {
        const tiles = squarifyByDirection(mixed, 400, 300);
        const at = (k) => tiles.find((t) => t.key === k);
        const winnersRight = Math.max(at('smallWinner').x + at('smallWinner').width,
            at('midWinner').x + at('midWinner').width);
        const losersLeft = Math.min(at('bigLoser').x, at('midLoser').x);
        assert.ok(losersLeft >= winnersRight - 0.01,
            'a decliner started before a gainer ended');
    });

    test('within a side, the bigger sector still leads', () => {
        const tiles = squarifyByDirection(mixed, 400, 300);
        const big = tiles.find((t) => t.key === 'bigLoser');
        const mid = tiles.find((t) => t.key === 'midLoser');
        assert.ok(big.width * big.height > mid.width * mid.height,
            'weight must still decide area');
    });

    test('every item is laid out exactly once', () => {
        const tiles = squarifyByDirection(mixed, 400, 300);
        assert.equal(tiles.length, mixed.length);
        assert.equal(new Set(tiles.map((t) => t.key)).size, mixed.length);
    });

    // A day where nothing fell, or nothing rose, must not leave half the map blank.
    test('a one-sided board uses the whole width', () => {
        const allUp = mixed.map((i) => ({ ...i, value: Math.abs(i.value) }));
        const tiles = squarifyByDirection(allUp, 400, 300);
        const right = Math.max(...tiles.map((t) => t.x + t.width));
        assert.ok(right > 399, `only reached ${right} of 400`);
    });
});
