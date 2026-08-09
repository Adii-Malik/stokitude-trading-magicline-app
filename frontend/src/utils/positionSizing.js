/**
 * Position sizing.
 * Size follows from the stop, never from a feeling about the stock.
 */

/**
 * @param {object} input
 * @param {number} input.capital - Account capital
 * @param {number} input.riskPct - Percent of capital risked on this trade
 * @param {number} input.entryPrice
 * @param {number} input.stopPrice
 * @param {number} [input.targetPrice]
 * @param {number} [input.maxPositionPct] - Ceiling on one position's share of capital
 * @param {boolean} [input.fractionalShares] - Whether the venue allows part shares
 */
export function sizePosition({
    capital, riskPct, entryPrice, stopPrice, targetPrice,
    maxPositionPct = 100, fractionalShares = false
}) {
    const nums = [capital, riskPct, entryPrice, stopPrice].map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;

    const riskPerShare = Math.abs(entryPrice - stopPrice);
    if (riskPerShare === 0) return { error: 'Stop cannot equal the entry price' };

    const riskBudget = capital * (riskPct / 100);
    const round = (n) => (fractionalShares ? Math.floor(n * 100) / 100 : Math.floor(n));

    let shares = round(riskBudget / riskPerShare);
    const byRisk = shares;

    // A wide stop can size small yet still concentrate the account; cap it.
    const maxValue = capital * (maxPositionPct / 100);
    let cappedBy = null;
    if (shares * entryPrice > maxValue) {
        shares = round(maxValue / entryPrice);
        cappedBy = 'position limit';
    }

    if (shares <= 0) {
        return {
            error: 'Risk budget is too small for even one share at this stop distance',
            riskPerShare, riskBudget
        };
    }

    const positionValue = shares * entryPrice;
    const actualRisk = shares * riskPerShare;
    const reward = targetPrice ? Math.abs(targetPrice - entryPrice) * shares : null;

    return {
        shares,
        byRisk,
        cappedBy,
        riskPerShare,
        riskBudget,
        actualRisk,
        actualRiskPct: (actualRisk / capital) * 100,
        positionValue,
        positionPct: (positionValue / capital) * 100,
        reward,
        rr: reward != null && actualRisk > 0 ? reward / actualRisk : null
    };
}
