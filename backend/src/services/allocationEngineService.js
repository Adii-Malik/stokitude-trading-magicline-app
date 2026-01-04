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
        const lumpSum = sipPlan.lumpSums
            .filter(ls => ls.date.toISOString().slice(0, 7) === forMonth)
            .reduce((sum, ls) => sum + ls.amount, 0);

        const totalBudget = monthlyAmount + lumpSum;

        if (totalBudget <= 0) {
            throw new Error('No budget available for this month');
        }

        // Get eligible stocks
        const universe = await this._getUniverse(policy, portfolioId);

        // Score stocks
        const scored = await this._scoreStocks(universe, policy);

        // Get current holdings
        const holdings = await portfolioService.getHoldings(portfolioId);
        const dashboard = await portfolioService.getDashboard(portfolioId);
        const totalValue = dashboard.totalValue;

        // Calculate target weights
        const targets = this._calculateTargetWeights(scored, policy);

        // Allocate budget
        const allocations = this._allocateBudget({
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
    }

    /**
     * Get eligible stock universe based on policy
     */
    async _getUniverse(policy, portfolioId) {
        let query = { isActive: true };

        // Apply filters
        if (policy.filters.shariahOnly) {
            query['$and'] = [{ 'shariahCompliant': true }];
        }

        if (policy.filters.excludeSymbols?.length) {
            query.symbol = { $nin: policy.filters.excludeSymbols };
        }

        if (policy.filters.sectors?.length) {
            query.sector = { $in: policy.filters.sectors };
        }

        // Get stocks based on universe mode
        let symbols;

        if (policy.universeMode === 'MANUAL_LIST') {
            symbols = policy.allowedSymbols;
        } else if (policy.universeMode === 'ALL_ACTIVE_HOLDINGS') {
            const holdings = await portfolioService.getHoldings(portfolioId);
            symbols = holdings.map(h => h.symbol);
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
    }

    /**
     * Score stocks based on policy weights
     */
    async _scoreStocks(universe, policy) {
        const weights = policy.scoringWeights;
        const filters = policy.filters;

        const scored = universe.map(fund => {
            // StockFundamental model stores flat data, so create virtual nested objects
            const dividendMetrics = {
                dividendTTM: fund.dividendTTM,
                dividendYield: fund.dividendYield,
                payoutRatio: fund.payoutRatio,
                dividendGrowth3Y: fund.dividendGrowth3Y,
                dividendConsistencyYears: fund.dividendConsistencyYears
            };

            const growthMetrics = {
                epsGrowthYoY: fund.epsGrowthYoY,
                revenueGrowth3Y: fund.revenueGrowth3Y
            };

            const financialHealth = {
                debtToEquity: fund.debtToEquity,
                currentRatio: fund.currentRatio,
                roe: fund.roe
            };

            // Skip if missing critical dividend data
            if (!dividendMetrics.dividendYield && !dividendMetrics.dividendTTM) {
                console.log(`   ⚠ ${fund.symbol}: Missing dividend data, skipping`);
                return null;
            }

            // Apply hard filters
            if (filters.minDividendYield && dividendMetrics.dividendYield < filters.minDividendYield) {
                console.log(`   ⚠ ${fund.symbol}: Yield ${dividendMetrics.dividendYield.toFixed(1)}% below min ${filters.minDividendYield}%, filtered out`);
                return null;
            }

            if (filters.maxPayoutRatio && dividendMetrics.payoutRatio > filters.maxPayoutRatio) {
                console.log(`   ⚠ ${fund.symbol}: Payout ${dividendMetrics.payoutRatio}% above max ${filters.maxPayoutRatio}%, filtered out`);
                return null;
            }

            // Calculate component scores (0-100)
            const dividendYieldScore = this._scoreDividendYield(dividendMetrics);
            const payoutSafetyScore = this._scorePayoutSafety(dividendMetrics);
            const growthScore = this._scoreGrowth(growthMetrics);
            const qualityScore = this._scoreQuality(financialHealth);

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

        console.log(`\n📊 Scored ${scored.length} stocks (filtered ${universe.length - scored.length})`);

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
    _allocateBudget({ targets, holdings, totalValue, budget, policy, sipPlan }) {
        const futureValue = totalValue + budget;

        // Calculate current weights
        const holdingsMap = new Map(
            holdings.map(h => [h.symbol, {
                value: h.totalValue,
                weight: (h.totalValue / totalValue) * 100,
                shares: h.quantity
            }])
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

        for (const alloc of allocations) {
            if (remainingBudget <= 0) break;
            if (alloc.gap <= 0) continue; // Skip overweight

            const allocation = Math.min(alloc.gap, remainingBudget);

            if (allocation < policy.rebalance.minTradeAmount) {
                continue; // Skip tiny allocations
            }

            // Get current price
            const stock = holdings.find(h => h.symbol === alloc.symbol);
            const estPrice = stock?.currentPrice || alloc.currentValue / (holdingsMap.get(alloc.symbol)?.shares || 1);

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
