/**
 * Generic Scoring Engine
 * Decoupled from business logic - reads from config and applies scoring rules
 */

import SCORING_CONFIG from '../config/scoringConfig.js';

/**
 * Apply tier-based scoring
 */
export function applyTierScoring(value, tiers, options = {}) {
    if (value === null || value === undefined) return 0;

    for (const tier of tiers) {
        // Check conditions if any
        if (tier.condition && !options[tier.condition]) continue;

        // Handle min/max ranges
        if (tier.min !== undefined && tier.max !== undefined) {
            if (value >= tier.min && value < tier.max) return tier.score;
        } else if (tier.min !== undefined && value >= tier.min) {
            return tier.score;
        } else if (tier.max !== undefined && value < tier.max) {
            return tier.score;
        }
    }

    return 0;
}

/**
 * Apply linear scaling between neutral and excellent
 */
export function applyLinearScaling(value, neutral, excellent) {
    if (value === null || value === undefined) return 0;

    if (value <= neutral) return 0;
    if (value >= excellent) return 100;

    return ((value - neutral) / (excellent - neutral)) * 100;
}

/**
 * Score a component using its configuration
 */
export function scoreComponent(componentConfig, stockData, options = {}) {
    const { field, tiers, neutral, excellent, scale, components } = componentConfig;

    // Handle nested components (composite scores)
    if (components) {
        let compositeScore = 0;
        for (const subConfig of Object.values(components)) {
            const subScore = scoreComponent(subConfig, stockData, options);
            compositeScore += subScore * (subConfig.weight || 0);
        }
        return compositeScore;
    }

    // Get value from stock data
    const value = stockData[field];

    // Apply tier-based scoring
    if (tiers) {
        return applyTierScoring(value, tiers, options);
    }

    // Apply linear scaling
    if (scale === 'linear' && neutral !== undefined && excellent !== undefined) {
        return applyLinearScaling(value, neutral, excellent);
    }

    return 0;
}

/**
 * Calculate overall score for a stock
 */
export function calculateOverallScore(strategy, stockData) {
    const strategyWeights = SCORING_CONFIG.strategies[strategy];
    if (!strategyWeights) {
        throw new Error(`Unknown strategy: ${strategy}`);
    }

    const scores = {
        dividendYield: scoreDividendYield(stockData),
        payoutSafety: scorePayoutSafety(stockData),
        growth: scoreGrowth(stockData),
        quality: scoreQuality(stockData)
    };

    // Calculate weighted total
    const totalScore =
        scores.dividendYield * strategyWeights.dividendYield +
        scores.payoutSafety * strategyWeights.payoutSafety +
        scores.growth * strategyWeights.growth +
        scores.quality * strategyWeights.quality;

    return {
        total: Math.round(totalScore * 10) / 10,
        breakdown: scores
    };
}

/**
 * Score dividend yield using config
 */
export function scoreDividendYield(stockData) {
    const config = SCORING_CONFIG.dividendYield;
    const value = stockData[config.field] || 0;

    if (config.scale === 'linear') {
        return applyLinearScaling(value, config.min, config.max);
    }

    return 0;
}

/**
 * Score payout safety using config
 */
export function scorePayoutSafety(stockData) {
    const config = SCORING_CONFIG.payoutSafety.components;
    let totalScore = 0;

    // Score each component
    for (const componentConfig of Object.values(config)) {
        const options = {
            hasYield: stockData.dividendYield > 0
        };
        const componentScore = scoreComponent(componentConfig, stockData, options);
        totalScore += componentScore * componentConfig.weight;
    }

    return totalScore;
}

/**
 * Score quality using config
 */
export function scoreQuality(stockData) {
    const config = SCORING_CONFIG.quality.components;
    let totalScore = 0;

    for (const componentConfig of Object.values(config)) {
        const componentScore = scoreComponent(componentConfig, stockData);
        totalScore += componentScore * componentConfig.weight;
    }

    return totalScore;
}

/**
 * Score growth using config
 */
export function scoreGrowth(stockData) {
    const config = SCORING_CONFIG.growth.components;
    let totalScore = 0;

    for (const componentConfig of Object.values(config)) {
        const componentScore = scoreComponent(componentConfig, stockData);
        totalScore += componentScore * componentConfig.weight;
    }

    return totalScore;
}

export default {
    calculateOverallScore,
    scoreComponent,
    scoreDividendYield,
    scorePayoutSafety,
    scoreQuality,
    scoreGrowth,
    applyTierScoring,
    applyLinearScaling
};
