import mongoose from 'mongoose';

const psxMonthlySchema = new mongoose.Schema({
    stockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock',
        required: true,
        index: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        index: true
    },
    monthStart: {
        type: Date,
        required: true,
        index: true
    },
    open: {
        type: Number,
        required: true
    },
    high: {
        type: Number,
        required: true
    },
    low: {
        type: Number,
        required: true
    },
    close: {
        type: Number,
        required: true
    },
    volume: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// Compound index for efficient queries by symbol and month
psxMonthlySchema.index({ symbol: 1, monthStart: -1 });
psxMonthlySchema.index({ stockId: 1, monthStart: -1 });

// Ensure unique month per symbol
psxMonthlySchema.index({ symbol: 1, monthStart: 1 }, { unique: true });

const PsxMonthly = mongoose.model('PsxMonthly', psxMonthlySchema);

export default PsxMonthly;
