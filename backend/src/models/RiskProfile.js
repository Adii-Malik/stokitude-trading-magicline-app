/**
 * Risk Profile
 *
 * Two numbers: how much of the account one trade may risk, and how much of it a
 * single position may become. Held per portfolio, because the mandate belongs to
 * the account and not to the currency it happens to be denominated in - two PKR
 * brokers can be run to different rules, and a swing book set to 5% must not
 * drag an investing book onto the same line.
 *
 * Capital is deliberately not here. It was a typed field, and a typed capital
 * goes stale the moment the account moves - set once at 200k while the book grew
 * to 677k, every verdict it produced would be wrong in the same direction. The
 * portfolios in this currency already know their own value, so it is read from
 * them instead.
 */
import mongoose from 'mongoose';
import { marketScoped } from './plugins/marketScoped.js';

const riskProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    portfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        required: true,
        index: true
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

riskProfileSchema.index({ user: 1, portfolioId: 1 }, { unique: true });

// Listed per user rather than per book, so it needs a market of its own to be
// filtered by. It carries no currency or exchange to derive one from - only a
// portfolio id - so the route that writes it sets the market from the book it
// already loaded. That is the one place a rule is ever created.
riskProfileSchema.plugin(marketScoped({ from: null }));

export default mongoose.model('RiskProfile', riskProfileSchema);
