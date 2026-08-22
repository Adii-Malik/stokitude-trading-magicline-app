/**
 * What a trade risks, judged against what you said you would risk.
 *
 * With entry, stop and size all known there is nothing left to compute - the
 * numbers are given. What is missing is a yardstick: "risk 4,000" means nothing
 * without knowing the account it sits against. This supplies that, and only that.
 * It never blocks and never rewrites a trade; a journal that refuses to record a
 * rule you broke just means the honest entry never gets written.
 *
 * Capital is the portfolio's total value, not its cash. Sizing against cash alone
 * would call a trade too large purely because the money is already invested.
 */
import Portfolio from '../models/Portfolio.js';
import RiskProfile from '../models/RiskProfile.js';
import portfolioService from './portfolioService.js';

/**
 * What the named portfolio is worth: the capital this trade is a percentage of.
 *
 * One portfolio, never a sum across a currency. A book held for investing is not
 * trading capital, and adding it in would quietly make every trade look smaller
 * and safer than it is. A trade names the book it belongs to; that book is the
 * denominator, and one that is never traded never contributes.
 */
export async function capitalFor(userId, portfolioId) {
    if (!portfolioId) return null;

    const portfolios = await Portfolio.find({ _id: portfolioId }).select('_id currency').lean();
    if (!portfolios.length) return null;

    let total = 0;
    for (const p of portfolios) {
        const [cash, held] = await Promise.all([
            portfolioService.getCashBalance(p._id),
            portfolioService.getHoldings(p._id, userId, { authorized: true })
        ]);
        const holdings = held?.holdings || held || [];
        total += (cash?.balance || 0)
            + holdings.reduce((sum, h) => sum + (h.totalValue || 0), 0);
    }
    return Math.round(total * 100) / 100;
}

/**
 * The verdict. Every field is null rather than zero when it cannot be known, so
 * the UI can leave a line out instead of printing a number that means "unset".
 */
export function judge({ capital, riskPct, maxPositionPct, entryPrice, stopPrice, quantity, targetPrice, direction = 'long' }) {
    const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
    const [cap, entry, stop, qty] = [n(capital), n(entryPrice), n(stopPrice), n(quantity)];

    const perShare = entry != null && stop != null ? Math.abs(entry - stop) : null;
    const risk = perShare != null && qty != null ? perShare * qty : null;
    const position = entry != null && qty != null ? entry * qty : null;

    // A target is optional and never assumed. A trailing stop has no fixed target,
    // and inventing one would put fiction into every reward:risk figure.
    const target = n(targetPrice);
    const reward = target != null && entry != null && qty != null
        ? Math.abs(target - entry) * qty
        : null;

    const pct = (part) => (cap != null && part != null ? (part / cap) * 100 : null);
    const riskPctOfCapital = pct(risk);
    const positionPctOfCapital = pct(position);

    // A stop on the wrong side is not a small problem to flag in percentages.
    const stopBackwards = entry != null && stop != null &&
        (direction === 'short' ? stop < entry : stop > entry);

    return {
        capital: cap,
        riskPerShare: perShare,
        risk,
        riskPctOfCapital,
        position,
        positionPctOfCapital,
        rr: reward != null && risk > 0 ? reward / risk : null,
        limits: {
            riskPct: n(riskPct),
            maxPositionPct: n(maxPositionPct)
        },
        breaches: {
            risk: riskPctOfCapital != null && n(riskPct) != null && riskPctOfCapital > n(riskPct),
            position: positionPctOfCapital != null && n(maxPositionPct) != null && positionPctOfCapital > n(maxPositionPct),
            stopBackwards
        }
    };
}

/** Size that keeps a trade inside both limits - the one case where it decides. */
export function suggestSize({ capital, riskPct, maxPositionPct, entryPrice, stopPrice, fractionalShares = false }) {
    const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
    const [cap, entry, stop] = [n(capital), n(entryPrice), n(stopPrice)];
    if (cap == null || entry == null || stop == null) return null;

    const perShare = Math.abs(entry - stop);
    if (perShare === 0) return null;

    const round = (v) => (fractionalShares ? Math.floor(v * 100) / 100 : Math.floor(v));
    const byRisk = round((cap * (n(riskPct) ?? 1) / 100) / perShare);
    const byAllocation = round((cap * (n(maxPositionPct) ?? 100) / 100) / entry);

    // Whichever rule allows fewer shares is the one that binds.
    const shares = Math.min(byRisk, byAllocation);
    return shares > 0
        ? { shares, byRisk, byAllocation, cappedBy: byAllocation < byRisk ? 'allocation' : 'risk' }
        : null;
}

export async function contextFor(userId, { portfolioId }) {
    // The limits belong to the book being traded, so both halves of the verdict
    // come from the same place and a second book cannot lend it its rules.
    const [profile, capital] = await Promise.all([
        portfolioId ? RiskProfile.findOne({ user: userId, portfolioId }).lean() : null,
        capitalFor(userId, portfolioId)
    ]);
    return {
        capital,
        riskPct: profile?.defaultRiskPct ?? null,
        maxPositionPct: profile?.maxPositionPct ?? null
    };
}
