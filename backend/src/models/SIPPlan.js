/**
 * SIP Plan Model
 * Defines systematic investment plan configuration
 */
import mongoose from 'mongoose';

const sipPlanSchema = new mongoose.Schema({
    portfolioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Portfolio',
        required: true,
        unique: true,
        index: true
    },

    monthlyAmount: {
        type: Number,
        required: true,
        min: 0
    },

    lumpSums: [{
        date: Date,
        amount: Number,
        description: String
    }],

    executionMode: {
        type: String,
        enum: ['MANUAL', 'BOT_ASSISTED', 'AUTO'],
        default: 'MANUAL'
    },

    rounding: {
        type: {
            type: String,
            enum: ['NONE', 'LOT', 'SHARES'],
            default: 'SHARES'
        },
        lotSize: {
            type: Number,
            default: 1
        }
    },

    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

export default mongoose.model('SIPPlan', sipPlanSchema);
