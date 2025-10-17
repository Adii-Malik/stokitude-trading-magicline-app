import mongoose from 'mongoose';

const symbolSchema = new mongoose.Schema({
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
  // Status tracking (updated by magicLineStatusService)
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
symbolSchema.index({ isActive: 1, status: 1 });
symbolSchema.index({ symbol: 1, isActive: 1 });

// Ensure virtuals are included when converting to JSON
symbolSchema.set('toJSON', { virtuals: true });
symbolSchema.set('toObject', { virtuals: true });

const Symbol = mongoose.model('Symbol', symbolSchema);

export default Symbol;

