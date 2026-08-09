/**
 * Risk Profile
 * Account capital and risk tolerance, held per currency because a PSX account
 * and a US account are separate pots that must never be added together.
 */
import mongoose from 'mongoose';

const riskProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    currency: {
        type: String,
        required: true,
        uppercase: true
    },

    accountCapital: {
        type: Number,
        required: true,
        min: [0, 'Capital cannot be negative']
    },

    // Percent of capital risked on one trade.
    defaultRiskPct: {
        type: Number,
        default: 1,
        min: [0, 'Risk cannot be negative'],
        max: [100, 'Risk cannot exceed 100%']
    },

    // Ceiling on a single position's size, independent of the stop distance.
    maxPositionPct: {
        type: Number,
        default: 25,
        min: [0, 'Limit cannot be negative'],
        max: [100, 'Limit cannot exceed 100%']
    }
}, {
    timestamps: true
});

riskProfileSchema.index({ user: 1, currency: 1 }, { unique: true });

export default mongoose.model('RiskProfile', riskProfileSchema);
