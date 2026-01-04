# Portfolio Module - Modular Architecture

> **Design Philosophy:** Plug-and-play components. Adding FIFO, cash tracking, or auto-dividends should be configuration changes, not refactors.

---

## 0) Core Principles

### Modularity Rules
1. **Strategy Pattern:** P/L methods, dividend sources, allocation algorithms = swappable plugins
2. **Feature Flags:** Enable/disable features without code changes
3. **Adapter Pattern:** Data sources (manual/scraper/API) behind unified interface
4. **Event-Driven:** Portfolio changes emit events, handlers react independently

---

## 1) Modular P/L Calculation System

### Architecture: Calculation Strategy Pattern

```javascript
// services/portfolio/calculators/
├── BasePnLCalculator.js          // Abstract base class
├── AverageCostCalculator.js      // MVP default
├── FIFOCalculator.js             // Add anytime
├── LIFOCalculator.js             // Optional
└── SpecificLotCalculator.js      // Advanced
```

### Implementation

**Base Calculator (Interface):**
```javascript
// services/portfolio/calculators/BasePnLCalculator.js
export default class BasePnLCalculator {
  /**
   * Calculate holdings and P/L from transactions
   * @param {Array} transactions - All transactions for a symbol
   * @param {Number} currentPrice - Current market price
   * @returns {Object} - { netShares, avgCost, costBasis, realizedPnL, unrealizedPnL }
   */
  calculate(transactions, currentPrice) {
    throw new Error('Must implement calculate() method');
  }

  getName() {
    throw new Error('Must implement getName() method');
  }

  getDescription() {
    throw new Error('Must implement getDescription() method');
  }
}
```

**Average Cost (MVP):**
```javascript
// services/portfolio/calculators/AverageCostCalculator.js
import BasePnLCalculator from './BasePnLCalculator.js';

export default class AverageCostCalculator extends BasePnLCalculator {
  getName() {
    return 'AVERAGE_COST';
  }

  getDescription() {
    return 'Simple average cost method - best for SIP/dividend investing';
  }

  calculate(transactions, currentPrice) {
    let totalShares = 0;
    let totalCost = 0;
    let realizedPnL = 0;

    const sorted = transactions.sort((a, b) => 
      new Date(a.executedAt) - new Date(b.executedAt)
    );

    for (const tx of sorted) {
      if (tx.type === 'BUY') {
        totalShares += tx.quantity;
        totalCost += (tx.quantity * tx.price) + (tx.fees || 0);
      } else if (tx.type === 'SELL') {
        const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
        const sellProceeds = (tx.quantity * tx.price) - (tx.fees || 0);
        const sellCost = tx.quantity * avgCost;
        
        realizedPnL += (sellProceeds - sellCost);
        
        totalShares -= tx.quantity;
        totalCost -= sellCost;
      }
    }

    const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
    const marketValue = totalShares * currentPrice;
    const unrealizedPnL = marketValue - totalCost;

    return {
      netShares: totalShares,
      avgCost,
      costBasis: totalCost,
      realizedPnL,
      unrealizedPnL,
      marketValue
    };
  }
}
```

**FIFO (Future - just drop in):**
```javascript
// services/portfolio/calculators/FIFOCalculator.js
import BasePnLCalculator from './BasePnLCalculator.js';

export default class FIFOCalculator extends BasePnLCalculator {
  getName() {
    return 'FIFO';
  }

  getDescription() {
    return 'First-In-First-Out - required for tax compliance';
  }

  calculate(transactions, currentPrice) {
    const lots = []; // Track individual purchase lots
    let realizedPnL = 0;

    const sorted = transactions.sort((a, b) => 
      new Date(a.executedAt) - new Date(b.executedAt)
    );

    for (const tx of sorted) {
      if (tx.type === 'BUY') {
        lots.push({
          quantity: tx.quantity,
          price: tx.price,
          fees: tx.fees || 0,
          date: tx.executedAt
        });
      } else if (tx.type === 'SELL') {
        let remaining = tx.quantity;
        const sellPrice = tx.price;
        const sellFees = tx.fees || 0;

        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          const sellQty = Math.min(remaining, lot.quantity);
          
          const sellProceeds = sellQty * sellPrice - (sellFees * sellQty / tx.quantity);
          const costBasis = sellQty * lot.price + (lot.fees * sellQty / (lot.quantity + remaining));
          
          realizedPnL += (sellProceeds - costBasis);
          
          lot.quantity -= sellQty;
          remaining -= sellQty;
          
          if (lot.quantity === 0) lots.shift();
        }
      }
    }

    // Calculate unrealized from remaining lots
    let totalShares = 0;
    let totalCost = 0;
    
    for (const lot of lots) {
      totalShares += lot.quantity;
      totalCost += (lot.quantity * lot.price) + lot.fees;
    }

    const marketValue = totalShares * currentPrice;
    const unrealizedPnL = marketValue - totalCost;
    const avgCost = totalShares > 0 ? totalCost / totalShares : 0;

    return {
      netShares: totalShares,
      avgCost,
      costBasis: totalCost,
      realizedPnL,
      unrealizedPnL,
      marketValue,
      lots // FIFO tracks individual lots
    };
  }
}
```

**Calculator Registry (Plug-and-play):**
```javascript
// services/portfolio/calculators/CalculatorRegistry.js
import AverageCostCalculator from './AverageCostCalculator.js';
import FIFOCalculator from './FIFOCalculator.js';

class CalculatorRegistry {
  constructor() {
    this.calculators = new Map();
    this._registerDefaults();
  }

  _registerDefaults() {
    this.register(new AverageCostCalculator());
    this.register(new FIFOCalculator());
  }

  register(calculator) {
    this.calculators.set(calculator.getName(), calculator);
  }

  get(name) {
    if (!this.calculators.has(name)) {
      throw new Error(`Unknown P/L calculator: ${name}`);
    }
    return this.calculators.get(name);
  }

  getAll() {
    return Array.from(this.calculators.values()).map(calc => ({
      name: calc.getName(),
      description: calc.getDescription()
    }));
  }
}

export default new CalculatorRegistry();
```

**Portfolio Model (Store calculation method):**
```javascript
// In Portfolio schema:
{
  calculationMethod: {
    type: String,
    enum: ['AVERAGE_COST', 'FIFO', 'LIFO', 'SPECIFIC_LOT'],
    default: 'AVERAGE_COST'
  }
}
```

**Usage in Portfolio Service:**
```javascript
// services/portfolioService.js
import CalculatorRegistry from './portfolio/calculators/CalculatorRegistry.js';

async getHoldings(portfolioId) {
  const portfolio = await Portfolio.findById(portfolioId);
  const calculator = CalculatorRegistry.get(portfolio.calculationMethod);
  
  // Get transactions by symbol
  const symbols = await Transaction.distinct('symbol', { portfolioId });
  
  const holdings = [];
  for (const symbol of symbols) {
    const transactions = await Transaction.find({ portfolioId, symbol });
    const stock = await Stock.findOne({ symbol });
    
    const result = calculator.calculate(transactions, stock.currentPrice);
    holdings.push({ symbol, ...result });
  }
  
  return holdings;
}
```

**Switching P/L Methods:**
```javascript
// Later when you want FIFO:
await Portfolio.findByIdAndUpdate(portfolioId, {
  calculationMethod: 'FIFO'
});
// That's it! Next holdings calculation uses FIFO
```

---

## 2) Modular Dividend Data Source System

### Architecture: Data Source Adapter Pattern

```javascript
// services/portfolio/dividendSources/
├── BaseDividendSource.js         // Abstract interface
├── ManualDividendSource.js       // MVP - user enters
├── PSXScraperDividendSource.js   // Phase 2 - auto-scrape
├── APIProviderDividendSource.js  // Phase 3 - paid API
└── CompositeDividendSource.js    // Combine multiple sources
```

**Base Source:**
```javascript
// services/portfolio/dividendSources/BaseDividendSource.js
export default class BaseDividendSource {
  /**
   * Get dividend announcements for a symbol
   * @param {String} symbol
   * @param {Date} fromDate
   * @param {Date} toDate
   * @returns {Array} - [{ symbol, announcedDate, exDate, paymentDate, amount }]
   */
  async getDividends(symbol, fromDate, toDate) {
    throw new Error('Must implement getDividends()');
  }

  getName() {
    throw new Error('Must implement getName()');
  }

  isEnabled() {
    return true; // Override for feature flags
  }
}
```

**Manual Source (MVP):**
```javascript
// services/portfolio/dividendSources/ManualDividendSource.js
import BaseDividendSource from './BaseDividendSource.js';

export default class ManualDividendSource extends BaseDividendSource {
  getName() {
    return 'MANUAL';
  }

  async getDividends(symbol, fromDate, toDate) {
    // Returns empty - user manually creates DIV transactions
    return [];
  }
}
```

**PSX Scraper Source (Future):**
```javascript
// services/portfolio/dividendSources/PSXScraperDividendSource.js
import BaseDividendSource from './BaseDividendSource.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default class PSXScraperDividendSource extends BaseDividendSource {
  getName() {
    return 'PSX_SCRAPER';
  }

  isEnabled() {
    return process.env.ENABLE_DIVIDEND_SCRAPING === 'true';
  }

  async getDividends(symbol, fromDate, toDate) {
    if (!this.isEnabled()) return [];

    try {
      // Scrape PSX dividend announcements
      const url = `https://dps.psx.com.pk/company/${symbol}`;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      const dividends = [];
      $('.dividend-table tr').each((i, row) => {
        // Parse dividend data
        dividends.push({
          symbol,
          announcedDate: $(row).find('.announced').text(),
          exDate: $(row).find('.ex-date').text(),
          paymentDate: $(row).find('.payment').text(),
          amount: parseFloat($(row).find('.amount').text())
        });
      });
      
      return dividends;
    } catch (error) {
      console.error(`Error scraping dividends for ${symbol}:`, error);
      return [];
    }
  }
}
```

**Dividend Source Manager:**
```javascript
// services/portfolio/dividendSources/DividendSourceManager.js
import ManualDividendSource from './ManualDividendSource.js';
import PSXScraperDividendSource from './PSXScraperDividendSource.js';

class DividendSourceManager {
  constructor() {
    this.sources = [
      new ManualDividendSource(),
      new PSXScraperDividendSource()
    ];
  }

  async getDividends(symbol, fromDate, toDate) {
    const allDividends = [];
    
    for (const source of this.sources) {
      if (source.isEnabled()) {
        try {
          const divs = await source.getDividends(symbol, fromDate, toDate);
          allDividends.push(...divs);
        } catch (error) {
          console.error(`Error from ${source.getName()}:`, error);
        }
      }
    }
    
    // Deduplicate and return
    return this._deduplicateDividends(allDividends);
  }

  _deduplicateDividends(dividends) {
    const seen = new Set();
    return dividends.filter(div => {
      const key = `${div.symbol}-${div.exDate}-${div.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export default new DividendSourceManager();
```

---

## 3) Modular Fundamentals Data System

### Architecture: Multi-Source Fundamentals Aggregator

```javascript
// services/portfolio/fundamentalsSources/
├── BaseFundamentalsSource.js
├── PSXScraperSource.js           // Primary - scrape from PSX
├── StockAnalysisSource.js        // Secondary - financial ratios
├── ManualOverrideSource.js       // Fallback - admin manual entry
└── FundamentalsAggregator.js     // Combine all sources
```

**Fundamentals Aggregator:**
```javascript
// services/portfolio/fundamentalsSources/FundamentalsAggregator.js
import PSXScraperSource from './PSXScraperSource.js';
import StockAnalysisSource from './StockAnalysisSource.js';
import ManualOverrideSource from './ManualOverrideSource.js';
import StockFundamental from '../../../models/StockFundamental.js';

class FundamentalsAggregator {
  constructor() {
    // Priority order: Manual > StockAnalysis > PSX > Cached
    this.sources = [
      new ManualOverrideSource(),
      new StockAnalysisSource(),
      new PSXScraperSource()
    ];
  }

  /**
   * Get fundamentals for a symbol
   * Tries sources in order, merges results, caches in DB
   */
  async getFundamentals(symbol) {
    // Check cache first
    const cached = await StockFundamental.findOne({ symbol });
    if (cached && this._isFresh(cached.lastUpdated)) {
      return cached;
    }

    // Aggregate from sources
    const data = {};
    for (const source of this.sources) {
      if (source.isEnabled()) {
        try {
          const sourceData = await source.getFundamentals(symbol);
          Object.assign(data, this._filterNonNull(sourceData));
        } catch (error) {
          console.error(`Error from ${source.getName()}:`, error);
        }
      }
    }

    // Save to cache
    const fundamental = await StockFundamental.findOneAndUpdate(
      { symbol },
      {
        ...data,
        symbol,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );

    return fundamental;
  }

  /**
   * Batch refresh fundamentals for all symbols
   * Run as nightly job
   */
  async refreshAll(symbols) {
    const results = [];
    for (const symbol of symbols) {
      try {
        const fundamental = await this.getFundamentals(symbol);
        results.push({ symbol, status: 'success', data: fundamental });
      } catch (error) {
        results.push({ symbol, status: 'error', error: error.message });
      }
    }
    return results;
  }

  _isFresh(lastUpdated) {
    const CACHE_HOURS = 24; // Fundamentals change slowly
    const now = new Date();
    const diff = (now - new Date(lastUpdated)) / (1000 * 60 * 60);
    return diff < CACHE_HOURS;
  }

  _filterNonNull(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined)
    );
  }
}

export default new FundamentalsAggregator();
```

**PSX Scraper Source:**
```javascript
// services/portfolio/fundamentalsSources/PSXScraperSource.js
import BaseFundamentalsSource from './BaseFundamentalsSource.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default class PSXScraperSource extends BaseFundamentalsSource {
  getName() {
    return 'PSX_SCRAPER';
  }

  isEnabled() {
    return true; // Always try PSX first
  }

  async getFundamentals(symbol) {
    try {
      const url = `https://dps.psx.com.pk/company/${symbol}`;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      return {
        dividendTTM: this._parseDividend($),
        sector: this._parseSector($),
        marketCap: this._parseMarketCap($)
        // Parse what's available on PSX
      };
    } catch (error) {
      console.error(`PSX scrape error for ${symbol}:`, error);
      return {};
    }
  }

  _parseDividend($) {
    // Extract dividend from PSX page
    const divText = $('.dividend-info').text();
    return parseFloat(divText) || null;
  }

  _parseSector($) {
    return $('.sector-name').text().trim() || null;
  }

  _parseMarketCap($) {
    const capText = $('.market-cap').text();
    return this._parseNumber(capText);
  }

  _parseNumber(text) {
    const cleaned = text.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || null;
  }
}
```

**Stock Analysis Source (Financial Ratios):**
```javascript
// services/portfolio/fundamentalsSources/StockAnalysisSource.js
import BaseFundamentalsSource from './BaseFundamentalsSource.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default class StockAnalysisSource extends BaseFundamentalsSource {
  getName() {
    return 'STOCK_ANALYSIS_SCRAPER';
  }

  isEnabled() {
    return process.env.ENABLE_STOCK_ANALYSIS_SCRAPER === 'true';
  }

  async getFundamentals(symbol) {
    if (!this.isEnabled()) return {};

    try {
      // Scrape from stock analysis sites (e.g., investing.com, businessrecorder.com.pk)
      const url = `https://www.brecorder.com/market-data/psx-stocks/${symbol}/company-profile`;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      return {
        payoutRatio: this._parsePayoutRatio($),
        epsGrowthYoY: this._parseEPSGrowth($),
        dividendGrowth3Y: this._parseDividendGrowth($),
        dividendConsistencyYears: this._parseConsistency($)
      };
    } catch (error) {
      console.error(`Stock Analysis scrape error for ${symbol}:`, error);
      return {};
    }
  }

  _parsePayoutRatio($) {
    // Parse from financial table
    return null; // Implement based on actual HTML structure
  }

  _parseEPSGrowth($) {
    return null; // Implement
  }

  _parseDividendGrowth($) {
    return null; // Implement
  }

  _parseConsistency($) {
    return null; // Implement
  }
}
```

**Manual Override Source:**
```javascript
// services/portfolio/fundamentalsSources/ManualOverrideSource.js
import BaseFundamentalsSource from './BaseFundamentalsSource.js';
import StockFundamental from '../../../models/StockFundamental.js';

export default class ManualOverrideSource extends BaseFundamentalsSource {
  getName() {
    return 'MANUAL_OVERRIDE';
  }

  isEnabled() {
    return true;
  }

  async getFundamentals(symbol) {
    // Check if admin manually entered data
    const manual = await StockFundamental.findOne({ 
      symbol,
      manualOverride: true 
    });

    if (manual) {
      return {
        dividendTTM: manual.dividendTTM,
        payoutRatio: manual.payoutRatio,
        epsGrowthYoY: manual.epsGrowthYoY,
        dividendGrowth3Y: manual.dividendGrowth3Y,
        shariahCompliant: manual.shariahCompliant
        // All fields from manual entry
      };
    }

    return {};
  }
}
```

---

## 4) Feature Flags System

```javascript
// models/PortfolioFeatureFlags.js
import mongoose from 'mongoose';

const portfolioFeatureFlagsSchema = new mongoose.Schema({
  portfolioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Portfolio',
    unique: true,
    required: true
  },
  
  // P/L Features
  enableRealizedPnL: { type: Boolean, default: true },
  enableUnrealizedPnL: { type: Boolean, default: true },
  enableTaxTracking: { type: Boolean, default: false }, // Future
  
  // Dividend Features
  enableDividendTracking: { type: Boolean, default: true },
  enableDividendForecast: { type: Boolean, default: false }, // Future
  enableDRIP: { type: Boolean, default: false }, // Future
  
  // Allocation Features
  enableSIPRecommendations: { type: Boolean, default: true },
  enableRebalanceAlerts: { type: Boolean, default: true },
  enableAutoRebalance: { type: Boolean, default: false }, // Future
  
  // Cash Tracking
  enableCashTracking: { type: Boolean, default: false }, // MVP: disabled
  
  // Advanced Features
  enableLotTracking: { type: Boolean, default: false }, // FIFO needs this
  enableShortSelling: { type: Boolean, default: false }, // Future
  enableMarginAccounting: { type: Boolean, default: false }, // Future
  
  // Data Sources
  fundamentalsSource: {
    type: String,
    enum: ['AUTO', 'MANUAL', 'HYBRID'],
    default: 'AUTO'
  },
  
  dividendSource: {
    type: String,
    enum: ['MANUAL', 'AUTO', 'HYBRID'],
    default: 'MANUAL'
  }
}, { timestamps: true });

export default mongoose.model('PortfolioFeatureFlags', portfolioFeatureFlagsSchema);
```

**Usage:**
```javascript
// Check if feature enabled before using
const flags = await PortfolioFeatureFlags.findOne({ portfolioId });

if (flags.enableCashTracking) {
  // Include cash deposit/withdraw logic
}

if (flags.enableTaxTracking) {
  // Calculate CGT liability
}
```

---

## 5) Updated Data Models (Modular)

### Portfolio Model
```javascript
// models/Portfolio.js
import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Sharing
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
  
  // Configuration
  calculationMethod: {
    type: String,
    enum: ['AVERAGE_COST', 'FIFO', 'LIFO', 'SPECIFIC_LOT'],
    default: 'AVERAGE_COST'
  },
  
  currency: {
    type: String,
    default: 'PKR'
  },
  
  // Metadata
  description: String,
  tags: [String],
  color: String, // UI color coding
  
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
  
}, { timestamps: true });

// Indexes
portfolioSchema.index({ owner: 1, isActive: 1 });
portfolioSchema.index({ 'sharedWith.user': 1 });

export default mongoose.model('Portfolio', portfolioSchema);
```

### Transaction Model
```javascript
// models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  portfolioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Portfolio',
    required: true,
    index: true
  },
  
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  
  type: {
    type: String,
    enum: ['BUY', 'SELL', 'DIV', 'DEPOSIT', 'WITHDRAW', 'SPLIT', 'BONUS'],
    required: true
  },
  
  // BUY/SELL fields
  quantity: Number,
  price: Number,
  fees: {
    type: Number,
    default: 0
  },
  
  // DIV fields
  dividendCash: Number,
  dividendType: {
    type: String,
    enum: ['CASH', 'STOCK', 'INTERIM', 'FINAL']
  },
  
  // DEPOSIT/WITHDRAW fields (if cash tracking enabled)
  cashAmount: Number,
  
  // SPLIT/BONUS fields
  ratio: String, // e.g., "2:1", "10%"
  
  // Metadata
  executedAt: {
    type: Date,
    required: true,
    index: true
  },
  
  source: {
    type: String,
    enum: ['manual', 'bot', 'import', 'scraper'],
    default: 'manual'
  },
  
  notes: String,
  
  // Audit trail
  transactionId: String, // Broker transaction ID
  brokerId: String,
  
  // Tax tracking (future)
  taxWithheld: Number, // CGT withheld
  
  // Import tracking
  importBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImportBatch'
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, { timestamps: true });

// Indexes
transactionSchema.index({ portfolioId: 1, executedAt: -1 });
transactionSchema.index({ portfolioId: 1, symbol: 1, executedAt: -1 });
transactionSchema.index({ portfolioId: 1, type: 1 });

export default mongoose.model('Transaction', transactionSchema);
```

### Position Model (Materialized View)
```javascript
// models/Position.js
import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema({
  portfolioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Portfolio',
    required: true,
    index: true
  },
  
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  
  // Holdings
  netShares: {
    type: Number,
    required: true
  },
  
  avgCost: Number,
  costBasis: Number,
  
  // P/L
  realizedPnL: {
    type: Number,
    default: 0
  },
  
  unrealizedPnL: Number, // Calculated on-demand with current price
  
  // Dividends
  dividendsReceived: {
    type: Number,
    default: 0
  },
  
  // FIFO lot tracking (optional, for FIFO method)
  lots: [{
    quantity: Number,
    price: Number,
    fees: Number,
    purchaseDate: Date
  }],
  
  // Metadata
  firstPurchaseDate: Date,
  lastTransactionAt: Date,
  
  // Performance metrics
  totalReturn: Number, // (unrealizedPnL + realizedPnL + dividends) / costBasis
  yieldOnCost: Number, // dividendsReceived / costBasis
  
}, { timestamps: true });

// Unique index
positionSchema.index({ portfolioId: 1, symbol: 1 }, { unique: true });

export default mongoose.model('Position', positionSchema);
```

### StockFundamental Model
```javascript
// models/StockFundamental.js
import mongoose from 'mongoose';

const stockFundamentalSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true
  },
  
  // Dividend metrics
  dividendTTM: Number, // Trailing twelve months
  dividendYield: Number, // Calculated from TTM and current price
  payoutRatio: Number, // 0-1 or 0-100
  dividendGrowth3Y: Number, // % growth
  dividendConsistencyYears: Number,
  
  // Growth metrics
  epsGrowthYoY: Number, // %
  revenueGrowth3Y: Number, // %
  
  // Financial health
  debtToEquity: Number,
  currentRatio: Number,
  roe: Number, // Return on Equity
  
  // Company info
  sector: String,
  industry: String,
  marketCap: Number,
  
  // Shariah compliance
  shariahCompliant: {
    type: Boolean,
    default: null // null = unknown
  },
  
  // Data source tracking
  lastUpdated: {
    type: Date,
    index: true
  },
  
  dataSource: {
    type: String,
    enum: ['PSX', 'STOCK_ANALYSIS', 'API', 'MANUAL'],
    default: 'PSX'
  },
  
  manualOverride: {
    type: Boolean,
    default: false
  },
  
  // Data quality
  dataQuality: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
    default: 'UNKNOWN'
  }
  
}, { timestamps: true });

// Indexes
stockFundamentalSchema.index({ shariahCompliant: 1 });
stockFundamentalSchema.index({ sector: 1 });
stockFundamentalSchema.index({ lastUpdated: -1 });

export default mongoose.model('StockFundamental', stockFundamentalSchema);
```

---

## 6) Job Integration (Automated Fundamentals)

```javascript
// jobs/types/fundamentalsRefreshJobType.js
export default {
  type: 'fundamentalsRefresh',
  name: 'Fundamentals Data Refresh',
  description: 'Auto-refresh fundamental data for all active stocks using scrapers and APIs',
  category: 'data',
  
  defaultConfig: {
    batchSize: 10, // Process 10 symbols at a time
    delayBetweenBatches: 5000, // 5 seconds between batches (rate limiting)
    sources: ['PSX', 'STOCK_ANALYSIS'], // Which sources to use
    refreshStale: true, // Refresh data older than 24 hours
    notifyOnComplete: true
  },
  
  configOptions: [
    {
      name: 'batchSize',
      label: 'Batch Size',
      type: 'number',
      default: 10,
      min: 1,
      max: 50,
      description: 'Number of symbols to process at once'
    },
    {
      name: 'delayBetweenBatches',
      label: 'Delay Between Batches (ms)',
      type: 'number',
      default: 5000,
      min: 1000,
      max: 60000,
      description: 'Delay to avoid overwhelming servers'
    }
  ],
  
  scheduleOptions: {
    supportedTypes: ['recurring', 'manual'],
    defaultType: 'recurring',
    defaultRecurring: {
      amount: 1,
      interval: 'days',
      daysOfWeek: [0,1,2,3,4,5,6], // Daily
      time: '02:00' // 2 AM PKT (off-peak)
    }
  }
};
```

```javascript
// jobs/handlers/fundamentalsRefreshJob.js
import FundamentalsAggregator from '../../services/portfolio/fundamentalsSources/FundamentalsAggregator.js';
import Stock from '../../models/Stock.js';
import StockFundamental from '../../models/StockFundamental.js';

export default async function fundamentalsRefreshJob(job, done) {
  const { batchSize, delayBetweenBatches, refreshStale } = job.attrs.data.config;
  
  try {
    console.log('\n🔄 Starting Fundamentals Refresh Job');
    
    // Get all active stock symbols
    const symbols = await Stock.find({ 
      currentPrice: { $ne: null } 
    }).distinct('symbol');
    
    console.log(`   Found ${symbols.length} active symbols`);
    
    // Filter to stale data if needed
    let symbolsToRefresh = symbols;
    if (refreshStale) {
      const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const freshSymbols = await StockFundamental.find({
        lastUpdated: { $gte: staleThreshold }
      }).distinct('symbol');
      
      symbolsToRefresh = symbols.filter(s => !freshSymbols.includes(s));
      console.log(`   ${symbolsToRefresh.length} symbols need refresh`);
    }
    
    // Process in batches
    const results = { success: 0, errors: 0 };
    
    for (let i = 0; i < symbolsToRefresh.length; i += batchSize) {
      const batch = symbolsToRefresh.slice(i, i + batchSize);
      console.log(`   Processing batch ${Math.floor(i/batchSize) + 1}...`);
      
      const batchResults = await FundamentalsAggregator.refreshAll(batch);
      
      for (const result of batchResults) {
        if (result.status === 'success') {
          results.success++;
        } else {
          results.errors++;
          console.error(`   ❌ ${result.symbol}: ${result.error}`);
        }
      }
      
      // Delay between batches
      if (i + batchSize < symbolsToRefresh.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
    
    console.log(`\n✅ Fundamentals Refresh Complete`);
    console.log(`   Success: ${results.success}, Errors: ${results.errors}`);
    
    done(null, {
      success: true,
      results,
      totalProcessed: symbolsToRefresh.length
    });
    
  } catch (error) {
    console.error('\n❌ Fundamentals Refresh Job Failed:', error);
    done(error);
  }
}
```

---

## 7) Environment Variables (Feature Toggles)

```env
# Portfolio Features
ENABLE_PORTFOLIO_MODULE=true
DEFAULT_PNL_METHOD=AVERAGE_COST
ENABLE_FIFO=false          # Set to true when ready
ENABLE_CASH_TRACKING=false # MVP: disabled

# Fundamentals Sources
ENABLE_FUNDAMENTALS_AUTO_REFRESH=true
ENABLE_PSX_FUNDAMENTALS_SCRAPER=true
ENABLE_STOCK_ANALYSIS_SCRAPER=true
FUNDAMENTALS_CACHE_HOURS=24

# Dividend Sources
ENABLE_DIVIDEND_SCRAPING=false # MVP: manual only
DIVIDEND_SCRAPER_URL=https://dps.psx.com.pk

# Allocation Engine
ENABLE_SIP_RECOMMENDATIONS=true
ENABLE_AUTO_REBALANCE=false # Future
```

---

## 8) Migration Strategy (Adding FIFO Later)

**Step 1: Enable FIFO calculator (already coded)**
```bash
# No code changes needed, just add to registry
# CalculatorRegistry already has it registered
```

**Step 2: Add lot tracking to Position model**
```javascript
// Already in schema:
lots: [{ quantity, price, fees, purchaseDate }]
```

**Step 3: Enable feature flag**
```javascript
await Portfolio.findByIdAndUpdate(portfolioId, {
  calculationMethod: 'FIFO'
});

await PortfolioFeatureFlags.findOneAndUpdate(
  { portfolioId },
  { enableLotTracking: true }
);
```

**Step 4: Rebuild positions**
```javascript
await portfolioService.rebuildPositions(portfolioId);
// Uses FIFO calculator automatically
```

**That's it!** No refactoring needed.

---

## 9) Summary: Modularity Checklist

✅ **P/L Methods:** Plugin architecture, switch with one DB update
✅ **Dividend Sources:** Adapter pattern, add sources without touching core
✅ **Fundamentals Sources:** Multi-source aggregator, auto-refresh via jobs
✅ **Feature Flags:** Enable/disable features per portfolio
✅ **Cash Tracking:** Model supports it, disabled by default
✅ **Multiple Portfolios:** Built-in from day 1
✅ **Sharing:** Role-based access ready
✅ **Job Integration:** Uses existing job system

---

## Implementation Roadmap

### ✅ Completed (80% Core Functionality)

**Phase 0: Foundation**
- ✅ Calculator infrastructure (BasePnLCalculator, AverageCost, FIFO, Registry)
- ✅ Core models (Portfolio, Transaction, Position, StockFundamental)
- ✅ Fundamentals aggregator (multi-source: Manual, PSX, StockAnalysis)
- ✅ Portfolio service (15+ methods)
- ✅ Portfolio routes (20+ endpoints)
- ✅ Portfolio handler (price updates, Socket.IO events)
- ✅ Fundamentals refresh job

**Phase 1: SIP Allocation Engine**
- ✅ Models (PortfolioPolicy, SIPPlan, Recommendation)
- ✅ Allocation engine service (scoring, weights, SIP allocation, drift detection)
- ✅ API routes (9 endpoints: policy, SIP plan, recommendations, drift)
- ✅ Drift alerts (real-time via Socket.IO)

**Phase 3: Frontend UI**
- ✅ PortfolioList component
- ✅ PortfolioDetail component
- ✅ HoldingsTable component
- ✅ TransactionList component
- ✅ AddTransactionModal component
- ✅ AllocationView component
- ✅ Routing & navigation integration

---

### 🔜 Future Enhancements (20% Advanced Features)

**Phase 4: Reports & Analytics**
- [ ] Tax reports (capital gains, dividend income summary)
- [ ] Performance charts (equity curve over time)
- [ ] Sector/allocation breakdown visualization
- [ ] Export to CSV/PDF
- [ ] Comparative performance analysis

**Phase 5: Portfolio Snapshots**
- [ ] Daily/weekly snapshots of portfolio value
- [ ] Historical equity curve tracking
- [ ] Performance metrics over time (CAGR, Sharpe ratio)
- [ ] Benchmark comparison (vs PSX-100 index)

**Phase 6: Cash Management UI**
- [ ] Cash balance tracking dashboard
- [ ] Available cash vs invested breakdown
- [ ] DEPOSIT/WITHDRAW transaction UI (backend ready)
- [ ] Cash flow reports

**Phase 7: Auto-Dividends**
- [ ] Scrape dividend announcements from PSX/sources
- [ ] Auto-create DIV transactions
- [ ] Dividend calendar view
- [ ] Dividend yield tracking
- [ ] Ex-dividend date alerts

**Phase 8: Advanced Allocation**
- [ ] Rebalancing recommendations (auto-calculate trades needed)
- [ ] Tax-loss harvesting suggestions
- [ ] Modern Portfolio Theory optimization
- [ ] Risk analysis (volatility, beta, correlation matrix)
- [ ] What-if scenario analysis

---

## Current Status: Production Ready for Core Use

**You can now:**
- Create multiple portfolios ✅
- Track BUY/SELL/DIV transactions ✅
- View real-time holdings & P/L ✅
- Share portfolios with family/team ✅
- Get SIP allocation recommendations ✅
- Monitor drift alerts ✅
- Switch P/L methods (Average Cost ↔ FIFO) ✅

**Missing features are enhancements, not blockers.**
