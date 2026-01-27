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
import scoringEngine from '../utils/scoringEngine.js';

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
            // Build query for StockFundamental - get ALL stocks with fundamental data
            let fundQuery = {};

            // Get symbols based on universe mode first
            let allowedSymbols;

            if (policy.universeMode === 'MANUAL_LIST') {
                allowedSymbols = policy.allowedSymbols || [];
            } else if (policy.universeMode === 'ALL_ACTIVE_HOLDINGS') {
                const holdings = await portfolioService.getHoldings(portfolioId, userId);
                allowedSymbols = Array.isArray(holdings) ? holdings.map(h => h?.symbol).filter(Boolean) : [];
            } else {
                // ALL or MARKET mode - get all stocks with fundamentals
                // Apply sector/shariah filters if needed
                if (policy.filters) {
                    if (policy.filters.shariahOnly) {
                        // Only include stocks that are explicitly Shariah compliant
                        // Check both boolean true and string "Yes" for backward compatibility
                        fundQuery['metrics.shariahCompliant'] = { $in: [true, 'Yes'] };
                    }

                    if (policy.filters.excludeSymbols?.length) {
                        fundQuery.symbol = { $nin: policy.filters.excludeSymbols };
                    }

                    if (policy.filters.sectors?.length) {
                        fundQuery['metrics.sector'] = { $in: policy.filters.sectors };
                    }
                }
            }

            // If we have a specific list, filter by symbols
            if (allowedSymbols && allowedSymbols.length > 0) {
                fundQuery.symbol = { $in: allowedSymbols };
            }

            if (allowedSymbols && allowedSymbols.length === 0) {
                throw new Error('No eligible stocks in universe');
            }

            // Get fundamentals - price is NOT required for scoring, only for allocation
            const fundamentals = await StockFundamental.find(fundQuery).lean();

            console.log(`\n📊 Universe: Found ${fundamentals.length} stocks with fundamental data`);

            return fundamentals;
        } catch (error) {
            console.error('Error in _getUniverse:', error);
            throw error;
        }
    }

    /**
     * Score stocks based on policy weights using config-driven scoring engine
     */
    async _scoreStocks(universe, policy) {
        const weights = policy.scoringWeights;
        const filters = policy.filters || {};

        // Map strategy name from weights
        const strategy = this._detectStrategy(weights);

        const scored = universe.map(fund => {
            const m = fund.metrics || {};

            // Apply Shariah filter - check both boolean and string values
            if (filters.shariahOnly) {
                const isShariahCompliant = m.shariahCompliant === true || m.shariahCompliant === 'Yes';
                if (!isShariahCompliant) {
                    return null;
                }
            }

            // Apply hard filters for dividend strategies
            const isDividendFocused = weights.dividendYield >= 0.3;
            if (isDividendFocused) {
                if (!m.dividendYield && !m.dividendTTM) return null;
                if (filters.minDividendYield && m.dividendYield < filters.minDividendYield) return null;
                if (filters.minPayoutRatio && m.payoutRatio < filters.minPayoutRatio) return null;
            }

            // Use scoring engine to calculate scores
            const result = scoringEngine.calculateOverallScore(strategy, m);

            return {
                symbol: fund.symbol,
                score: result.total,
                components: result.breakdown,
                fundamentals: fund
            };
        }).filter(Boolean);

        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    /**
     * Detect strategy from weights (map to config strategies)
     */
    _detectStrategy(weights) {
        // Check if weights match predefined strategies
        if (weights.dividendYield >= 0.25 && weights.payoutSafety >= 0.35) {
            return 'DIVIDEND_GROWTH';
        } else if (weights.growth >= 0.40) {
            return 'GROWTH';
        } else {
            return 'BALANCED';
        }
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
        const minTradeAmount = policy.rebalance?.minTradeAmount || 5000; // Default 5000 if not set
        const sipFlexibleMin = Math.min(minTradeAmount, budgetBasedMin);

        // Calculate how many stocks we can realistically afford
        const maxAffordableStocks = Math.floor(budget / sipFlexibleMin);

        // Limit allocations to top stocks we can actually afford
        const affordableAllocations = allocations.slice(0, Math.max(1, maxAffordableStocks));        // Recalculate weights for only affordable stocks (normalize to 100%)
        const totalAffordableWeight = affordableAllocations.reduce((sum, a) => sum + a.targetWeight, 0);
        affordableAllocations.forEach(alloc => {
            alloc.targetWeight = (alloc.targetWeight / totalAffordableWeight) * 100;
            alloc.targetValue = (alloc.targetWeight / 100) * futureValue;
            alloc.gap = alloc.targetValue - alloc.currentValue;
        });

        // Re-sort by gap after recalculation
        affordableAllocations.sort((a, b) => b.gap - a.gap);

        for (const alloc of affordableAllocations) {
            if (remainingBudget <= 0) break;
            if (alloc.gap <= 0) continue;

            const allocation = Math.min(alloc.gap, remainingBudget);
            if (allocation < sipFlexibleMin) continue;

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

            if (!estPrice) {
                console.warn(`⚠️ ${alloc.symbol}: No price available, skipping`);
                continue; // Skip if no price data
            }

            if (!estPrice) {
                continue; // Skip if no price data
            }

            let estShares = allocation / estPrice;
            const lotSize = sipPlan.rounding.lotSize || 1;

            if (sipPlan.rounding.type === 'LOT') {
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
