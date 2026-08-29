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

export default { squarify, colorStop, scaleFor, fitLabel };
