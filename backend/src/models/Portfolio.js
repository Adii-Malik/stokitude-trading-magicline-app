/**
 * Portfolio Model
 * Represents a user's investment portfolio
 * Supports multiple portfolios per user, sharing, and flexible P/L calculation methods
 */
import mongoose from 'mongoose';

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

    // P/L calculation method (pluggable)
    calculationMethod: {
        type: String,
        enum: ['AVERAGE_COST', 'FIFO', 'LIFO', 'SPECIFIC_LOT'],
        default: 'AVERAGE_COST'
    },

    // Portfolio configuration
    currency: {
        type: String,
        default: 'PKR',
        uppercase: true
    },

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

export default mongoose.model('Portfolio', portfolioSchema);
