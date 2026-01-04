/**
 * Recommendation Model
 * Stores allocation engine outputs for audit and execution
 */
import mongoose from 'mongoose';

const recommendationSchema = new mongoose.Schema({
    portfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        required: true,
        index: true
    },

    forMonth: {
        type: String, // YYYY-MM
        required: true,
        index: true
    },

    budget: {
        type: Number,
        required: true
    },

    allocations: [{
        symbol: {
            type: String,
            required: true,
            uppercase: true
        },
        amount: Number,
        estShares: Number,
        estPrice: Number,
        targetWeight: Number,
        currentWeight: Number,
        gap: Number,
        reasoning: {
            score: Number,
            dividendYield: Number,
            payoutSafety: Number,
            growth: Number,
            quality: Number
        }
    }],

    status: {
        type: String,
        enum: ['DRAFT', 'APPROVED', 'EXECUTED', 'SKIPPED'],
        default: 'DRAFT',
        index: true
    },

    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    approvedAt: Date,

    executedAt: Date,

    notes: String

}, { timestamps: true });

recommendationSchema.index({ portfolioId: 1, forMonth: 1 }, { unique: true });

export default mongoose.model('Recommendation', recommendationSchema);
