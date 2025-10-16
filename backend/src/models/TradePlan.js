import mongoose from 'mongoose';

const tradePlanSchema = new mongoose.Schema({
  // Basic Info
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  companyName: {
    type: String,
    trim: true
  },
  
  // Trade Type
  tradeType: {
    type: String,
    enum: ['buy', 'short'],
    default: 'buy',
    required: true
  },

  // Trade Quality / Setup Rating
  setupQuality: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  
  // Buy Levels (Array with ranges)
  buyLevels: [
    {
      level: {
        type: Number,
        required: true
      },
      priceFrom: {
        type: Number,
        required: true
      },
      priceTo: {
        type: Number,
        required: true
      },
      isHit: {
        type: Boolean,
        default: false
      },
      hitDate: {
        type: Date
      }
    }
  ],
  
  // Target Prices (Array)
  targetPrices: [
    {
      level: {
        type: Number,
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      isHit: {
        type: Boolean,
        default: false
      },
      hitDate: {
        type: Date
      }
    }
  ],
  
  // Short-term TP Range (for display)
  shortTermTPRange: {
    from: Number,
    to: Number
  },
  
  // Stop Loss (Object with tracking)
  stopLoss: {
    price: {
      type: Number,
      required: true
    },
    isHit: {
      type: Boolean,
      default: false
    },
    hitDate: {
      type: Date
    }
  },
  
  // Analysis/Notes
  analysis: {
    type: String,
    trim: true
  },
  
  // Current Price (for tracking)
  currentPrice: {
    type: Number,
    default: null
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['active', 'tp_hit', 'sl_hit', 'closed', 'cancelled'],
    default: 'active',
    index: true
  },
  
  // Meta
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  entryDate: {
    type: Date,
    default: Date.now
  },
  exitDate: {
    type: Date
  },
  closedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Performance (optional, for tracking)
  performance: {
    entryPrice: Number,
    exitPrice: Number,
    profitLossPercent: Number
  }
}, {
  timestamps: true
});

// Index for efficient queries
tradePlanSchema.index({ symbol: 1, createdAt: -1 });
tradePlanSchema.index({ status: 1, isActive: 1 });
tradePlanSchema.index({ createdBy: 1, createdAt: -1 });
tradePlanSchema.index({ tradeType: 1, status: 1 });

const TradePlan = mongoose.model('TradePlan', tradePlanSchema);

export default TradePlan;

