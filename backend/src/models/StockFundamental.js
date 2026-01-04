/**
 * Stock Fundamental Model
 * Stores fundamental data for allocation engine and reporting
 * Data sourced from multiple providers (PSX, scrapers, manual)
 */
import mongoose from 'mongoose';

const stockFundamentalSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true
    },

    // Dividend metrics
    dividendTTM: {
        type: Number, // Trailing twelve months dividend (PKR)
        min: 0
    },

    dividendYield: {
        type: Number, // Percentage (calculated from TTM and current price)
        min: 0,
        max: 100
    },

    payoutRatio: {
        type: Number, // Percentage (0-100)
        min: 0,
        max: 200 // Can exceed 100 in some cases
    },

    dividendGrowth3Y: {
        type: Number // Percentage growth over 3 years
    },

    dividendConsistencyYears: {
        type: Number, // Years of consecutive dividends
        min: 0
    },

    // Growth metrics
    epsGrowthYoY: {
        type: Number // Percentage year-over-year EPS growth
    },

    revenueGrowth3Y: {
        type: Number // Percentage revenue growth over 3 years
    },

    // Financial health
    debtToEquity: {
        type: Number,
        min: 0
    },

    currentRatio: {
        type: Number,
        min: 0
    },

    roe: {
        type: Number // Return on Equity (percentage)
    },

    // Company information
    sector: {
        type: String,
        trim: true,
        index: true
    },

    industry: {
        type: String,
        trim: true
    },

    marketCap: {
        type: Number, // in PKR millions
        min: 0
    },

    // Shariah compliance
    shariahCompliant: {
        type: Boolean,
        default: null, // null = unknown
        index: true
    },

    // Data source tracking
    lastUpdated: {
        type: Date,
        index: true
    },

    dataSource: {
        type: String,
        enum: ['PSX', 'STOCK_ANALYSIS', 'API', 'MANUAL', 'COMPOSITE'],
        default: 'COMPOSITE'
    },

    manualOverride: {
        type: Boolean,
        default: false
    },

    // Data quality indicator
    dataQuality: {
        type: String,
        enum: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
        default: 'UNKNOWN'
    },

    // Source attribution
    sourcesUsed: [{
        source: String,
        lastFetched: Date,
        fieldsProvided: [String]
    }]

}, {
    timestamps: true
});

// Indexes for efficient querying
stockFundamentalSchema.index({ shariahCompliant: 1 });
stockFundamentalSchema.index({ sector: 1 });
stockFundamentalSchema.index({ lastUpdated: -1 });
stockFundamentalSchema.index({ dataQuality: 1 });

// Methods
stockFundamentalSchema.methods.isFresh = function (maxAgeHours = 24) {
    if (!this.lastUpdated) return false;
    const now = new Date();
    const ageHours = (now - new Date(this.lastUpdated)) / (1000 * 60 * 60);
    return ageHours < maxAgeHours;
};

stockFundamentalSchema.methods.calculateDividendYield = function (currentPrice) {
    if (this.dividendTTM && currentPrice > 0) {
        this.dividendYield = (this.dividendTTM / currentPrice) * 100;
    }
    return this.dividendYield;
};

// Static methods
stockFundamentalSchema.statics.findByShariahCompliant = function () {
    return this.find({ shariahCompliant: true });
};

stockFundamentalSchema.statics.findBySector = function (sector) {
    return this.find({ sector: new RegExp(sector, 'i') });
};

stockFundamentalSchema.statics.findStale = function (maxAgeHours = 24) {
    const threshold = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    return this.find({
        $or: [
            { lastUpdated: { $lt: threshold } },
            { lastUpdated: null }
        ]
    });
};

export default mongoose.model('StockFundamental', stockFundamentalSchema);
