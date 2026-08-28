/**
 * Portfolio Model
 * Represents a user's investment portfolio
 * Supports multiple portfolios per user, sharing, and flexible P/L calculation methods
 */
import mongoose from 'mongoose';
import { marketScoped } from './plugins/marketScoped.js';

const portfolioSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Portfolio name is required'],
        trim: true,
        maxlength: [100, 'Portfolio name cannot exceed 100 characters']
    },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Sharing configuration
    sharedWith: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['viewer', 'commenter', 'editor'],
            default: 'viewer'
        },
        sharedAt: {
            type: Date,
            default: Date.now
        }
    }],

    /**
     * P/L calculation method. Only those with a registered calculator:
     * selecting one without an implementation throws on every position rebuild.
     *
     * A PKR portfolio is always NCCPL and is not asked. NCCPL settles PSX trades
     * one way - same-day LIFO, older holdings FIFO - regardless of what anyone
     * would rather it did, so any other choice reports a tax figure the taxpayer
     * does not owe. It is a fact about the exchange, not a preference.
     */
    calculationMethod: {
        type: String,
        enum: ['AVERAGE_COST', 'FIFO', 'NCCPL'],
        default: 'AVERAGE_COST'
    },

    /**
     * Capital gains tax on realised gains, as a percent. Dividends are not
     * taxed here - PSX withholds those at source, so what the ledger records
     * has already had tax taken off.
     */
    taxRatePct: {
        type: Number,
        default: 15,
        min: 0,
        max: 100
    },

    // Portfolio configuration

    currency: {
        type: String,
        default: 'PKR',
        uppercase: true
    },

    /**
     * Brokerage bands, matched on share price. PSX brokers charge a flat rate
     * per share on cheap stocks and a percentage of value on expensive ones,
     * so a single rate cannot express it. Used to prefill the fee on a trade.
     *
     * `to: null` means the band has no upper bound.
     */
    commissionSlabs: [{
        _id: false,
        from: { type: Number, required: true, min: 0 },
        to: { type: Number, default: null },
        type: {
            type: String,
            enum: ['PER_SHARE', 'PERCENT'],
            default: 'PER_SHARE'
        },
        value: { type: Number, required: true, min: 0 }
    }],

    /**
     * Everything a contract note charges beyond brokerage - sales tax, CDC,
     * NCCPL, SECP, PSX LAGA, CVT, WHT. Each names its own basis because they
     * genuinely differ: sales tax is a cut of the *brokerage*, CDC is per
     * share, the rest are a percentage of traded value. Treating them all as a
     * percentage of value fits one contract note and breaks on the next.
     *
     * `appliesTo` covers charges levied on one side only, as WHT usually is.
     */
    charges: [{
        _id: false,
        name: { type: String, required: true, trim: true },
        basis: {
            type: String,
            enum: ['PERCENT_OF_BROKERAGE', 'PERCENT_OF_VALUE', 'PER_SHARE', 'FIXED'],
            default: 'PERCENT_OF_VALUE'
        },
        value: { type: Number, required: true, min: 0 },
        appliesTo: { type: String, enum: ['BOTH', 'BUY', 'SELL'], default: 'BOTH' }
    }],

    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },

    tags: [{
        type: String,
        trim: true
    }],

    color: {
        type: String,
        match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code']
    },

    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    // Performance tracking
    inceptionDate: {
        type: Date,
        default: Date.now
    },

    lastRebalanceDate: Date,

}, {
    timestamps: true
});

// Indexes for performance
portfolioSchema.index({ owner: 1, isActive: 1 });
portfolioSchema.index({ 'sharedWith.user': 1 });

// Methods
portfolioSchema.methods.isOwnedBy = function (userId) {
    // Handle both populated and non-populated owner field
    const ownerId = this.owner._id || this.owner;
    return ownerId.toString() === userId.toString();
};

// PKR means PSX means NCCPL. Enforced here rather than in the form, so an older
// client or a direct API call cannot store a method that misreports the tax.
portfolioSchema.pre('validate', function () {
    if ((this.currency || 'PKR').toUpperCase() === 'PKR') this.calculationMethod = 'NCCPL';
});

portfolioSchema.methods.hasAccess = function (userId, requiredRole = 'viewer') {
    // Owner has full access
    if (this.isOwnedBy(userId)) {
        return true;
    }

    // Check shared access
    const roleHierarchy = { viewer: 1, commenter: 2, editor: 3 };
    const userShare = this.sharedWith.find(
        share => share.user.toString() === userId.toString()
    );

    if (!userShare) {
        return false;
    }

    return roleHierarchy[userShare.role] >= roleHierarchy[requiredRole];
};

portfolioSchema.methods.canEdit = function (userId) {
    return this.isOwnedBy(userId) || this.hasAccess(userId, 'editor');
};

// Scoped to one market, from its currency. Books are listed without a portfolio
// id, so this is filtered rather than inherited.
portfolioSchema.plugin(marketScoped({ from: 'currency' }));

export default mongoose.model('Portfolio', portfolioSchema);
