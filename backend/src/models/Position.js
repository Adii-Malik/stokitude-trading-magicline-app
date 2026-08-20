/**
 * Position Model
 * Materialized view of current holdings per symbol per portfolio
 * Updated incrementally when transactions change
 * Improves performance by avoiding recalculation from all transactions
 */
import mongoose from 'mongoose';
import { EXCHANGE_CODES, DEFAULT_EXCHANGE, currencyOf } from '../config/exchanges.js';

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

    exchange: {
        type: String,
        enum: EXCHANGE_CODES,
        default: DEFAULT_EXCHANGE,
        uppercase: true
    },

    currency: {
        type: String,
        uppercase: true,
        default: function () { return currencyOf(this.exchange); }
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

    // Holding-period CGT on realised gains (advance tax NCCPL would deduct).
    // Populated by lot-tracking calculators; 0 for AVERAGE_COST.
    cgtTax: {
        type: Number,
        default: 0
    },

    // Every matched lot-to-sale slice, with its holding period, tier and year.
    // Kept rather than summed away because loss relief nets across the whole
    // portfolio and across tax years - it cannot be worked out one symbol at a
    // time, which is what cgtTax above is.
    disposals: [{
        _id: false,
        quantity: Number,
        purchaseDate: Date,
        sellDate: Date,
        holdingMonths: Number,
        tier: String,
        gain: Number,
        cgtRate: Number,
        cgtTax: Number,
        taxYear: Number
    }],

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
positionSchema.index({ portfolioId: 1, exchange: 1, symbol: 1 }, { unique: true });

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
    this.cgtTax = calculationResult.cgtTax || 0;
    this.disposals = calculationResult.disposals || [];
    this.unrealizedPnL = calculationResult.unrealizedPnL;
    this.marketValue = calculationResult.marketValue;

    // Update lots if calculator supports it
    if (calculationResult.lots) {
        this.lots = calculationResult.lots;
    }

    this.calculatePerformanceMetrics();
};

export default mongoose.model('Position', positionSchema);
