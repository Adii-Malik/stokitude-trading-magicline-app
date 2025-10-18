import mongoose from 'mongoose';

const magicLineSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  originalSymbol: {
    type: String,
    required: true
  },
  magicLine: {
    type: Number,
    required: true,
    index: true
  },
  // Status tracking (updated by magicLineHandler)
  status: {
    type: String,
    enum: ['pending', 'met'],
    default: 'pending',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Note: Prices are stored centrally in Stock model
  // createdAt and updatedAt are auto-managed by timestamps: true
}, {
  timestamps: true
});

// Compound indexes for complex queries
magicLineSchema.index({ isActive: 1, status: 1 });
magicLineSchema.index({ symbol: 1, isActive: 1 });

// Ensure virtuals are included when converting to JSON
magicLineSchema.set('toJSON', { virtuals: true });
magicLineSchema.set('toObject', { virtuals: true });

const MagicLine = mongoose.model('MagicLine', magicLineSchema);

export default MagicLine;

