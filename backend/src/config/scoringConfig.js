/**
 * Scoring Configuration
 * Centralized config for stock scoring logic
 * Based on industry standards (MSCI, Morningstar, Dividend Aristocrats)
 */

export const SCORING_CONFIG = {
    // Strategy Weights
    strategies: {
        DIVIDEND_GROWTH: {
            dividendYield: 0.35,
            payoutSafety: 0.50,
            growth: 0.00,
            quality: 0.15
        },
        GROWTH: {
            dividendYield: 0.10,
            payoutSafety: 0.10,
            growth: 0.50,
            quality: 0.30
        },
        BALANCED: {
            dividendYield: 0.25,
            payoutSafety: 0.20,
            growth: 0.30,
            quality: 0.25
        }
    },

    // Dividend Yield Scoring
    dividendYield: {
        field: 'dividendYield',
        min: 0,
        max: 10,
        scale: 'linear'  // linear, log, percentile
    },

    // Payout Safety Scoring
    payoutSafety: {
        components: {
            payoutRatio: {
                field: 'payoutRatio',
                weight: 0.35,
                tiers: [
                    { min: 20, max: 60, score: 100 },
                    { min: 60, max: 80, score: 85 },
                    { min: 80, max: 100, score: 70 },
                    { min: 100, max: 120, score: 60 },
                    { min: 120, max: 150, score: 50 },
                    { min: 150, max: Infinity, score: 30 },
                    { min: 0, max: 20, score: 50 }
                ]
            },
            consistency: {
                field: 'dividendConsistencyYears',
                weight: 0.25,
                tiers: [
                    { min: 5, score: 100 },
                    { min: 3, score: 80 },
                    { min: 1, score: 60 },
                    { min: 0, score: 50, condition: 'hasYield' },
                    { min: 0, score: 0 }
                ]
            },
            cashCoverage: {
                field: 'cash_dividend_coverage_ratio_ttm',
                weight: 0.30,
                tiers: [
                    { min: 2.0, score: 100 },
                    { min: 1.5, score: 85 },
                    { min: 1.0, score: 70 },
                    { min: 0.8, score: 50 },
                    { min: 0, score: 30 }
                ],
                invert: false  // Higher is better
            },
            balanceSheet: {
                weight: 0.10,
                components: {
                    debtToEquity: {
                        field: 'debtToEquity',
                        weight: 0.6,
                        tiers: [
                            { max: 0.3, score: 100 },
                            { max: 0.8, score: 85 },
                            { max: 1.5, score: 65 },
                            { max: 2.5, score: 40 },
                            { max: Infinity, score: 20 }
                        ]
                    },
                    currentRatio: {
                        field: 'currentRatio',
                        weight: 0.4,
                        tiers: [
                            { min: 1.5, score: 100 },
                            { min: 1.0, score: 80 },
                            { min: 0.8, score: 50 },
                            { min: 0, score: 20 }
                        ]
                    }
                }
            }
        }
    },

    // Quality Scoring (MSCI-style)
    quality: {
        components: {
            roe: {
                field: 'roe',
                weight: 0.40,
                tiers: [
                    { min: 20, score: 100 },
                    { min: 15, score: 85 },
                    { min: 10, score: 70 },
                    { min: 5, score: 50 },
                    { min: 0, score: 30 },
                    { max: 0, score: 0 }
                ]
            },
            leverage: {
                field: 'debtToEquity',
                weight: 0.40,
                tiers: [
                    { max: 0.3, score: 100 },
                    { max: 0.8, score: 85 },
                    { max: 1.5, score: 65 },
                    { max: 2.5, score: 40 },
                    { max: Infinity, score: 20 }
                ]
            },
            liquidity: {
                field: 'currentRatio',
                weight: 0.20,
                tiers: [
                    { min: 1.5, score: 100 },
                    { min: 1.0, score: 80 },
                    { min: 0.8, score: 50 },
                    { min: 0, score: 20 }
                ]
            }
        }
    },

    // Growth Scoring
    growth: {
        components: {
            revenueCagr: {
                field: 'total_revenue_cagr_5y',
                weight: 0.50,
                neutral: 0,
                excellent: 15,
                scale: 'linear'
            },
            epsCagr: {
                field: 'earnings_per_share_diluted_yoy_growth_ttm',
                weight: 0.50,
                neutral: 0,
                excellent: 15,
                scale: 'linear'
            }
        }
    }
};

export default SCORING_CONFIG;
