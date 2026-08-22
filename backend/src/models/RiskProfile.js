/**
 * Risk Profile
 *
 * Two numbers: how much of the account one trade may risk, and how much of it a
 * single position may become. Held per currency because a PSX account and a US
 * account are separate pots that must never be added together.
 *
 * Capital is deliberately not here. It was a typed field, and a typed capital
 * goes stale the moment the account moves - set once at 200k while the book grew
 * to 677k, every verdict it produced would be wrong in the same direction. The
 * portfolios in this currency already know their own value, so it is read from
 * them instead.
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

    // Percent of capital risked on one trade, if the stop is hit.
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
