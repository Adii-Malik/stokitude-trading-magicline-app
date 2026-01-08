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

    // Flexible fundamental data storage (JSON)
    // All financial metrics stored here for flexibility
    metrics: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
        // Example structure:
        // {
        //   dividendTTM: 5.0,
        //   dividendYield: 6.5,
        //   payoutRatio: 45.0,
        //   dividendGrowth3Y: 8.2,
        //   dividendConsistencyYears: 10,
        //   epsGrowthYoY: 12.5,
        //   revenueGrowth3Y: 15.0,
        //   debtToEquity: 0.45,
        //   currentRatio: 1.8,
        //   roe: 18.5,
        //   sector: "Oil & Gas",
        //   industry: "Exploration & Production",
        //   marketCap: 450000,
        //   shariahCompliant: true,
        //   ... any future metrics ...
        // }
    },

    // Data source tracking
    lastUpdated: {
        type: Date,
        index: true
    },

    dataSource: {
        type: String,
        enum: ['PSX', 'STOCK_ANALYSIS', 'TRADINGVIEW', 'API', 'MANUAL', 'COMPOSITE'],
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

// Indexes for efficient querying (on nested metrics fields)
stockFundamentalSchema.index({ 'metrics.sector': 1 });
stockFundamentalSchema.index({ 'metrics.shariahCompliant': 1 });
stockFundamentalSchema.index({ lastUpdated: -1 });
stockFundamentalSchema.index({ dataQuality: 1 });

// Methods
stockFundamentalSchema.methods.isFresh = function (maxAgeHours = 2160) { // 90 days default
    if (!this.lastUpdated) return false;
    const ageHours = (Date.now() - new Date(this.lastUpdated)) / 3600000; // Optimize calculation
    return ageHours < maxAgeHours;
};

stockFundamentalSchema.methods.getMetric = function (key, defaultValue = null) {
    return this.metrics?.[key] ?? defaultValue;
};

stockFundamentalSchema.methods.setMetric = function (key, value) {
    if (!this.metrics) {
        this.metrics = {};
    }
    this.metrics[key] = value;
    this.markModified('metrics'); // Tell Mongoose the Mixed field changed
};

stockFundamentalSchema.methods.calculateDividendYield = function (currentPrice) {
    const dividendTTM = this.getMetric('dividendTTM');
    if (dividendTTM && currentPrice > 0) {
        const dividendYield = (dividendTTM / currentPrice) * 100;
        this.setMetric('dividendYield', dividendYield);
        return dividendYield;
    }
    return this.getMetric('dividendYield');
};

// Static methods
stockFundamentalSchema.statics.findByShariahCompliant = function () {
    return this.find({ 'metrics.shariahCompliant': true });
};

stockFundamentalSchema.statics.findBySector = function (sector) {
    return this.find({ 'metrics.sector': new RegExp(sector, 'i') });
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
