/**
 * Squarified treemap layout.
 *
 * Tiles get area in proportion to their weight, and the algorithm keeps each one
 * as close to square as it can. That matters here because a long thin sliver is
 * unreadable at any size - the whole complaint about the borrowed heatmap was
 * that half its sectors were slivers.
 *
 * Bruls, Huizing and van Wijk, "Squarified Treemaps" (2000). Pure, so the
 * arithmetic can be checked without rendering anything.
 */

/** How far from square the worst tile in a row is. Lower is better. */
function worstRatio(row, side, scale) {
    if (!row.length || !side) return Infinity;
    const sum = row.reduce((a, v) => a + v, 0) * scale;
    const max = Math.max(...row) * scale;
    const min = Math.min(...row) * scale;
    const side2 = side * side;
    const sum2 = sum * sum;
    return Math.max((side2 * max) / sum2, sum2 / (side2 * min));
}

/**
 * @param items {{ key, weight }[]}  weight must be positive; zero and negative
 *              are dropped, since a tile with no area cannot be clicked or read.
 * @param width, height  the box to fill
 * @returns {{ key, x, y, width, height }[]}
 */
export function squarify(items, width, height) {
    const usable = items.filter((i) => i.weight > 0);
    if (!usable.length || width <= 0 || height <= 0) return [];

    const total = usable.reduce((a, i) => a + i.weight, 0);
    const scale = (width * height) / total;
    const queue = [...usable].sort((a, b) => b.weight - a.weight);

    const out = [];
    let x = 0, y = 0, w = width, h = height;

    while (queue.length) {
        const side = Math.min(w, h);
        const row = [];
        // Grow the row while it makes the tiles rounder, stop when it stops.
        while (queue.length) {
            const next = [...row.map((r) => r.weight), queue[0].weight];
            if (row.length && worstRatio(next, side, scale) > worstRatio(row.map((r) => r.weight), side, scale)) break;
            row.push(queue.shift());
        }

        const rowSum = row.reduce((a, r) => a + r.weight, 0) * scale;
        const thickness = rowSum / side;
        let offset = 0;
        for (const item of row) {
            const length = (item.weight * scale) / thickness;
            out.push(w >= h
                ? { key: item.key, x, y: y + offset, width: thickness, height: length }
                : { key: item.key, x: x + offset, y, width: length, height: thickness });
            offset += length;
        }

        // Consume the strip just laid down.
        if (w >= h) { x += thickness; w -= thickness; } else { y += thickness; h -= thickness; }
        if (w < 0.5 || h < 0.5) break;
    }

    return out;
}

/**
 * A colour scale that survives one runaway sector.
 *
 * Scaling to the largest move flattens everything else: with Refinery at +24%,
 * a sector down 3% comes out almost white and the map reads as empty. So the
 * scale is set by the spread of the middle of the distribution and the outliers
 * simply saturate - they are already the most obvious tiles on screen.
 */
export function scaleFor(values, percentile = 0.85) {
    const magnitudes = values.filter((v) => v != null).map(Math.abs).sort((a, b) => a - b);
    if (!magnitudes.length) return 1;
    const at = magnitudes[Math.min(magnitudes.length - 1, Math.floor(magnitudes.length * percentile))];
    return Math.max(at, 0.5);
}

/**
 * Where a value sits on a red-to-green scale, as 0..1.
 *
 * Eased rather than linear, so a small move is still visibly coloured. Without
 * it every ordinary day is a grey map and only the extremes carry information.
 */
export function colorStop(value, max) {
    if (!max) return 0.5;
    const t = Math.max(-1, Math.min(1, value / max));
    const eased = Math.sign(t) * Math.sqrt(Math.abs(t));
    return 0.5 + eased / 2;
}

/**
 * A label cut to fit, from the end.
 *
 * Clipping a centred label eats both ends, so "INV. BANKS / INV. COS. /
 * SECURITIES COS." lost the word that identified it. An ellipsis keeps the
 * front, which is the part that names the sector.
 *
 * Character width is estimated rather than measured - SVG cannot measure before
 * it paints. These labels are uppercase and semibold, which is wider than the
 * usual rule of thumb: 0.56em left "TECHNOLOGY & COMMUNICATION" overflowing and
 * clipped back to "ECHNOLOGY & COMM". Erring wide costs a character; erring
 * narrow costs the first word.
 */
export function fitLabel(text, pixels, fontSize) {
    const perChar = fontSize * 0.68;
    const fits = Math.floor(pixels / perChar);
    if (fits >= text.length) return text;
    if (fits < 4) return null;
    return text.slice(0, fits - 1).trimEnd() + '\u2026';
}

/**
 * A layout that keeps the order it is given.
 *
 * Squarified packing sorts by weight, so the biggest tile leads whatever it did
 * - Commercial Banks led a performance board while down 1.5%, and inside the
 * gainers Refinery at +23.8% sat below Oil & Gas at +4.8% because its
 * capitalisation is smaller. Reordering the queue does not help: squarified
 * packing depends on descending weight, and a heavy tile arriving late gets
 * crushed into whatever strip is left.
 *
 * A strip layout is the one that does both. Items are laid in the order given,
 * left to right and top to bottom the way text is read, and only the height of
 * each row is chosen - to keep the tiles in it as square as they can be. So the
 * order is performance and the area is still capitalisation.
 *
 * Bederson, Shneiderman and Wattenberg, "Ordered and Quantum Treemaps" (2002).
 */
function averageRatio(row, rowWidth, scale) {
    const area = row.reduce((a, i) => a + i.weight, 0) * scale;
    if (!area) return Infinity;
    const height = area / rowWidth;
    const ratios = row.map((i) => {
        const w = (i.weight * scale) / height;
        return Math.max(w / height, height / w);
    });
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

export function stripLayout(items, width, height) {
    const usable = items.filter((i) => i.weight > 0);
    if (!usable.length || width <= 0 || height <= 0) return [];

    const total = usable.reduce((a, i) => a + i.weight, 0);
    const scale = (width * height) / total;

    const out = [];
    let y = 0;
    let i = 0;
    while (i < usable.length) {
        const row = [usable[i]];
        let j = i + 1;
        // Take the next item while it makes the row's tiles rounder on average.
        while (j < usable.length
            && averageRatio([...row, usable[j]], width, scale) <= averageRatio(row, width, scale)) {
            row.push(usable[j]);
            j++;
        }

        const rowHeight = (row.reduce((a, r) => a + r.weight, 0) * scale) / width;
        let x = 0;
        for (const item of row) {
            const w = (item.weight * scale) / rowHeight;
            out.push({ key: item.key, x, y, width: w, height: rowHeight });
            x += w;
        }
        y += rowHeight;
        i = j;
    }

    return out;
}

/**
 * Market cap, flattened enough to draw.
 *
 * Weighting by capitalisation is right - the sectors holding the money are the
 * ones that move the index - but raw cap is unusable as area: Commercial Banks
 * alone is 26% of PSX and the largest sector is eight thousand times the
 * smallest, which leaves most of the board as unreadable crumbs.
 *
 * Raising to a power below one keeps the order and the sense of weight while
 * pulling the extremes in. At 0.6 the banks fall from 26% of the map to 14% -
 * still plainly the biggest tile, no longer the only one.
 */
const FLATTEN = 0.6;

export function tileWeight(marketCap) {
    return marketCap > 0 ? Math.pow(marketCap, FLATTEN) : 0;
}

/**
 * A floor under the smallest tiles, so none of them reads as a rendering fault.
 *
 * Weighting by capitalisation is right, but taken literally it draws Woollen as
 * a five-pixel line and Modarabas - second best on the board that month - as a
 * sliver beside Refinery. A tile nobody can see or click is not information
 * about a small sector, it is a scratch on the screen.
 *
 * Every tile is given at least `minShare` of the area. Raising the small ones
 * raises the total, so the guarantee is approximate and the large tiles give up
 * a couple of percent between them - which is invisible, where the sliver was
 * not. Order and relative size are untouched.
 */
export function withFloor(items, minShare = 0.011) {
    const total = items.reduce((a, i) => a + i.weight, 0);
    // No capitalisation anywhere is not a reason to draw nothing: without a
    // basis for relative area, equal area is the honest answer.
    if (!total) return items.map((i) => ({ ...i, weight: 1 }));
    const floor = total * minShare;
    return items.map((i) => (i.weight < floor ? { ...i, weight: floor } : i));
}

export default { squarify, stripLayout, colorStop, scaleFor, fitLabel, tileWeight, withFloor };
