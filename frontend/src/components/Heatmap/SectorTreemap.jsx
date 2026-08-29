import { useMemo } from 'react';
import { squarify, colorStop, scaleFor, fitLabel } from './treemap';

const WIDTH = 1000;
const HEIGHT = 480;

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
 * A treemap whose tiles are sectors, not companies.
 *
 * That is the whole point of building it. The borrowed widget draws one tile per
 * company sized by market cap, so a sector is only as visible as its largest
 * member - Modarabas has nineteen companies and no market cap between them, and
 * disappears. Here every sector gets area, so every sector can be read.
 */
export default function SectorTreemap({ sectors, period, sizeBy, dark, onSelect }) {
    const tiles = useMemo(() => {
        const items = sectors
            .map((s) => ({
                key: s.sector,
                weight: sizeBy === 'count' ? s.count : (s.marketCap || 0),
                sector: s
            }))
            .filter((i) => i.weight > 0);
        const laid = squarify(items, WIDTH, HEIGHT);
        return laid.map((t) => ({ ...t, sector: items.find((i) => i.key === t.key).sector }));
    }, [sectors, sizeBy]);

    const max = scaleFor(sectors.map((s) => s.periods[period]?.median));

    return (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img"
            aria-label="Sector performance treemap, tile area by sector size and colour by performance">
            {tiles.map((t) => {
                const stat = t.sector.periods[period];
                const value = stat?.median ?? 0;
                const stop = colorStop(value, max);
                const fill = shade(stop, dark);
                const text = ink(stop, dark);
                // Below this a label is unreadable, so the tile carries only its
                // colour and its tooltip rather than clipped nonsense.
                const roomy = t.width > 78 && t.height > 36;
                const tight = t.width > 40 && t.height > 18;
                const clip = `clip-${t.key.replace(/[^a-zA-Z0-9]/g, '')}`;
                return (
                    <g key={t.key} onClick={() => onSelect?.(t.key)} style={{ cursor: 'pointer' }}>
                        <title>{`${t.key} — ${value >= 0 ? '+' : ''}${value.toFixed(1)}% · ${t.sector.count} companies · ${stat?.up ?? 0} up`}</title>
                        {/* Clipped to its own tile. Estimating how many characters
                            fit from the width was wrong often enough to push labels
                            over their neighbours. */}
                        <clipPath id={clip}>
                            <rect x={t.x + 3} y={t.y} width={Math.max(0, t.width - 6)} height={t.height} />
                        </clipPath>
                        <rect x={t.x} y={t.y} width={t.width} height={t.height}
                            fill={fill} stroke={dark ? '#111827' : '#fff'} strokeWidth="1.5" />
                        <g clipPath={`url(#${clip})`}>
                            {roomy && (
                                <>
                                    <text x={t.x + t.width / 2} y={t.y + t.height / 2 - 5} fill={text}
                                        textAnchor="middle" fontSize="11.5" fontWeight="600">
                                        {fitLabel(t.key, t.width - 10, 11.5)}
                                    </text>
                                    <text x={t.x + t.width / 2} y={t.y + t.height / 2 + 12} fill={text}
                                        textAnchor="middle" fontSize="13" fontWeight="700">
                                        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
                                    </text>
                                </>
                            )}
                            {!roomy && tight && (
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
