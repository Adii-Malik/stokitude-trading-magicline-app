/**
 * Allocation Engine Service
 * Scores stocks, calculates target weights, generates SIP recommendations
 */
import PortfolioPolicy from '../models/PortfolioPolicy.js';
import SIPPlan from '../models/SIPPlan.js';
import Recommendation from '../models/Recommendation.js';
import Stock from '../models/Stock.js';
import StockFundamental from '../models/StockFundamental.js';
import portfolioService from './portfolioService.js';

class AllocationEngineService {

    /**
     * Generate monthly SIP allocation recommendation
     */
    async generateRecommendation(portfolioId, forMonth, options = {}) {
        try {
            const policy = await PortfolioPolicy.findOne({ portfolioId, isActive: true });
            if (!policy) {
                throw new Error('No active policy found for portfolio');
            }

            const sipPlan = await SIPPlan.findOne({ portfolioId, isActive: true });
            if (!sipPlan) {
                throw new Error('No active SIP plan found for portfolio');
            }

            // Calculate available budget
            const monthlyAmount = sipPlan.monthlyAmount;
            const lumpSum = (sipPlan.lumpSums || [])
                .filter(ls => {
                    if (!ls.date) return false;
                    const lsDate = ls.date instanceof Date ? ls.date : new Date(ls.date);
                    return lsDate.toISOString().slice(0, 7) === forMonth;
                })
                .reduce((sum, ls) => sum + ls.amount, 0);

            const totalBudget = monthlyAmount + lumpSum;

            if (totalBudget <= 0) {
                throw new Error('No budget available for this month');
            }

            // Get eligible stocks
            const universe = await this._getUniverse(policy, portfolioId, options.userId);

            // Score stocks
            const scored = await this._scoreStocks(universe, policy);

            // Get current holdings
            const holdings = await portfolioService.getHoldings(portfolioId, options.userId);
            const dashboard = await portfolioService.getDashboard(portfolioId, options.userId);

            // Calculate total value from holdings if dashboard is broken
            let totalValue = dashboard.totalValue || 0;
            if (totalValue === 0 && holdings.length > 0) {
                totalValue = holdings.reduce((sum, h) => sum + (h.totalValue || 0), 0);
            }

            // Calculate target weights
            const targets = this._calculateTargetWeights(scored, policy);

            // Allocate budget
            const allocations = await this._allocateBudget({
                targets,
                holdings,
                totalValue,
                budget: totalBudget,
                policy,
                sipPlan
            });

            // Create or update recommendation
            const recommendation = await Recommendation.findOneAndUpdate(
                { portfolioId, forMonth },
                {
                    portfolioId,
                    forMonth,
                    budget: totalBudget,
                    allocations,
                    status: options.autoApprove ? 'APPROVED' : 'DRAFT',
                    approvedBy: options.autoApprove ? options.userId : undefined,
                    approvedAt: options.autoApprove ? new Date() : undefined
                },
                { upsert: true, new: true }
            );

            return recommendation;
        } catch (error) {
            console.error('Error in generateRecommendation:', error);
            console.error('Stack:', error.stack);
            throw error;
        }
    }

    /**
     * Get eligible stock universe based on policy
     */
    async _getUniverse(policy, portfolioId, userId) {
        try {
            let query = { currentPrice: { $ne: null } }; // Active stocks with price data

            // Apply filters (if policy has filters object)
            if (policy.filters) {
                if (policy.filters.shariahOnly) {
                    query.shariahCompliant = 'Yes';
                }

                if (policy.filters.excludeSymbols?.length) {
                    query.symbol = { $nin: policy.filters.excludeSymbols };
                }

                if (policy.filters.sectors?.length) {
                    query.sector = { $in: policy.filters.sectors };
                }
            }

            // Get stocks based on universe mode
            let symbols;

            if (policy.universeMode === 'MANUAL_LIST') {
                symbols = policy.allowedSymbols || [];
            } else if (policy.universeMode === 'ALL_ACTIVE_HOLDINGS') {
                const holdings = await portfolioService.getHoldings(portfolioId, userId);
                symbols = Array.isArray(holdings) ? holdings.map(h => h?.symbol).filter(Boolean) : [];
            } else {
                // ALL or WATCHLIST - query all matching stocks
                const stocks = await Stock.find(query).select('symbol').lean();
                symbols = stocks.map(s => s.symbol);
            }

            if (!symbols || symbols.length === 0) {
                throw new Error('No eligible stocks in universe');
            }

            // Get fundamentals for eligible stocks
            const fundamentals = await StockFundamental.find({
                symbol: { $in: symbols }
            }).lean();

            return fundamentals;
        } catch (error) {
            console.error('Error in _getUniverse:', error);
            throw error;
        }
    }

    /**
     * Score stocks based on policy weights
     */
    async _scoreStocks(universe, policy) {
        const weights = policy.scoringWeights;
        const filters = policy.filters;

        const scored = universe.map(fund => {
            const m = fund.metrics || {}; // Access metrics object

            // Skip if missing critical dividend data
            if (!m.dividendYield && !m.dividendTTM) {
                return null;
            }

            // Apply hard filters
            if (filters.minDividendYield && m.dividendYield < filters.minDividendYield) {
                return null;
            }

            if (filters.maxPayoutRatio && m.payoutRatio > filters.maxPayoutRatio) {
                return null;
            }

            // Calculate component scores (0-100)
            const dividendYieldScore = this._scoreDividendYield(m);
            const payoutSafetyScore = this._scorePayoutSafety(m);
            const growthScore = this._scoreGrowth(m);
            const qualityScore = this._scoreQuality(m);

            // Weighted composite score
            const compositeScore =
                (dividendYieldScore * weights.dividendYield) +
                (payoutSafetyScore * weights.payoutSafety) +
                (growthScore * weights.growth) +
                (qualityScore * weights.quality);

            console.log(`   ✓ ${fund.symbol}: Score ${compositeScore.toFixed(1)} (Div:${dividendYieldScore.toFixed(0)} Safe:${payoutSafetyScore.toFixed(0)} Grow:${growthScore.toFixed(0)} Qual:${qualityScore.toFixed(0)})`);

            return {
                symbol: fund.symbol,
                score: compositeScore,
                components: {
                    dividendYield: dividendYieldScore,
                    payoutSafety: payoutSafetyScore,
                    growth: growthScore,
                    quality: qualityScore
                },
                fundamentals: fund
            };
        }).filter(Boolean); // Remove nulls

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        return scored;
    }

    /**
     * Score dividend yield (0-100)
     */
    _scoreDividendYield(metrics) {
        const yield_ = metrics.dividendYield || 0;

        // Normalize: 0% = 0, 10%+ = 100
        return Math.min(100, (yield_ / 10) * 100);
    }

    /**
     * Score payout safety (0-100)
     */
    _scorePayoutSafety(metrics) {
        const ratio = metrics.payoutRatio || 100;
        const consistency = metrics.dividendConsistencyYears || 0;

        // Ideal payout: 40-60% = 100, >90% = 0
        let ratioScore;
        if (ratio >= 40 && ratio <= 60) {
            ratioScore = 100;
        } else if (ratio < 40) {
            ratioScore = 70 + (ratio / 40) * 30;
        } else if (ratio > 90) {
            ratioScore = 0;
        } else {
            ratioScore = 100 - ((ratio - 60) / 30) * 100;
        }

        // Consistency: 5+ years = 100
        const consistencyScore = Math.min(100, (consistency / 5) * 100);

        // Weighted average
        return (ratioScore * 0.7) + (consistencyScore * 0.3);
    }

    /**
     * Score growth (0-100)
     */
    _scoreGrowth(metrics) {
        if (!metrics) return 50; // Neutral if no data

        const epsGrowth = metrics.epsGrowth3Y || 0;
        const revenueGrowth = metrics.revenueGrowth3Y || 0;

        // Normalize: 15%+ growth = 100, 0% = 50, negative = lower
        const epsScore = 50 + Math.min(50, (epsGrowth / 15) * 50);
        const revScore = 50 + Math.min(50, (revenueGrowth / 15) * 50);

        return (epsScore * 0.6) + (revScore * 0.4);
    }

    /**
     * Score quality (0-100)
     */
    _scoreQuality(health) {
        if (!health) return 50;

        const roe = health.roe || 0;
        const debtToEquity = health.debtToEquity || 0;

        // ROE: 15%+ = 100
        const roeScore = Math.min(100, (roe / 15) * 100);

        // Debt/Equity: 0 = 100, 1+ = 0
        const debtScore = Math.max(0, 100 - (debtToEquity * 100));

        return (roeScore * 0.6) + (debtScore * 0.4);
    }

    /**
     * Calculate target weights for top stocks
     */
    _calculateTargetWeights(scoredStocks, policy) {
        const { minHoldings, maxHoldings, maxPositionPct } = policy.constraints;

        // Take top N stocks
        const topN = Math.min(scoredStocks.length, maxHoldings);
        const topStocks = scoredStocks.slice(0, topN);

        if (topStocks.length < minHoldings) {
            throw new Error(`Not enough eligible stocks (need ${minHoldings}, found ${topStocks.length})`);
        }

        // Equal weight baseline
        const baseWeight = 100 / topStocks.length;

        // Tilt toward higher scores
        const totalScore = topStocks.reduce((sum, s) => sum + s.score, 0);

        const targets = topStocks.map(stock => {
            // Score-weighted allocation
            const scoreWeight = (stock.score / totalScore) * 100;

            // Blend: 50% equal weight, 50% score weight
            let targetWeight = (baseWeight * 0.5) + (scoreWeight * 0.5);

            // Cap at max position
            targetWeight = Math.min(targetWeight, maxPositionPct);

            return {
                symbol: stock.symbol,
                targetWeight,
                score: stock.score,
                components: stock.components
            };
        });

        // Normalize to 100%
        const totalWeight = targets.reduce((sum, t) => sum + t.targetWeight, 0);
        targets.forEach(t => {
            t.targetWeight = (t.targetWeight / totalWeight) * 100;
        });

        return targets;
    }

    /**
     * Allocate budget to stocks based on target weights
     */
    async _allocateBudget({ targets, holdings, totalValue, budget, policy, sipPlan }) {
        const futureValue = totalValue + budget;

        // Calculate current weights
        const holdingsMap = new Map(
            holdings.map(h => {
                const weight = totalValue > 0 ? (h.totalValue / totalValue) * 100 : 0;
                return [h.symbol, {
                    value: h.totalValue,
                    weight: weight,
                    shares: h.quantity,
                    currentPrice: h.currentPrice
                }];
            })
        );

        // Calculate gaps
        const allocations = targets.map(target => {
            const currentHolding = holdingsMap.get(target.symbol) || { value: 0, weight: 0, shares: 0 };
            const targetValue = (target.targetWeight / 100) * futureValue;
            const gap = targetValue - currentHolding.value;

            return {
                symbol: target.symbol,
                targetWeight: target.targetWeight,
                currentWeight: currentHolding.weight,
                gap,
                currentValue: currentHolding.value,
                targetValue,
                score: target.score,
                components: target.components
            };
        });

        // Sort by gap descending (prioritize underweight)
        allocations.sort((a, b) => b.gap - a.gap);

        // Allocate budget
        let remainingBudget = budget;
        const finalAllocations = [];

        // For SIP, use lower minimum when budget is limited
        // Allow allocations as low as 10% of budget or min trade amount, whichever is lower
        const budgetBasedMin = budget * 0.10; // 10% of total budget
        const sipFlexibleMin = Math.min(
            policy.rebalance.minTradeAmount,
            budgetBasedMin
        );

        for (const alloc of allocations) {
            if (remainingBudget <= 0) break;
            if (alloc.gap <= 0) continue; // Skip overweight

            const allocation = Math.min(alloc.gap, remainingBudget);

            if (allocation < sipFlexibleMin) continue; // Skip tiny allocations

            // Get current price - check holdings first, then fetch from Stock model
            let estPrice;
            const holding = holdingsMap.get(alloc.symbol);
            if (holding && holding.currentPrice) {
                estPrice = holding.currentPrice;
            } else {
                // Fetch from Stock model for new stocks
                const stock = await Stock.findOne({ symbol: alloc.symbol }).select('currentPrice');
                estPrice = stock?.currentPrice;
            }

            if (!estPrice) continue; // Skip if no price data

            let estShares = allocation / estPrice;

            // Apply rounding
            if (sipPlan.rounding.type === 'LOT') {
                const lotSize = sipPlan.rounding.lotSize;
                estShares = Math.floor(estShares / lotSize) * lotSize;
            } else if (sipPlan.rounding.type === 'SHARES') {
                estShares = Math.round(estShares);
            }

            const actualAmount = estShares * estPrice;

            if (estShares > 0) {
                finalAllocations.push({
                    symbol: alloc.symbol,
                    amount: actualAmount,
                    estShares,
                    estPrice,
                    targetWeight: alloc.targetWeight,
                    currentWeight: alloc.currentWeight,
                    gap: alloc.gap,
                    reasoning: {
                        score: alloc.score,
                        dividendYield: alloc.components.dividendYield,
                        payoutSafety: alloc.components.payoutSafety,
                        growth: alloc.components.growth,
                        quality: alloc.components.quality
                    }
                });

                remainingBudget -= actualAmount;
            }
        }

        return finalAllocations;
    }

    /**
     * Check if portfolio has drifted from targets
     */
    async checkDrift(portfolioId) {
        const policy = await PortfolioPolicy.findOne({ portfolioId, isActive: true });
        if (!policy) return null;

        const holdings = await portfolioService.getHoldings(portfolioId);
        const dashboard = await portfolioService.getDashboard(portfolioId);
        const totalValue = dashboard.totalValue;

        // Get universe and score
        const universe = await this._getUniverse(policy, portfolioId);
        const scored = await this._scoreStocks(universe, policy);
        const targets = this._calculateTargetWeights(scored, policy);

        const driftThreshold = policy.rebalance.driftThresholdPct;

        const drifts = [];

        for (const target of targets) {
            const holding = holdings.find(h => h.symbol === target.symbol);
            const currentWeight = holding ? (holding.totalValue / totalValue) * 100 : 0;
            const drift = Math.abs(currentWeight - target.targetWeight);

            if (drift >= driftThreshold) {
                drifts.push({
                    symbol: target.symbol,
                    targetWeight: target.targetWeight,
                    currentWeight,
                    drift,
                    action: currentWeight > target.targetWeight ? 'REDUCE' : 'INCREASE'
                });
            }
        }

        return {
            hasDrift: drifts.length > 0,
            drifts,
            checkedAt: new Date()
        };
    }
}

export default new AllocationEngineService();
