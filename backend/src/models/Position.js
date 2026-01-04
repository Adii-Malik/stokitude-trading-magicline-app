/**
 * Position Model
 * Materialized view of current holdings per symbol per portfolio
 * Updated incrementally when transactions change
 * Improves performance by avoiding recalculation from all transactions
 */
import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema({
    portfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        required: true,
        index: true
    },

    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },

    // Holdings
    netShares: {
        type: Number,
        required: true,
        default: 0
    },

    avgCost: {
        type: Number,
        default: 0
    },

    costBasis: {
        type: Number,
        default: 0
    },

    // P/L tracking
    realizedPnL: {
        type: Number,
        default: 0
    },

    unrealizedPnL: {
        type: Number,
        default: 0
    },

    marketValue: {
        type: Number,
        default: 0
    },

    // Dividends
    dividendsReceived: {
        type: Number,
        default: 0
    },

    // FIFO lot tracking (optional, used when calculationMethod = 'FIFO')
    lots: [{
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        fees: {
            type: Number,
            default: 0
        },
        purchaseDate: {
            type: Date,
            required: true
        }
    }],

    // Metadata
    firstPurchaseDate: Date,
    lastTransactionAt: Date,

    // Performance metrics (calculated)
    totalReturn: Number, // (unrealizedPnL + realizedPnL + dividends) / costBasis
    yieldOnCost: Number, // dividendsReceived / costBasis

}, {
    timestamps: true
});

// Unique index: one position per symbol per portfolio
positionSchema.index({ portfolioId: 1, symbol: 1 }, { unique: true });

// Methods
positionSchema.methods.calculatePerformanceMetrics = function () {
    if (this.costBasis > 0) {
        this.totalReturn =
            ((this.unrealizedPnL + this.realizedPnL + this.dividendsReceived) / this.costBasis) * 100;
        this.yieldOnCost = (this.dividendsReceived / this.costBasis) * 100;
    } else {
        this.totalReturn = 0;
        this.yieldOnCost = 0;
    }
};

positionSchema.methods.updateFromCalculation = function (calculationResult, currentPrice) {
    this.netShares = calculationResult.netShares;
    this.avgCost = calculationResult.avgCost;
    this.costBasis = calculationResult.costBasis;
    this.realizedPnL = calculationResult.realizedPnL;
    this.unrealizedPnL = calculationResult.unrealizedPnL;
    this.marketValue = calculationResult.marketValue;

    // Update lots if calculator supports it
    if (calculationResult.lots) {
        this.lots = calculationResult.lots;
    }

    this.calculatePerformanceMetrics();
};

export default mongoose.model('Position', positionSchema);
