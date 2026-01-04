/**
 * Portfolio Policy Model
 * Defines allocation strategy, scoring weights, and constraints
 */
import mongoose from 'mongoose';

const portfolioPolicySchema = new mongoose.Schema({
    portfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        required: true,
        unique: true,
        index: true
    },

    strategyType: {
        type: String,
        enum: ['DIVIDEND_GROWTH', 'VALUE', 'GROWTH', 'BALANCED', 'CUSTOM'],
        default: 'DIVIDEND_GROWTH'
    },

    // Universe selection
    universeMode: {
        type: String,
        enum: ['MANUAL_LIST', 'ALL_ACTIVE_HOLDINGS', 'WATCHLIST', 'MARKET'],
        default: 'MANUAL_LIST'
    },

    allowedSymbols: [{
        type: String,
        uppercase: true,
        trim: true
    }],

    // Filters
    filters: {
        shariahOnly: {
            type: Boolean,
            default: false
        },
        minDividendYield: Number,
        maxPayoutRatio: Number,
        minMarketCap: Number,
        sectors: [String],
        excludeSymbols: [String]
    },

    // Scoring weights (must sum to 1.0)
    scoringWeights: {
        dividendYield: {
            type: Number,
            default: 0.35,
            min: 0,
            max: 1
        },
        payoutSafety: {
            type: Number,
            default: 0.25,
            min: 0,
            max: 1
        },
        growth: {
            type: Number,
            default: 0.30,
            min: 0,
            max: 1
        },
        quality: {
            type: Number,
            default: 0.10,
            min: 0,
            max: 1
        }
    },

    // Allocation constraints
    constraints: {
        maxPositionPct: {
            type: Number,
            default: 15,
            min: 1,
            max: 100
        },
        minHoldings: {
            type: Number,
            default: 8,
            min: 1
        },
        maxHoldings: {
            type: Number,
            default: 30
        },
        sectorCaps: {
            type: Map,
            of: Number // Sector name -> max %
        }
    },

    // Rebalancing
    rebalance: {
        driftThresholdPct: {
            type: Number,
            default: 5,
            min: 1,
            max: 50
        },
        minTradeAmount: {
            type: Number,
            default: 5000 // PKR
        }
    },

    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

// Validate weights sum to 1.0
portfolioPolicySchema.pre('save', function (next) {
    const weights = this.scoringWeights;
    const sum = weights.dividendYield + weights.payoutSafety + weights.growth + weights.quality;

    if (Math.abs(sum - 1.0) > 0.01) {
        return next(new Error(`Scoring weights must sum to 1.0 (current: ${sum})`));
    }

    next();
});

export default mongoose.model('PortfolioPolicy', portfolioPolicySchema);
