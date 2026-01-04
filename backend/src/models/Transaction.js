/**
 * Transaction Model
 * Source of truth for all portfolio transactions
 * Supports BUY, SELL, DIV (dividends), and future types (SPLIT, BONUS)
 */
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    portfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        required: true,
        index: true
    },

    symbol: {
        type: String,
        required: [true, 'Symbol is required'],
        uppercase: true,
        trim: true,
        index: true
    },

    type: {
        type: String,
        enum: ['BUY', 'SELL', 'DIV', 'DEPOSIT', 'WITHDRAW', 'SPLIT', 'BONUS'],
        required: true
    },

    // BUY/SELL fields
    quantity: {
        type: Number,
        min: [0, 'Quantity cannot be negative']
    },

    price: {
        type: Number,
        min: [0, 'Price cannot be negative']
    },

    fees: {
        type: Number,
        default: 0,
        min: [0, 'Fees cannot be negative']
    },

    // DIV (dividend) fields
    dividendCash: {
        type: Number,
        min: [0, 'Dividend amount cannot be negative']
    },

    dividendType: {
        type: String,
        enum: ['CASH', 'STOCK', 'INTERIM', 'FINAL']
    },

    // DEPOSIT/WITHDRAW fields (for cash tracking)
    cashAmount: {
        type: Number
    },

    // SPLIT/BONUS fields
    ratio: {
        type: String // e.g., "2:1", "10%"
    },

    // Execution metadata
    executedAt: {
        type: Date,
        required: [true, 'Execution date is required'],
        index: true
    },

    source: {
        type: String,
        enum: ['manual', 'bot', 'import', 'scraper'],
        default: 'manual'
    },

    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },

    // Audit trail
    transactionId: {
        type: String, // Broker transaction ID
        trim: true
    },

    brokerId: {
        type: String,
        trim: true
    },

    // Tax tracking (future)
    taxWithheld: {
        type: Number,
        default: 0,
        min: [0, 'Tax withheld cannot be negative']
    },

    // Import tracking
    importBatchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ImportBatch'
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }

}, {
    timestamps: true
});

// Indexes for efficient querying
transactionSchema.index({ portfolioId: 1, executedAt: -1 });
transactionSchema.index({ portfolioId: 1, symbol: 1, executedAt: -1 });
transactionSchema.index({ portfolioId: 1, type: 1 });

// Validation: Ensure required fields based on type
transactionSchema.pre('save', function (next) {
    if (['BUY', 'SELL'].includes(this.type)) {
        if (!this.quantity || !this.price) {
            return next(new Error(`BUY/SELL transactions require quantity and price`));
        }
    }

    if (this.type === 'DIV') {
        if (!this.dividendCash) {
            return next(new Error(`DIV transactions require dividendCash`));
        }
    }

    if (['DEPOSIT', 'WITHDRAW'].includes(this.type)) {
        if (!this.cashAmount) {
            return next(new Error(`${this.type} transactions require cashAmount`));
        }
    }

    next();
});

// Virtual: Total cost/proceeds for BUY/SELL
transactionSchema.virtual('totalAmount').get(function () {
    if (this.type === 'BUY') {
        return (this.quantity * this.price) + this.fees;
    } else if (this.type === 'SELL') {
        return (this.quantity * this.price) - this.fees;
    } else if (this.type === 'DIV') {
        return this.dividendCash;
    }
    return 0;
});

export default mongoose.model('Transaction', transactionSchema);
