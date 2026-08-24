/**
 * Starting points for a book's risk rule.
 *
 * Named rather than numbered, because "2% and 20%" says nothing about what kind
 * of book it is until you already know. Tapping one writes both numbers; there
 * is nothing to assign or keep in step.
 */
export const PRESETS = [
    { name: 'Conservative', risk: 1, cap: 15 },
    { name: 'Balanced', risk: 2, cap: 20 },
    { name: 'Aggressive', risk: 5, cap: 30 }
];

export const BALANCED = PRESETS[1];

/**
 * Which preset a pair of numbers is nearest to, or null if either is missing.
 *
 * Distance across both at once so neither alone decides it, and the cap is
 * scaled down because it moves in much larger steps than the risk does — an
 * untouched cap would otherwise outvote a deliberate change to risk.
 */
export function nearestPreset(risk, cap) {
    const [r, c] = [Number(risk), Number(cap)];
    if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
    return PRESETS.reduce((best, x) => {
        const d = Math.abs(x.risk - r) + Math.abs(x.cap - c) / 5;
        return best && best.d <= d ? best : { ...x, d };
    }, null);
}
