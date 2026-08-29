import { useMemo } from 'react';
import { stripLayout, colorStop, scaleFor, fitLabel, tileWeight, withFloor } from './treemapLayout';

const WIDTH = 1000;
const HEIGHT = 460;

/** Red through neutral to green, mixed in RGB so the middle stays readable. */
function shade(stop, dark) {
    const neutral = dark ? [55, 65, 81] : [229, 231, 235];
    const down = [225, 29, 72];
    const up = [16, 155, 90];
    const [from, to, t] = stop < 0.5 ? [down, neutral, stop * 2] : [neutral, up, (stop - 0.5) * 2];
    const c = from.map((v, i) => Math.round(v + (to[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** White reads on a strong colour; near the neutral middle it does not. */
const ink = (stop, dark) => (Math.abs(stop - 0.5) > 0.22 ? '#fff' : dark ? '#e5e7eb' : '#111827');

/**
 * One treemap for both levels.
 *
 * Sectors on the board, stocks inside a sector - the same picture either way,
 * because the question is the same one: what is big, and what is moving. Items
 * arrive already reduced to { key, label, value, weight, note }.
 */
export default function Treemap({ items, dark, onSelect, height = HEIGHT }) {
    const tiles = useMemo(() => {
        /**
         * Best first, then read like text.
         *
         * Area is capitalisation and order is performance - the two used to
         * fight, because a squarified map orders by size and put the heaviest
         * sector first whatever it did. A strip layout keeps the order it is
         * given, so the best performer leads and the worst trails, while the
         * tiles still say which sectors carry the money.
         */
        const weighted = withFloor(items
            .map((i) => ({ ...i, weight: tileWeight(i.weight) }))
            .filter((i) => i.weight > 0)
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)));
        return stripLayout(weighted, WIDTH, height)
            .map((t) => ({ ...t, item: weighted.find((i) => i.key === t.key) }));
    }, [items, height]);

    const max = scaleFor(items.map((i) => i.value));

    return (
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full h-auto" role="img"
            aria-label="Treemap: area by size, colour by performance">
            {tiles.map((t) => {
                const value = t.item.value ?? 0;
                const stop = colorStop(value, max);
                const fill = shade(stop, dark);
                const text = ink(stop, dark);
                /**
                 * Three shapes, three treatments.
                 *
                 * A tall tile stacks its name over its number. A wide flat one -
                 * the last row of a strip layout is usually flat - has no room
                 * for two lines but plenty for one, and dropping to a bare "-4%"
                 * there loses the name off the widest tiles on the board. A
                 * narrow one gets the number alone, because a tile wide enough
                 * to click is wide enough to say something.
                 */
                const roomy = t.width > 74 && t.height > 34;
                const flat = !roomy && t.width > 110 && t.height > 15;
                const tight = !roomy && !flat && t.width > 33 && t.height > 18;
                const clip = `c-${t.key.replace(/[^a-zA-Z0-9]/g, '')}`;
                const label = roomy ? fitLabel(t.item.label, t.width - 10, 11.5) : null;
                const oneLine = flat
                    ? fitLabel(`${t.item.label}  ${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, t.width - 10, 11)
                    : null;
                return (
                    <g key={t.key} onClick={() => onSelect?.(t.item)}
                        style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                        <title>{t.item.note}</title>
                        {/* Clipped as a backstop. The label is cut to fit first,
                            because clipping a centred label eats its front. */}
                        <clipPath id={clip}>
                            <rect x={t.x + 3} y={t.y} width={Math.max(0, t.width - 6)} height={t.height} />
                        </clipPath>
                        <rect x={t.x} y={t.y} width={t.width} height={t.height}
                            fill={fill} stroke={dark ? '#111827' : '#fff'} strokeWidth="1.5" />
                        <g clipPath={`url(#${clip})`}>
                            {label && (
                                <>
                                    <text x={t.x + t.width / 2} y={t.y + t.height / 2 - 5} fill={text}
                                        textAnchor="middle" fontSize="11.5" fontWeight="600">{label}</text>
                                    <text x={t.x + t.width / 2} y={t.y + t.height / 2 + 12} fill={text}
                                        textAnchor="middle" fontSize="13" fontWeight="700">
                                        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
                                    </text>
                                </>
                            )}
                            {oneLine && (
                                <text x={t.x + t.width / 2} y={t.y + t.height / 2 + 4} fill={text}
                                    textAnchor="middle" fontSize="11" fontWeight="600">{oneLine}</text>
                            )}
                            {tight && (
                                <text x={t.x + t.width / 2} y={t.y + t.height / 2 + 4} fill={text}
                                    textAnchor="middle" fontSize="10.5" fontWeight="700">
                                    {value >= 0 ? '+' : ''}{value.toFixed(0)}%
                                </text>
                            )}
                        </g>
                    </g>
                );
            })}
        </svg>
    );
}
