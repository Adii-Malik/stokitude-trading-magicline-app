/**
 * The layout is arithmetic, so it is checked as arithmetic. The properties below
 * are the ones a reader depends on: every sector appears, none overlaps, the
 * area really is proportional, and nothing escapes the box.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { squarify, stripLayout, colorStop, scaleFor, fitLabel, tileWeight } from './treemapLayout.js';

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


describe('stripLayout', () => {
    // Ordered best to worst. The point of this layout over the squarified one:
    // the order given is the order laid out, so the best performer leads even
    // when a heavier sector did worse.
    const ranked = [
        { key: 'bestButSmall', weight: 5 },
        { key: 'goodAndHuge', weight: 100 },
        { key: 'flatMidsize', weight: 30 },
        { key: 'worstAndBig', weight: 60 }
    ];

    test('the first item given is the first laid out', () => {
        const tiles = stripLayout(ranked, 600, 400);
        const first = tiles[0];
        assert.equal(first.key, 'bestButSmall');
        assert.equal(first.x, 0);
        assert.equal(first.y, 0);
    });

    test('order is preserved reading left to right, top to bottom', () => {
        const tiles = stripLayout(ranked, 600, 400);
        for (let i = 1; i < tiles.length; i++) {
            const prev = tiles[i - 1], cur = tiles[i];
            const laterRow = cur.y > prev.y + 0.01;
            const sameRowFurtherRight = Math.abs(cur.y - prev.y) < 0.01 && cur.x >= prev.x - 0.01;
            assert.ok(laterRow || sameRowFurtherRight,
                `${cur.key} was placed before ${prev.key}`);
        }
    });

    test('area is still proportional to weight', () => {
        const tiles = stripLayout(ranked, 600, 400);
        const total = ranked.reduce((a, i) => a + i.weight, 0);
        for (const tile of tiles) {
            const item = ranked.find((i) => i.key === tile.key);
            const expected = (item.weight / total) * 600 * 400;
            const actual = tile.width * tile.height;
            assert.ok(Math.abs(actual - expected) / expected < 0.02,
                `${tile.key}: expected ~${expected.toFixed(0)}, got ${actual.toFixed(0)}`);
        }
    });

    test('nothing escapes the box and nothing overlaps', () => {
        const tiles = stripLayout(ranked, 600, 400);
        for (const t of tiles) {
            assert.ok(t.x >= -0.01 && t.x + t.width <= 600.01, `${t.key} off the side`);
            assert.ok(t.y >= -0.01 && t.y + t.height <= 400.01, `${t.key} off the bottom`);
        }
        for (let i = 0; i < tiles.length; i++) {
            for (let j = i + 1; j < tiles.length; j++) {
                const a = tiles[i], b = tiles[j];
                const apart = a.x + a.width <= b.x + 0.01 || b.x + b.width <= a.x + 0.01
                    || a.y + a.height <= b.y + 0.01 || b.y + b.height <= a.y + 0.01;
                assert.ok(apart, `${a.key} overlaps ${b.key}`);
            }
        }
    });

    test('everything is laid out exactly once', () => {
        const tiles = stripLayout(ranked, 600, 400);
        assert.equal(tiles.length, ranked.length);
        assert.equal(new Set(tiles.map((t) => t.key)).size, ranked.length);
    });

    test('degenerate input produces nothing rather than NaN', () => {
        assert.deepEqual(stripLayout([], 600, 400), []);
        assert.deepEqual(stripLayout(ranked, 0, 400), []);
        assert.deepEqual(stripLayout([{ key: 'z', weight: 0 }], 600, 400), []);
    });
});
