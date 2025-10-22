# 📋 COMPREHENSIVE PLAN: Automated Trading Signal System with Backtesting

**Project**: PSX SmartDesk - Trading Signals & Backtesting Module  
**Version**: 1.0  
**Date**: October 21, 2025  
**Status**: Planning Phase

---

## 📌 **OVERVIEW**

This document outlines the complete implementation plan for adding automated buy/sell signal generation with backtesting capabilities to the PSX SmartDesk platform.

### **Key Objectives**

1. **Historical Data Storage**: Scrape and store years of PSX stock data (daily, weekly, monthly)
2. **Technical Indicators**: Integrate industry-standard indicator library (Tulip/TechnicalIndicators)
3. **Strategy Builder**: Allow users to define trading strategies with custom indicators and conditions
4. **Backtesting Engine**: Test strategies against historical data with performance metrics
5. **Live Signal Generation**: Automatically generate buy/sell signals based on real-time price updates
6. **Notification System**: Alert users when signals are generated

---

## 🎯 **PHASE 1: Historical Data Infrastructure (Foundation)**

### 1.1 Database Models for Historical Data

**Create new models:**

#### **Model: `PsxDaily.js`** - Store daily OHLCV data

```javascript
{
  date: Date,              // Trading date (indexed)
  symbol: String,          // Stock symbol (indexed)
  open: Number,            // Opening price
  high: Number,            // Highest price
  low: Number,             // Lowest price
  close: Number,           // Closing price
  change: Number,          // Price change
  volume: Number,          // Trading volume
  createdAt: Date,         // Auto timestamp
  updatedAt: Date          // Auto timestamp
}

// Indexes:
// - Compound: { symbol: 1, date: 1 } (unique)
// - Single: { date: 1 }
// - Single: { symbol: 1 }
```

#### **Model: `PsxWeekly.js`** - Store weekly aggregated data

```javascript
{
  weekStartDate: Date,     // Monday of the week (indexed)
  weekEndDate: Date,       // Friday of the week
  year: Number,            // Year for grouping
  weekNumber: Number,      // ISO week number
  symbol: String,          // Stock symbol (indexed)
  open: Number,            // Week's opening price (Monday open)
  high: Number,            // Week's highest price
  low: Number,             // Week's lowest price
  close: Number,           // Week's closing price (Friday close)
  volume: Number,          // Week's total volume
  change: Number,          // Week's price change
  changePercent: Number,   // Week's percentage change
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// - Compound: { symbol: 1, weekStartDate: 1 } (unique)
// - Compound: { symbol: 1, year: 1, weekNumber: 1 }
```

#### **Model: `PsxMonthly.js`** - Store monthly aggregated data

```javascript
{
  year: Number,            // Year (indexed)
  month: Number,           // Month (1-12) (indexed)
  monthStartDate: Date,    // First day of month
  monthEndDate: Date,      // Last day of month
  symbol: String,          // Stock symbol (indexed)
  open: Number,            // Month's opening price
  high: Number,            // Month's highest price
  low: Number,             // Month's lowest price
  close: Number,           // Month's closing price
  volume: Number,          // Month's total volume
  change: Number,          // Month's price change
  changePercent: Number,   // Month's percentage change
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// - Compound: { symbol: 1, year: 1, month: 1 } (unique)
// - Single: { year: 1, month: 1 }
```

#### **Model: `BacktestSymbol.js`** - Manage symbols for backtesting

```javascript
{
  symbol: String,          // Stock symbol (unique, uppercase)
  companyName: String,     // Company name
  sector: String,          // Business sector
  isActive: Boolean,       // Active for backtesting (default: true)
  dataFrom: Date,          // Earliest available data
  dataTo: Date,            // Latest available data
  lastScraped: Date,       // Last scraping timestamp
  totalRecords: Number,    // Count of daily records
  scrapeStatus: String,    // 'idle', 'pending', 'scraping', 'completed', 'failed'
  scrapeProgress: Number,  // Progress percentage (0-100)
  scrapeError: String,     // Error message if failed
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// - Single: { symbol: 1 } (unique)
// - Single: { isActive: 1 }
// - Single: { scrapeStatus: 1 }
```

---

### 1.2 Historical Data Scraper Service

**Create `backend/src/services/historicalDataScraper.js`:**

Based on your provided script that scrapes from ksestocks.com.

#### **Features:**

- ✅ Scrape specific date range for selected symbols
- ✅ Skip weekends automatically (Saturday/Sunday)
- ✅ Polite rate limiting (2.5 seconds between requests)
- ✅ Upsert logic (update existing or insert new records)
- ✅ Progress tracking and error handling
- ✅ Resume capability if interrupted
- ✅ Batch processing for multiple symbols
- ✅ Validation of scraped data

#### **Key Methods:**

```javascript
class HistoricalDataScraper {
  // Scrape single date for symbol
  async scrapeDate(symbol, date) { }
  
  // Scrape date range for symbol
  async scrapeDateRange(symbol, startDate, endDate, onProgress) { }
  
  // Scrape multiple symbols for date range
  async scrapeSymbols(symbols, startDate, endDate, onProgress) { }
  
  // Scrape today's data for all active symbols
  async scrapeToday() { }
  
  // Resume interrupted scraping job
  async resumeScrape(jobId) { }
  
  // Validate and clean scraped data
  validateData(data) { }
}
```

#### **Data Source:**

- **URL**: `https://www.ksestocks.com/MarketSummary`
- **Method**: POST with form data `sdate=YYYY-MM-DD`
- **Parsing**: Cheerio to extract table rows
- **Target Symbols**: Configurable list (your 100+ symbols)

---

### 1.3 Data Aggregation Service

**Create `backend/src/services/dataAggregationService.js`:**

Converts daily data into weekly and monthly timeframes.

#### **Features:**

- ✅ Generate weekly data from daily records
- ✅ Generate monthly data from daily records
- ✅ Incremental updates when new daily data arrives
- ✅ Recalculate on-demand for specific periods
- ✅ Handle missing data gracefully

#### **Aggregation Logic:**

**Weekly:**
- Group daily records by ISO week number
- Open = Monday's open (or first available day)
- High = Highest high in the week
- Low = Lowest low in the week
- Close = Friday's close (or last available day)
- Volume = Sum of all daily volumes

**Monthly:**
- Group daily records by month
- Open = First day's open
- High = Highest high in the month
- Low = Lowest low in the month
- Close = Last day's close
- Volume = Sum of all daily volumes

#### **Key Methods:**

```javascript
class DataAggregationService {
  // Aggregate daily to weekly for symbol
  async aggregateWeekly(symbol, startDate, endDate) { }
  
  // Aggregate daily to monthly for symbol
  async aggregateMonthly(symbol, startDate, endDate) { }
  
  // Update weekly/monthly when new daily data added
  async updateAggregations(symbol, date) { }
  
  // Recalculate all aggregations for symbol
  async recalculateAll(symbol) { }
  
  // Get OHLCV data for any timeframe
  async getOHLCV(symbol, timeframe, startDate, endDate) { }
}
```

---

## 🎯 **PHASE 2: Backtesting Symbol Management UI**

### 2.1 Frontend Component

**Create `frontend/src/components/BacktestSymbols.jsx`:**

Admin-only interface for managing symbols in the backtesting system.

#### **Features:**

1. **Symbol List Table**
   - Display all backtest symbols
   - Columns: Symbol, Company Name, Sector, Data Range, Records, Status, Actions
   - Status indicators: Active/Inactive, Scrape status badge
   - Sort and filter functionality

2. **Add Symbol Form**
   - Symbol input (auto-uppercase)
   - Company name input
   - Sector dropdown
   - "Add Symbol" button

3. **Bulk Import**
   - CSV upload button
   - Format: `Symbol, Company Name, Sector`
   - Validation and preview before import
   - Progress indicator during import

4. **Remove Symbol**
   - Delete button per symbol
   - Confirmation dialog
   - Option to delete historical data too

5. **Data Status Card**
   - Total symbols
   - Total daily records
   - Date range coverage
   - Last scrape time

6. **Scraping Actions**
   - "Scrape Historical Data" button per symbol
     - Date range picker (from/to)
     - Initial capital input
     - "Start Scraping" button
   - "Scrape All" button for bulk operation
   - Progress bars with live updates via Socket.IO
   - Pause/Resume capability

7. **Data Viewer (Optional)**
   - View historical data for a symbol
   - Mini chart showing price history
   - Export to CSV

#### **UI Design:**

- Gradient header with title and stats
- Card-based layout for symbol list
- Modal dialogs for forms
- Toast notifications for success/errors
- Loading skeletons during data fetch

---

### 2.2 Backend Routes

**Create `backend/src/routes/backtestSymbols.js`:**

RESTful API for backtest symbol management.

```javascript
// Symbol Management
GET    /api/backtest/symbols                    - List all backtest symbols
GET    /api/backtest/symbols/:id                - Get specific symbol details
POST   /api/backtest/symbols                    - Add new symbol
POST   /api/backtest/symbols/bulk               - Bulk add symbols (CSV)
PUT    /api/backtest/symbols/:id                - Update symbol details
DELETE /api/backtest/symbols/:id                - Remove symbol
PUT    /api/backtest/symbols/:id/toggle-active  - Toggle active status

// Scraping Operations
POST   /api/backtest/symbols/:id/scrape         - Trigger scrape for symbol
POST   /api/backtest/symbols/scrape-all         - Scrape all symbols
GET    /api/backtest/scrape-jobs                - List all scrape jobs
GET    /api/backtest/scrape-jobs/:id            - Get job status
POST   /api/backtest/scrape-jobs/:id/pause      - Pause scraping job
POST   /api/backtest/scrape-jobs/:id/resume     - Resume scraping job
DELETE /api/backtest/scrape-jobs/:id            - Cancel scraping job

// Data Statistics
GET    /api/backtest/symbols/:id/stats          - Get data stats (count, range)
GET    /api/backtest/stats/summary              - Overall system stats
GET    /api/backtest/data/daily/:symbol         - Get daily data for symbol
GET    /api/backtest/data/weekly/:symbol        - Get weekly data for symbol
GET    /api/backtest/data/monthly/:symbol       - Get monthly data for symbol
```

#### **Authentication & Authorization:**

- All routes require authentication (`auth` middleware)
- Most routes require admin role (`requireAdmin` middleware)
- Data viewing routes may be available to regular users

---

### 2.3 Scraping Job Management

**Implement background job queue:**

#### **Option 1: Simple In-Memory Queue (For MVP)**

```javascript
class ScrapeJobQueue {
  constructor() {
    this.jobs = new Map();
    this.activeJobs = new Set();
  }
  
  async addJob(symbolId, startDate, endDate) {
    const jobId = uuidv4();
    this.jobs.set(jobId, {
      id: jobId,
      symbolId,
      startDate,
      endDate,
      status: 'pending',
      progress: 0,
      createdAt: new Date()
    });
    
    // Start processing
    this.processJob(jobId);
    return jobId;
  }
  
  async processJob(jobId) {
    // Implementation
  }
  
  pauseJob(jobId) { }
  resumeJob(jobId) { }
  cancelJob(jobId) { }
  getJobStatus(jobId) { }
}
```

#### **Option 2: Bull Queue (For Production)**

```javascript
import Queue from 'bull';

const scrapeQueue = new Queue('scrape-jobs', {
  redis: process.env.REDIS_URL
});

scrapeQueue.process(async (job) => {
  const { symbolId, startDate, endDate } = job.data;
  
  // Scraping logic with progress updates
  await historicalDataScraper.scrapeDateRange(
    symbolId,
    startDate,
    endDate,
    (progress) => {
      job.progress(progress);
    }
  );
});

scrapeQueue.on('completed', (job) => {
  // Notify via Socket.IO
});

scrapeQueue.on('failed', (job, err) => {
  // Log error and notify
});
```

#### **Progress Updates via Socket.IO:**

```javascript
// Emit progress to connected clients
io.to('backtest-admin').emit('scrapeProgress', {
  jobId: job.id,
  symbolId: job.symbolId,
  progress: progress,
  currentDate: date,
  recordsScraped: count
});

// Emit completion
io.to('backtest-admin').emit('scrapeComplete', {
  jobId: job.id,
  symbolId: job.symbolId,
  totalRecords: count,
  duration: duration
});
```

---

## 🎯 **PHASE 3: Technical Indicators Integration**

### 3.1 Choose Indicator Library

#### **Option 1: Tulip Indicators (Recommended)**

**Library**: `tulind`

**Pros:**
- ✅ Very fast (C++ with Node.js bindings)
- ✅ 104+ indicators
- ✅ Well-maintained and battle-tested
- ✅ Used in production by many traders

**Cons:**
- ⚠️ Requires C++ compiler during installation
- ⚠️ May have installation issues on Windows

**Installation:**
```bash
npm install tulind
```

**Common Indicators Available:**
- Moving Averages: SMA, EMA, WMA, DEMA, TEMA, TRIMA
- Momentum: RSI, MACD, Stochastic, CCI, ADX, ROC
- Volatility: Bollinger Bands, ATR, Standard Deviation
- Volume: OBV, AD, CMF
- Others: Fibonacci, Pivot Points, etc.

#### **Option 2: technicalindicators (Alternative)**

**Library**: `technicalindicators`

**Pros:**
- ✅ Pure JavaScript (no compilation needed)
- ✅ Easy to install on all platforms
- ✅ Good documentation with examples
- ✅ TypeScript support

**Cons:**
- ⚠️ Slower than Tulip (but still fast enough)
- ⚠️ Fewer indicators (~40)

**Installation:**
```bash
npm install technicalindicators
```

**Recommendation**: Start with `technicalindicators` for ease of use, switch to `tulind` if performance becomes an issue.

---

### 3.2 Indicator Service

**Create `backend/src/services/indicatorService.js`:**

Centralized service for calculating technical indicators.

#### **Features:**

- ✅ Calculate any indicator for a symbol
- ✅ Support multiple timeframes (daily, weekly, monthly)
- ✅ Cache calculated indicators for performance
- ✅ Batch calculation for multiple indicators
- ✅ Error handling for invalid data

#### **Implementation:**

```javascript
import { SMA, EMA, RSI, MACD, BollingerBands, ATR } from 'technicalindicators';
import dataAggregationService from './dataAggregationService.js';

class IndicatorService {
  constructor() {
    this.cache = new Map(); // Cache indicator results
  }
  
  /**
   * Calculate indicators for a symbol
   * @param {String} symbol - Stock symbol
   * @param {String} timeframe - 'daily', 'weekly', 'monthly'
   * @param {Array} indicators - Array of indicator configs
   * @returns {Object} - Indicator values
   */
  async calculateIndicators(symbol, timeframe = 'daily', indicators = []) {
    // Fetch historical data
    const data = await this.fetchHistoricalData(symbol, timeframe);
    
    if (!data || data.length === 0) {
      throw new Error(`No data available for ${symbol}`);
    }
    
    const results = {};
    
    // Calculate each requested indicator
    for (const indicatorConfig of indicators) {
      const { name, params } = indicatorConfig;
      
      try {
        switch (name.toUpperCase()) {
          case 'SMA':
            results.sma = this.calculateSMA(data.close, params.period);
            break;
            
          case 'EMA':
            results.ema = this.calculateEMA(data.close, params.period);
            break;
            
          case 'RSI':
            results.rsi = this.calculateRSI(data.close, params.period || 14);
            break;
            
          case 'MACD':
            results.macd = this.calculateMACD(
              data.close,
              params.fastPeriod || 12,
              params.slowPeriod || 26,
              params.signalPeriod || 9
            );
            break;
            
          case 'BB':
          case 'BOLLINGER_BANDS':
            results.bollingerBands = this.calculateBollingerBands(
              data.close,
              params.period || 20,
              params.stdDev || 2
            );
            break;
            
          case 'ATR':
            results.atr = this.calculateATR(
              data.high,
              data.low,
              data.close,
              params.period || 14
            );
            break;
            
          // Add more indicators as needed
          
          default:
            console.warn(`Unknown indicator: ${name}`);
        }
      } catch (error) {
        console.error(`Error calculating ${name}:`, error.message);
        results[name.toLowerCase()] = null;
      }
    }
    
    return results;
  }
  
  /**
   * Fetch historical data from database
   */
  async fetchHistoricalData(symbol, timeframe, limit = 500) {
    return await dataAggregationService.getOHLCV(
      symbol,
      timeframe,
      null, // startDate
      null, // endDate
      limit
    );
  }
  
  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(values, period) {
    const result = SMA.calculate({ period, values });
    return this.padArray(result, values.length);
  }
  
  /**
   * Calculate Exponential Moving Average
   */
  calculateEMA(values, period) {
    const result = EMA.calculate({ period, values });
    return this.padArray(result, values.length);
  }
  
  /**
   * Calculate Relative Strength Index
   */
  calculateRSI(values, period) {
    const result = RSI.calculate({ period, values });
    return this.padArray(result, values.length);
  }
  
  /**
   * Calculate MACD
   */
  calculateMACD(values, fastPeriod, slowPeriod, signalPeriod) {
    const result = MACD.calculate({
      values,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
    
    // Extract MACD line, signal line, histogram
    return {
      macd: result.map(r => r.MACD),
      signal: result.map(r => r.signal),
      histogram: result.map(r => r.histogram)
    };
  }
  
  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(values, period, stdDev) {
    const result = BollingerBands.calculate({
      period,
      values,
      stdDev
    });
    
    return {
      upper: result.map(r => r.upper),
      middle: result.map(r => r.middle),
      lower: result.map(r => r.lower)
    };
  }
  
  /**
   * Calculate Average True Range
   */
  calculateATR(high, low, close, period) {
    const result = ATR.calculate({
      high,
      low,
      close,
      period
    });
    return this.padArray(result, high.length);
  }
  
  /**
   * Pad array with nulls to match original data length
   */
  padArray(arr, targetLength) {
    const padding = new Array(targetLength - arr.length).fill(null);
    return [...padding, ...arr];
  }
  
  /**
   * Clear indicator cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default new IndicatorService();
```

---

### 3.3 Strategy Definition Model

**Create `backend/src/models/TradingStrategy.js`:**

Define trading strategies with indicators and conditions.

```javascript
import mongoose from 'mongoose';

const tradingStrategySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  timeframe: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  indicators: [{
    name: {
      type: String,
      required: true
      // e.g., 'SMA', 'RSI', 'MACD', 'BB', 'ATR'
    },
    params: {
      type: mongoose.Schema.Types.Mixed,
      required: true
      // e.g., { period: 20 }, { fastPeriod: 12, slowPeriod: 26 }
    }
  }],
  buyConditions: {
    type: String,
    required: true
    // JavaScript expression or JSON rule
    // e.g., "rsi < 30 && close > sma20"
  },
  sellConditions: {
    type: String,
    required: true
    // e.g., "rsi > 70 || close < sma50"
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  riskManagement: {
    stopLossPercent: {
      type: Number,
      default: null
      // e.g., 5 for 5% stop loss
    },
    takeProfitPercent: {
      type: Number,
      default: null
      // e.g., 10 for 10% take profit
    },
    positionSize: {
      type: Number,
      default: 50
      // Percentage of capital to invest per trade
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
tradingStrategySchema.index({ isActive: 1 });
tradingStrategySchema.index({ createdBy: 1 });

const TradingStrategy = mongoose.model('TradingStrategy', tradingStrategySchema);

export default TradingStrategy;
```

---

## 🎯 **PHASE 4: Trading Signal Generation**

### 4.1 Signal Generation Service

**Create `backend/src/services/signalGeneratorService.js`:**

Generates buy/sell signals based on strategies.

#### **Features:**

- ✅ Evaluate strategy conditions on historical data
- ✅ Evaluate strategy conditions on live data
- ✅ Generate signals for backtesting
- ✅ Generate signals for live trading
- ✅ Support complex conditions with AND/OR logic
- ✅ Safe evaluation of user-defined conditions

#### **Implementation:**

```javascript
import indicatorService from './indicatorService.js';
import dataAggregationService from './dataAggregationService.js';
import TradingSignal from '../models/TradingSignal.js';

class SignalGeneratorService {
  /**
   * Generate signals for backtesting (historical data)
   * @param {String} symbol - Stock symbol
   * @param {Object} strategy - Trading strategy
   * @param {Date} startDate - Backtest start date
   * @param {Date} endDate - Backtest end date
   * @returns {Array} - Array of signals
   */
  async generateHistoricalSignals(symbol, strategy, startDate, endDate) {
    // 1. Fetch historical data
    const data = await dataAggregationService.getOHLCV(
      symbol,
      strategy.timeframe,
      startDate,
      endDate
    );
    
    if (!data || data.length === 0) {
      throw new Error(`No historical data for ${symbol}`);
    }
    
    // 2. Calculate indicators
    const indicators = await indicatorService.calculateIndicators(
      symbol,
      strategy.timeframe,
      strategy.indicators
    );
    
    // 3. Evaluate conditions for each candle
    const signals = [];
    
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      
      // Build context for condition evaluation
      const context = this.buildContext(candle, indicators, i);
      
      // Check if we can evaluate (need enough data for indicators)
      if (!this.hasValidData(context)) {
        continue;
      }
      
      // Evaluate buy condition
      if (this.evaluateCondition(strategy.buyConditions, context)) {
        signals.push({
          date: candle.date,
          type: 'BUY',
          price: candle.close,
          symbol: symbol,
          strategyId: strategy._id,
          strategyName: strategy.name,
          indicators: context,
          isBacktest: true
        });
      }
      
      // Evaluate sell condition
      if (this.evaluateCondition(strategy.sellConditions, context)) {
        signals.push({
          date: candle.date,
          type: 'SELL',
          price: candle.close,
          symbol: symbol,
          strategyId: strategy._id,
          strategyName: strategy.name,
          indicators: context,
          isBacktest: true
        });
      }
    }
    
    return signals;
  }
  
  /**
   * Check for live signals (real-time)
   * @param {String} symbol - Stock symbol
   * @param {Object} strategy - Trading strategy
   * @returns {Object|null} - Signal or null
   */
  async checkLiveSignal(symbol, strategy) {
    // Get latest data (last N candles for indicator calculation)
    const data = await dataAggregationService.getOHLCV(
      symbol,
      strategy.timeframe,
      null,
      null,
      100 // Last 100 candles
    );
    
    if (!data || data.length === 0) {
      return null;
    }
    
    // Calculate indicators
    const indicators = await indicatorService.calculateIndicators(
      symbol,
      strategy.timeframe,
      strategy.indicators
    );
    
    // Get latest candle
    const latestCandle = data[data.length - 1];
    const latestIndex = data.length - 1;
    
    // Build context
    const context = this.buildContext(latestCandle, indicators, latestIndex);
    
    // Check if valid data
    if (!this.hasValidData(context)) {
      return null;
    }
    
    // Evaluate conditions
    let signalType = null;
    
    if (this.evaluateCondition(strategy.buyConditions, context)) {
      signalType = 'BUY';
    } else if (this.evaluateCondition(strategy.sellConditions, context)) {
      signalType = 'SELL';
    }
    
    if (!signalType) {
      return null;
    }
    
    // Create signal
    const signal = {
      date: new Date(),
      type: signalType,
      price: latestCandle.close,
      symbol: symbol,
      strategyId: strategy._id,
      strategyName: strategy.name,
      indicators: context,
      isBacktest: false,
      isExecuted: false
    };
    
    return signal;
  }
  
  /**
   * Build context object for condition evaluation
   */
  buildContext(candle, indicators, index) {
    const context = {
      // Price data
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      price: candle.close, // Alias for close
      
      // Date
      date: candle.date
    };
    
    // Add indicator values at this index
    for (const [key, values] of Object.entries(indicators)) {
      if (Array.isArray(values)) {
        context[key] = values[index];
      } else if (typeof values === 'object') {
        // Handle objects (e.g., MACD, Bollinger Bands)
        context[key] = {};
        for (const [subKey, subValues] of Object.entries(values)) {
          context[key][subKey] = subValues[index];
        }
      }
    }
    
    return context;
  }
  
  /**
   * Check if context has valid data (no nulls)
   */
  hasValidData(context) {
    // Check if critical values are not null
    const criticalKeys = ['open', 'high', 'low', 'close'];
    for (const key of criticalKeys) {
      if (context[key] == null) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Evaluate condition string
   * @param {String} conditionStr - JavaScript expression
   * @param {Object} context - Variable context
   * @returns {Boolean} - Evaluation result
   */
  evaluateCondition(conditionStr, context) {
    try {
      // Create a safe evaluation function
      // WARNING: This is still potentially dangerous with user input
      // Consider using a proper expression evaluator library like expr-eval
      
      // Build variable declarations
      const varDeclarations = Object.keys(context)
        .map(key => `const ${key} = context.${key};`)
        .join('\n');
      
      // Evaluate condition
      const func = new Function('context', `
        ${varDeclarations}
        return (${conditionStr});
      `);
      
      const result = func(context);
      return Boolean(result);
      
    } catch (error) {
      console.error(`Error evaluating condition: ${conditionStr}`, error.message);
      return false;
    }
  }
  
  /**
   * Save signal to database
   */
  async saveSignal(signalData) {
    const signal = new TradingSignal(signalData);
    await signal.save();
    return signal;
  }
}

export default new SignalGeneratorService();
```

---

### 4.2 Trading Signal Model

**Create `backend/src/models/TradingSignal.js`:**

Store generated trading signals.

```javascript
import mongoose from 'mongoose';

const tradingSignalSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  signalType: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL'],
    index: true
  },
  price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  strategyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradingStrategy',
    required: true,
    index: true
  },
  strategyName: {
    type: String,
    required: true
  },
  indicators: {
    type: mongoose.Schema.Types.Mixed,
    // Store indicator values at signal time
    // e.g., { rsi: 28.5, sma20: 150.3, close: 148.2 }
  },
  isBacktest: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  isExecuted: {
    type: Boolean,
    default: false,
    index: true
    // For live signals: has user acted on this?
  },
  executedAt: {
    type: Date,
    default: null
  },
  executedPrice: {
    type: Number,
    default: null
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
tradingSignalSchema.index({ symbol: 1, date: 1 });
tradingSignalSchema.index({ strategyId: 1, isBacktest: 1 });
tradingSignalSchema.index({ signalType: 1, isExecuted: 1 });

const TradingSignal = mongoose.model('TradingSignal', tradingSignalSchema);

export default TradingSignal;
```

---

## 🎯 **PHASE 5: Backtesting Engine**

### 5.1 Backtesting Service

**Create `backend/src/services/backtestingService.js`:**

Simulate trading based on historical signals.

#### **Features:**

- ✅ Simulate trades based on signals
- ✅ Calculate performance metrics
- ✅ Handle position management
- ✅ Apply risk management rules
- ✅ Generate detailed trade log
- ✅ Support multiple position sizing strategies

#### **Implementation:**

```javascript
import signalGeneratorService from './signalGeneratorService.js';
import BacktestResult from '../models/BacktestResult.js';

class BacktestingService {
  /**
   * Run backtest for a strategy on a symbol
   * @param {String} symbol - Stock symbol
   * @param {Object} strategy - Trading strategy
   * @param {Object} config - Backtest configuration
   * @returns {Object} - Backtest results
   */
  async runBacktest(symbol, strategy, config = {}) {
    const {
      startDate,
      endDate,
      initialCapital = 100000,
      positionSizing = 'percentage', // 'percentage' or 'fixed'
      positionSizeValue = 50, // 50% of capital or fixed amount
      commission = 0, // Commission per trade (percentage)
      slippage = 0 // Slippage per trade (percentage)
    } = config;
    
    console.log(`\n🔬 Running backtest: ${strategy.name} on ${symbol}`);
    console.log(`   Period: ${startDate} to ${endDate}`);
    console.log(`   Initial Capital: ${initialCapital}`);
    
    // 1. Generate signals
    const signals = await signalGeneratorService.generateHistoricalSignals(
      symbol,
      strategy,
      startDate,
      endDate
    );
    
    console.log(`   Generated ${signals.length} signals`);
    
    if (signals.length === 0) {
      return this.createEmptyResult(symbol, strategy, config);
    }
    
    // 2. Initialize trading simulation
    let capital = initialCapital;
    let position = 0; // Number of shares held
    let positionEntryPrice = 0;
    const trades = [];
    const equityCurve = [];
    
    // Track metrics
    let totalBuySignals = 0;
    let totalSellSignals = 0;
    let executedBuys = 0;
    let executedSells = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let maxDrawdown = 0;
    let peakEquity = initialCapital;
    
    // 3. Simulate trades
    for (const signal of signals) {
      const currentEquity = capital + (position * signal.price);
      equityCurve.push({
        date: signal.date,
        equity: currentEquity
      });
      
      // Update max drawdown
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      
      // Handle BUY signal
      if (signal.type === 'BUY') {
        totalBuySignals++;
        
        // Only buy if we don't have a position
        if (position === 0 && capital > 0) {
          // Calculate investment amount
          let investmentAmount;
          if (positionSizing === 'percentage') {
            investmentAmount = capital * (positionSizeValue / 100);
          } else {
            investmentAmount = Math.min(positionSizeValue, capital);
          }
          
          // Apply slippage (buy at slightly higher price)
          const buyPrice = signal.price * (1 + slippage / 100);
          
          // Calculate shares to buy
          const shares = Math.floor(investmentAmount / buyPrice);
          
          if (shares > 0) {
            const cost = shares * buyPrice;
            const commissionCost = cost * (commission / 100);
            const totalCost = cost + commissionCost;
            
            // Execute buy
            position = shares;
            positionEntryPrice = buyPrice;
            capital -= totalCost;
            executedBuys++;
            
            trades.push({
              type: 'BUY',
              date: signal.date,
              price: buyPrice,
              shares: shares,
              cost: totalCost,
              commission: commissionCost,
              capitalRemaining: capital,
              indicators: signal.indicators
            });
          }
        }
      }
      
      // Handle SELL signal
      if (signal.type === 'SELL') {
        totalSellSignals++;
        
        // Only sell if we have a position
        if (position > 0) {
          // Apply slippage (sell at slightly lower price)
          const sellPrice = signal.price * (1 - slippage / 100);
          
          const proceeds = position * sellPrice;
          const commissionCost = proceeds * (commission / 100);
          const totalProceeds = proceeds - commissionCost;
          
          // Calculate profit/loss
          const costBasis = position * positionEntryPrice;
          const profitLoss = totalProceeds - costBasis;
          const profitLossPercent = (profitLoss / costBasis) * 100;
          
          // Track wins/losses
          if (profitLoss > 0) {
            winningTrades++;
            totalProfit += profitLoss;
          } else {
            losingTrades++;
            totalLoss += Math.abs(profitLoss);
          }
          
          // Execute sell
          capital += totalProceeds;
          executedSells++;
          
          trades.push({
            type: 'SELL',
            date: signal.date,
            price: sellPrice,
            shares: position,
            proceeds: totalProceeds,
            commission: commissionCost,
            capitalAfter: capital,
            profitLoss: profitLoss,
            profitLossPercent: profitLossPercent,
            indicators: signal.indicators
          });
          
          position = 0;
          positionEntryPrice = 0;
        }
      }
    }
    
    // 4. Close any remaining position at end date
    if (position > 0) {
      const finalPrice = signals[signals.length - 1].price;
      const proceeds = position * finalPrice;
      capital += proceeds;
      
      trades.push({
        type: 'SELL',
        date: endDate,
        price: finalPrice,
        shares: position,
        proceeds: proceeds,
        commission: 0,
        capitalAfter: capital,
        profitLoss: proceeds - (position * positionEntryPrice),
        notes: 'Position closed at end of backtest'
      });
      
      position = 0;
    }
    
    // 5. Calculate final metrics
    const finalEquity = capital;
    const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
    const totalTrades = executedBuys + executedSells;
    const winRate = totalTrades > 0 ? (winningTrades / (winningTrades + losingTrades)) * 100 : 0;
    const avgWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;
    
    // Calculate Sharpe Ratio (simplified)
    const returns = this.calculateReturns(equityCurve);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDevReturn = this.calculateStdDev(returns);
    const sharpeRatio = stdDevReturn > 0 ? (avgReturn / stdDevReturn) * Math.sqrt(252) : 0;
    
    // 6. Create result object
    const result = {
      strategy: {
        id: strategy._id,
        name: strategy.name
      },
      symbol: symbol,
      dateRange: {
        from: startDate,
        to: endDate
      },
      config: {
        initialCapital,
        positionSizing,
        positionSizeValue,
        commission,
        slippage
      },
      signals: {
        totalBuySignals,
        totalSellSignals,
        executedBuys,
        executedSells
      },
      performance: {
        initialCapital,
        finalEquity,
        totalReturn,
        totalReturnPercent: totalReturn,
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        profitFactor,
        avgWin,
        avgLoss,
        maxDrawdown,
        sharpeRatio
      },
      trades,
      equityCurve,
      createdAt: new Date()
    };
    
    console.log(`✅ Backtest complete:`);
    console.log(`   Total Return: ${totalReturn.toFixed(2)}%`);
    console.log(`   Total Trades: ${totalTrades}`);
    console.log(`   Win Rate: ${winRate.toFixed(2)}%`);
    console.log(`   Max Drawdown: ${maxDrawdown.toFixed(2)}%`);
    
    return result;
  }
  
  /**
   * Calculate returns from equity curve
   */
  calculateReturns(equityCurve) {
    const returns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prevEquity = equityCurve[i - 1].equity;
      const currEquity = equityCurve[i].equity;
      const returnPct = ((currEquity - prevEquity) / prevEquity) * 100;
      returns.push(returnPct);
    }
    return returns;
  }
  
  /**
   * Calculate standard deviation
   */
  calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }
  
  /**
   * Create empty result (no signals)
   */
  createEmptyResult(symbol, strategy, config) {
    return {
      strategy: {
        id: strategy._id,
        name: strategy.name
      },
      symbol: symbol,
      dateRange: {
        from: config.startDate,
        to: config.endDate
      },
      config: config,
      signals: {
        totalBuySignals: 0,
        totalSellSignals: 0,
        executedBuys: 0,
        executedSells: 0
      },
      performance: {
        initialCapital: config.initialCapital,
        finalEquity: config.initialCapital,
        totalReturn: 0,
        totalReturnPercent: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        maxDrawdown: 0,
        sharpeRatio: 0
      },
      trades: [],
      equityCurve: [],
      createdAt: new Date()
    };
  }
  
  /**
   * Save backtest result to database
   */
  async saveResult(result) {
    const backtestResult = new BacktestResult(result);
    await backtestResult.save();
    return backtestResult;
  }
}

export default new BacktestingService();
```

---

### 5.2 Backtesting Results Model

**Create `backend/src/models/BacktestResult.js`:**

Store backtest results.

```javascript
import mongoose from 'mongoose';

const backtestResultSchema = new mongoose.Schema({
  strategy: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TradingStrategy',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    }
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  dateRange: {
    from: {
      type: Date,
      required: true
    },
    to: {
      type: Date,
      required: true
    }
  },
  config: {
    initialCapital: Number,
    positionSizing: String,
    positionSizeValue: Number,
    commission: Number,
    slippage: Number
  },
  signals: {
    totalBuySignals: Number,
    totalSellSignals: Number,
    executedBuys: Number,
    executedSells: Number
  },
  performance: {
    initialCapital: Number,
    finalEquity: Number,
    totalReturn: Number,
    totalReturnPercent: Number,
    totalTrades: Number,
    winningTrades: Number,
    losingTrades: Number,
    winRate: Number,
    profitFactor: Number,
    avgWin: Number,
    avgLoss: Number,
    maxDrawdown: Number,
    sharpeRatio: Number
  },
  trades: [{
    type: String, // 'BUY' or 'SELL'
    date: Date,
    price: Number,
    shares: Number,
    cost: Number,
    proceeds: Number,
    commission: Number,
    profitLoss: Number,
    profitLossPercent: Number,
    capitalRemaining: Number,
    capitalAfter: Number,
    indicators: mongoose.Schema.Types.Mixed,
    notes: String
  }],
  equityCurve: [{
    date: Date,
    equity: Number
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
backtestResultSchema.index({ 'strategy.id': 1, symbol: 1 });
backtestResultSchema.index({ createdAt: -1 });
backtestResultSchema.index({ 'performance.totalReturnPercent': -1 });

const BacktestResult = mongoose.model('BacktestResult', backtestResultSchema);

export default BacktestResult;
```

---

## 🎯 **PHASE 6: Live Signal Generation**

### 6.1 Real-Time Signal Detection

**Integrate with existing `centralizedPriceService.js`:**

Add signal checking after price updates.

```javascript
// In backend/src/services/centralizedPriceService.js

import signalGeneratorService from './signalGeneratorService.js';
import TradingStrategy from '../models/TradingStrategy.js';
import TradingSignal from '../models/TradingSignal.js';

class CentralizedPriceService {
  // ... existing code ...
  
  async checkPrices(skipMarketCheck = false) {
    // ... existing price fetch logic ...
    
    // After updating Stock model, check for new signals
    if (stocksUpdated > 0) {
      await this.checkForNewSignals(activeSymbols);
    }
    
    return result;
  }
  
  /**
   * Check for new trading signals on updated symbols
   */
  async checkForNewSignals(symbols) {
    try {
      // Get all active strategies
      const activeStrategies = await TradingStrategy.find({ isActive: true });
      
      if (activeStrategies.length === 0) {
        return;
      }
      
      console.log(`🔍 Checking for signals with ${activeStrategies.length} strategies...`);
      
      const newSignals = [];
      
      for (const symbol of symbols) {
        for (const strategy of activeStrategies) {
          try {
            // Check if signal was already generated recently
            const recentSignal = await TradingSignal.findOne({
              symbol,
              strategyId: strategy._id,
              isBacktest: false,
              createdAt: {
                $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            });
            
            // Skip if signal already generated today
            if (recentSignal) {
              continue;
            }
            
            // Generate signal for current data
            const signal = await signalGeneratorService.checkLiveSignal(symbol, strategy);
            
            if (signal) {
              // Save signal to database
              const savedSignal = await signalGeneratorService.saveSignal(signal);
              newSignals.push(savedSignal);
              
              console.log(`📢 NEW SIGNAL: ${signal.type} ${signal.symbol} @ ${signal.price} (${strategy.name})`);
            }
          } catch (error) {
            console.error(`Error checking signal for ${symbol} with ${strategy.name}:`, error.message);
          }
        }
      }
      
      // Notify via Socket.IO
      if (newSignals.length > 0) {
        this.notifyHandlers({
          type: 'tradingSignals',
          data: {
            count: newSignals.length,
            signals: newSignals
          }
        });
      }
      
    } catch (error) {
      console.error('Error checking for new signals:', error.message);
    }
  }
}
```

---

### 6.2 Signal Notification System

**Enhance Socket.IO in `backend/src/index.js`:**

```javascript
// Socket.IO setup
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  // ... existing handlers ...
  
  // Subscribe to trading signals
  socket.on('subscribeTradingSignals', () => {
    socket.join('trading-signals');
    console.log(`📢 Client ${socket.id} subscribed to trading signals`);
  });
  
  // Unsubscribe from trading signals
  socket.on('unsubscribeTradingSignals', () => {
    socket.leave('trading-signals');
    console.log(`📢 Client ${socket.id} unsubscribed from trading signals`);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Broadcast trading signals
centralizedPriceService.onUpdate((data) => {
  if (data.type === 'tradingSignals') {
    io.to('trading-signals').emit('newTradingSignal', data.data);
    
    // Also broadcast to all connected clients (for notifications)
    io.emit('tradingSignalNotification', {
      count: data.data.count,
      timestamp: new Date()
    });
  }
  
  // ... existing handlers ...
});
```

---

## 🎯 **PHASE 7: Frontend for Signals & Backtesting**

### 7.1 Strategy Management UI

**Create `frontend/src/components/TradingStrategies.jsx`:**

Interface for creating and managing trading strategies.

#### **Features:**

1. **Strategy List**
   - Card-based layout
   - Show name, description, timeframe, status
   - Active/Inactive toggle
   - Edit, Delete, Test buttons

2. **Create/Edit Strategy Form**
   - Strategy name input
   - Description textarea
   - Timeframe selector (Daily/Weekly/Monthly)
   - Indicator Builder:
     - Add multiple indicators
     - Configure parameters for each
     - Visual preview of indicator formula
   - Condition Builder:
     - Buy condition input (JavaScript or visual)
     - Sell condition input
     - Syntax validation
     - Example conditions
   - Risk Management:
     - Stop loss percentage
     - Take profit percentage
     - Position size percentage
   - Save, Cancel buttons

3. **Test Strategy Modal**
   - Quick backtest form
   - Symbol input
   - Date range picker
   - Run button
   - Results preview

#### **Example Conditions:**

```javascript
// Buy Conditions
"rsi < 30 && close > sma20"
"sma20 > sma50 && rsi < 40"
"close > bollingerBands.upper && volume > 1000000"

// Sell Conditions
"rsi > 70 || close < sma50"
"macd.histogram < 0 && rsi > 60"
"close < bollingerBands.lower"
```

---

### 7.2 Backtesting UI

**Create `frontend/src/components/Backtesting.jsx`:**

Interface for running and viewing backtests.

#### **Features:**

1. **Backtest Configuration Panel**
   - Strategy selector (dropdown)
   - Symbol input (autocomplete)
   - Date range picker (from/to)
   - Initial capital input
   - Position sizing selector
   - Commission input (%)
   - Slippage input (%)
   - "Run Backtest" button (with loading state)

2. **Results Display**
   - **Performance Metrics Card:**
     - Total Return (with color coding)
     - Total Trades
     - Win Rate
     - Profit Factor
     - Max Drawdown
     - Sharpe Ratio
     - Avg Win / Avg Loss
   
   - **Equity Curve Chart:**
     - Line chart showing equity over time
     - X-axis: Date
     - Y-axis: Equity
     - Highlight buy/sell points
     - Use Chart.js or Recharts
   
   - **Trade History Table:**
     - Columns: Date, Type, Price, Shares, P/L, P/L %
     - Sortable and filterable
     - Pagination for large datasets
     - Export to CSV button

3. **Historical Backtests**
   - List of previous backtests
   - Sort by date, return, win rate
   - View details button
   - Delete button
   - Compare button (compare 2+ strategies)

4. **Strategy Comparison**
   - Select multiple strategies
   - Run on same symbol/period
   - Side-by-side metrics comparison
   - Overlay equity curves

---

### 7.3 Live Signals Dashboard

**Create `frontend/src/components/TradingSignals.jsx`:**

Interface for viewing and managing live trading signals.

#### **Features:**

1. **Signal Feed (Real-time)**
   - Card-based layout
   - Each signal card shows:
     - Symbol (large, clickable)
     - Signal Type (BUY/SELL with color coding)
     - Price
     - Strategy name
     - Key indicator values
     - Timestamp (relative, e.g., "2 minutes ago")
     - "Mark as Executed" button
     - "Add to Trade Plan" button
   - Auto-update via Socket.IO
   - Sound notification on new signal (optional)
   - Browser notification (with permission)

2. **Filters & Controls**
   - Filter by symbol (multi-select)
   - Filter by strategy (multi-select)
   - Filter by signal type (BUY/SELL/ALL)
   - Filter by executed status
   - Date range filter
   - Clear filters button

3. **Signal Statistics**
   - Total signals today
   - BUY vs SELL ratio
   - Executed vs Pending
   - By strategy breakdown

4. **Signal History Table**
   - Paginated list of all signals
   - Columns: Date, Symbol, Type, Price, Strategy, Status
   - Sort by any column
   - Export to CSV

5. **Actions**
   - Mark signal as executed
     - Opens modal to input executed price
     - Calculates slippage
   - Add to existing trade plan
   - Create new trade plan from signal
   - Ignore/dismiss signal

#### **Socket.IO Integration:**

```javascript
// In frontend/src/components/TradingSignals.jsx

import { useEffect, useState } from 'react';
import socket from '../services/socket';

function TradingSignals() {
  const [signals, setSignals] = useState([]);
  const [newSignalCount, setNewSignalCount] = useState(0);
  
  useEffect(() => {
    // Subscribe to trading signals
    socket.emit('subscribeTradingSignals');
    
    // Listen for new signals
    socket.on('newTradingSignal', (data) => {
      setSignals(prev => [data, ...prev]);
      setNewSignalCount(prev => prev + 1);
      
      // Show notification
      showNotification(data);
      
      // Play sound (optional)
      playNotificationSound();
    });
    
    // Cleanup
    return () => {
      socket.emit('unsubscribeTradingSignals');
      socket.off('newTradingSignal');
    };
  }, []);
  
  // ... rest of component
}
```

---

## 🎯 **PHASE 8: Continuous Data Updates**

### 8.1 End-of-Day Data Update

**Enhance existing scraper to save to historical database:**

```javascript
// In backend/src/services/historicalDataScraper.js

async scrapeToday() {
  const today = dayjs().format('YYYY-MM-DD');
  const todayStart = new Date();
  
  console.log(`📅 Running end-of-day scrape for ${today}...`);
  
  // Get all active backtest symbols
  const symbols = await BacktestSymbol.find({ isActive: true }).distinct('symbol');
  
  if (symbols.length === 0) {
    console.log('⚠️ No active symbols to scrape');
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const symbol of symbols) {
    try {
      // Scrape today's data
      const data = await this.scrapeDate(symbol, today);
      
      if (data) {
        // Save to PsxDaily collection
        await PsxDaily.findOneAndUpdate(
          { symbol, date: data.date },
          data,
          { upsert: true, new: true }
        );
        
        successCount++;
      }
      
      // Polite delay
      await this.delay(2500);
      
    } catch (error) {
      console.error(`❌ Failed to scrape ${symbol}:`, error.message);
      failCount++;
    }
  }
  
  console.log(`✅ End-of-day scrape complete: ${successCount} success, ${failCount} failed`);
  
  // Update weekly and monthly aggregations
  await dataAggregationService.updateAggregations(symbols, new Date());
  
  // Trigger signal generation for all strategies
  await this.checkAllStrategiesAfterUpdate();
}

async checkAllStrategiesAfterUpdate() {
  const activeStrategies = await TradingStrategy.find({ isActive: true });
  const symbols = await BacktestSymbol.find({ isActive: true }).distinct('symbol');
  
  console.log(`🔍 Checking signals for ${activeStrategies.length} strategies across ${symbols.length} symbols...`);
  
  // Use signal generator service
  // (This will be called automatically by centralizedPriceService)
}
```

---

### 8.2 Scheduled Jobs

**Create `backend/src/services/scheduledJobs.js`:**

Use `node-cron` for scheduling automated tasks.

```javascript
import cron from 'node-cron';
import historicalDataScraper from './historicalDataScraper.js';
import dataAggregationService from './dataAggregationService.js';

class ScheduledJobs {
  constructor() {
    this.jobs = [];
  }
  
  /**
   * Initialize all scheduled jobs
   */
  init() {
    console.log('\n📅 Initializing scheduled jobs...');
    
    // Job 1: End-of-day data scrape
    // Run at 5:00 PM PKT (after market close at 4:30 PM)
    const eodJob = cron.schedule('0 17 * * 1-5', async () => {
      console.log('\n📊 [SCHEDULED] Running end-of-day data scrape...');
      try {
        await historicalDataScraper.scrapeToday();
      } catch (error) {
        console.error('❌ End-of-day scrape failed:', error.message);
      }
    }, {
      timezone: 'Asia/Karachi'
    });
    
    this.jobs.push({ name: 'End-of-Day Scrape', job: eodJob });
    
    // Job 2: Weekly aggregation update
    // Run every Saturday at 1:00 AM
    const weeklyJob = cron.schedule('0 1 * * 6', async () => {
      console.log('\n📊 [SCHEDULED] Updating weekly aggregations...');
      try {
        const symbols = await BacktestSymbol.find({ isActive: true }).distinct('symbol');
        for (const symbol of symbols) {
          await dataAggregationService.aggregateWeekly(symbol, null, null);
        }
      } catch (error) {
        console.error('❌ Weekly aggregation failed:', error.message);
      }
    }, {
      timezone: 'Asia/Karachi'
    });
    
    this.jobs.push({ name: 'Weekly Aggregation', job: weeklyJob });
    
    // Job 3: Monthly aggregation update
    // Run on 1st of every month at 2:00 AM
    const monthlyJob = cron.schedule('0 2 1 * *', async () => {
      console.log('\n📊 [SCHEDULED] Updating monthly aggregations...');
      try {
        const symbols = await BacktestSymbol.find({ isActive: true }).distinct('symbol');
        for (const symbol of symbols) {
          await dataAggregationService.aggregateMonthly(symbol, null, null);
        }
      } catch (error) {
        console.error('❌ Monthly aggregation failed:', error.message);
      }
    }, {
      timezone: 'Asia/Karachi'
    });
    
    this.jobs.push({ name: 'Monthly Aggregation', job: monthlyJob });
    
    // Job 4: Cleanup old signals
    // Run daily at 3:00 AM
    const cleanupJob = cron.schedule('0 3 * * *', async () => {
      console.log('\n🧹 [SCHEDULED] Cleaning up old signals...');
      try {
        // Delete backtest signals older than 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await TradingSignal.deleteMany({
          isBacktest: true,
          createdAt: { $lt: thirtyDaysAgo }
        });
        console.log(`   Deleted ${result.deletedCount} old backtest signals`);
      } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
      }
    }, {
      timezone: 'Asia/Karachi'
    });
    
    this.jobs.push({ name: 'Signal Cleanup', job: cleanupJob });
    
    console.log(`✅ ${this.jobs.length} scheduled jobs initialized`);
  }
  
  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    console.log('\n🛑 Stopping all scheduled jobs...');
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`   Stopped: ${name}`);
    });
  }
  
  /**
   * Get status of all jobs
   */
  getStatus() {
    return this.jobs.map(({ name, job }) => ({
      name,
      isRunning: job.running
    }));
  }
}

export default new ScheduledJobs();
```

**Initialize in `backend/src/index.js`:**

```javascript
import scheduledJobs from './services/scheduledJobs.js';

// After server starts
scheduledJobs.init();

// Graceful shutdown
process.on('SIGTERM', () => {
  scheduledJobs.stopAll();
  // ... other cleanup
});
```

---

## 🗂️ **IMPLEMENTATION ORDER (Recommended Sequence)**

### **Sprint 1: Data Foundation** (Week 1-2)
**Goal**: Historical data storage infrastructure

1. ✅ Create `PsxDaily.js` model
2. ✅ Create `PsxWeekly.js` model
3. ✅ Create `PsxMonthly.js` model
4. ✅ Create `BacktestSymbol.js` model
5. ✅ Implement `historicalDataScraper.js` service
6. ✅ Implement `dataAggregationService.js` service
7. ✅ Test scraping with small date ranges (1 month)
8. ✅ Test weekly/monthly aggregation
9. ✅ Validate data integrity

**Deliverables**: Working historical data scraper with database storage

---

### **Sprint 2: Symbol Management UI** (Week 2-3)
**Goal**: Admin interface for managing backtest symbols

10. ✅ Create `BacktestSymbols.jsx` component (frontend)
11. ✅ Create `backend/src/routes/backtestSymbols.js`
12. ✅ Implement symbol CRUD operations
13. ✅ Implement scraping job queue (simple in-memory)
14. ✅ Add progress tracking via Socket.IO
15. ✅ Add bulk CSV upload
16. ✅ Test with 5-10 symbols
17. ✅ Add data viewer modal
18. ✅ Update navigation to include new page

**Deliverables**: Functional UI for managing symbols and triggering scrapes

---

### **Sprint 3: Indicators & Strategy** (Week 3-4)
**Goal**: Technical indicator calculation and strategy definition

19. ✅ Install `technicalindicators` package
20. ✅ Implement `indicatorService.js`
21. ✅ Test indicator calculations with sample data
22. ✅ Create `TradingStrategy.js` model
23. ✅ Create `TradingStrategies.jsx` component (frontend)
24. ✅ Create `backend/src/routes/tradingStrategies.js`
25. ✅ Implement strategy CRUD operations
26. ✅ Build condition evaluator
27. ✅ Add strategy form validation
28. ✅ Test with 2-3 simple strategies (SMA crossover, RSI)

**Deliverables**: Working indicator service and strategy management UI

---

### **Sprint 4: Signal Generation** (Week 4-5)
**Goal**: Generate buy/sell signals from strategies

29. ✅ Create `TradingSignal.js` model
30. ✅ Implement `signalGeneratorService.js`
31. ✅ Test signal generation on historical data
32. ✅ Validate condition evaluation
33. ✅ Create signal routes
34. ✅ Add signal preview in strategy form
35. ✅ Test with multiple strategies and symbols

**Deliverables**: Working signal generation for backtesting

---

### **Sprint 5: Backtesting Engine** (Week 5-6)
**Goal**: Simulate trading and calculate performance

36. ✅ Create `BacktestResult.js` model
37. ✅ Implement `backtestingService.js`
38. ✅ Create `Backtesting.jsx` component (frontend)
39. ✅ Create backtest routes
40. ✅ Implement trade simulation logic
41. ✅ Calculate performance metrics
42. ✅ Add equity curve chart (Chart.js)
43. ✅ Build trade history table
44. ✅ Run test backtests and validate results
45. ✅ Add result export functionality

**Deliverables**: Complete backtesting system with visualization

---

### **Sprint 6: Live Signals** (Week 6-7)
**Goal**: Real-time signal generation and notifications

46. ✅ Integrate signal checking in `centralizedPriceService.js`
47. ✅ Create `TradingSignals.jsx` component (frontend)
48. ✅ Implement Socket.IO signal broadcasting
49. ✅ Add browser notifications
50. ✅ Add signal action handlers (mark as executed, etc.)
51. ✅ Implement signal routes
52. ✅ Test real-time signal flow
53. ✅ Add signal history and filtering

**Deliverables**: Live signal dashboard with real-time updates

---

### **Sprint 7: Automation & Polish** (Week 7-8)
**Goal**: Scheduled jobs, optimization, and refinement

54. ✅ Implement `scheduledJobs.js` service
55. ✅ Add end-of-day data scraping job
56. ✅ Add weekly/monthly aggregation jobs
57. ✅ Add cleanup jobs
58. ✅ Performance optimization (caching, indexing)
59. ✅ Error handling improvements
60. ✅ Add comprehensive logging
61. ✅ Write documentation
62. ✅ Add unit tests (optional but recommended)
63. ✅ UI/UX polish and refinements
64. ✅ Final integration testing

**Deliverables**: Production-ready system with automation

---

## 📦 **NEW DEPENDENCIES TO ADD**

### Backend (`backend/package.json`)

```json
{
  "dependencies": {
    "technicalindicators": "^3.1.0",
    "node-cron": "^3.0.3",
    "dayjs": "^1.11.10",
    "mathjs": "^12.0.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

**Optional (for production):**
```json
{
  "dependencies": {
    "bull": "^4.12.0",
    "ioredis": "^5.3.2",
    "tulind": "^0.8.17"
  }
}
```

### Frontend (`frontend/package.json`)

```json
{
  "dependencies": {
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0",
    "date-fns": "^2.30.0",
    "react-datepicker": "^4.21.0"
  }
}
```

---

## 🔐 **SECURITY & PERFORMANCE CONSIDERATIONS**

### Security

1. **Condition Evaluation Safety**
   - User-defined conditions are evaluated using `new Function()`
   - ⚠️ **Risk**: Potential code injection
   - **Mitigation**: 
     - Sanitize input
     - Use expression parser library (e.g., `expr-eval`)
     - Run in sandboxed environment
     - Limit allowed operators and functions

2. **Rate Limiting**
   - Respect ksestocks.com rate limits (2.5s delay minimum)
   - Add exponential backoff on errors
   - Use queue for large scraping jobs

3. **Access Control**
   - Only admins can create/edit strategies
   - Only admins can run backtests (resource-intensive)
   - Regular users can view signals

4. **Data Validation**
   - Validate indicator parameters (period > 0, etc.)
   - Validate date ranges
   - Validate symbol existence

### Performance

1. **Database Indexing**
   - Compound indexes on `(symbol, date)` for fast queries
   - Index on `isActive`, `createdAt` for filtering
   - Monitor slow queries with MongoDB profiler

2. **Caching**
   - Cache indicator calculations (LRU cache)
   - Cache aggregated data (Redis if needed)
   - Cache strategy results

3. **Pagination**
   - Paginate historical data queries
   - Limit results to 500-1000 records by default
   - Use cursor-based pagination for large datasets

4. **Background Processing**
   - Run backtests in background (queue)
   - Run large scrapes in background
   - Provide progress updates via Socket.IO

5. **Query Optimization**
   - Use projection to limit returned fields
   - Use lean() for read-only queries
   - Aggregate at database level when possible

6. **Memory Management**
   - Stream large datasets instead of loading all
   - Clean up old backtest results periodically
   - Limit concurrent scraping jobs

---

## 📊 **ESTIMATED TIMELINE**

### Development Time

- **Phase 1-2**: 2-3 weeks (Data infrastructure + UI)
- **Phase 3-4**: 2-3 weeks (Indicators + Signal generation)
- **Phase 5**: 1-2 weeks (Backtesting engine)
- **Phase 6**: 1-2 weeks (Live signals)
- **Phase 7**: 1-2 weeks (Frontend polish)
- **Phase 8**: 1 week (Automation)

**Total: 8-12 weeks** for full implementation

### Scraping Time

For 100 symbols over 1 year (252 trading days):
- 100 symbols × 252 days = 25,200 requests
- At 2.5 seconds per request = 63,000 seconds = **~17.5 hours**
- Recommended: Scrape over multiple days or use parallel scrapers

---

## 🎯 **SUCCESS METRICS**

### Data Quality
1. ✅ Successfully scrape 1+ year of historical data for 100+ symbols
2. ✅ <1% data gaps or errors
3. ✅ Weekly/monthly aggregations match daily data

### Performance
4. ✅ Calculate 10+ technical indicators in <5 seconds
5. ✅ Run backtest (1 year, 1 strategy) in <30 seconds
6. ✅ Generate live signals within 5 seconds of price update
7. ✅ Support 10+ concurrent backtests

### Functionality
8. ✅ Create and test 5+ trading strategies
9. ✅ Generate accurate buy/sell signals
10. ✅ Calculate standard performance metrics (return, win rate, etc.)
11. ✅ End-of-day updates complete within 30 minutes

### User Experience
12. ✅ Achieve >80% signal notification success rate
13. ✅ Intuitive strategy builder interface
14. ✅ Clear backtest result visualization
15. ✅ Real-time updates without page refresh

---

## 🚨 **RISKS & MITIGATION**

### Risk 1: Data Source Reliability
**Problem**: ksestocks.com may be unreliable or change structure

**Mitigation**:
- Implement robust error handling and retries
- Add fallback data sources
- Regular monitoring and alerts
- Store raw HTML for debugging

### Risk 2: Performance Issues with Large Datasets
**Problem**: Backtests on years of data may be slow

**Mitigation**:
- Implement caching
- Use database aggregation
- Run heavy operations in background
- Optimize indicator calculations

### Risk 3: Complex Strategy Conditions
**Problem**: Users may create invalid or dangerous conditions

**Mitigation**:
- Input validation and sanitization
- Use safe expression evaluator
- Provide templates and examples
- Test mode before activating

### Risk 4: Data Storage Growth
**Problem**: Historical data may consume significant storage

**Mitigation**:
- Implement data retention policies
- Compress old data
- Archive inactive symbols
- Monitor disk usage

### Risk 5: Signal Accuracy
**Problem**: Generated signals may not be profitable

**Mitigation**:
- Clearly label as informational only
- Add disclaimer about past performance
- Provide comprehensive backtesting
- Allow extensive strategy testing

---

## 📚 **ADDITIONAL RESOURCES**

### Technical Indicators
- [Investopedia - Technical Indicators](https://www.investopedia.com/terms/t/technicalindicator.asp)
- [TradingView - Indicators](https://www.tradingview.com/scripts/indicators/)
- [technicalindicators.js Docs](https://github.com/anandanand84/technicalindicators)

### Backtesting
- [Investopedia - Backtesting](https://www.investopedia.com/terms/b/backtesting.asp)
- [QuantStart - Backtesting](https://www.quantstart.com/articles/Backtesting-Systematic-Trading-Strategies-in-Python-Considerations-and-Open-Source-Frameworks/)

### Chart Libraries
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [Recharts Documentation](https://recharts.org/)

---

## 🔄 **ITERATIVE APPROACH**

This plan follows an **agile, iterative approach**:

1. **Build core functionality first** (data + indicators)
2. **Test with minimal features** (1-2 strategies)
3. **Get feedback and iterate**
4. **Add advanced features gradually**
5. **Optimize based on usage patterns**

Each sprint delivers a **working, testable increment**.

---

## ✅ **NEXT STEPS**

### Immediate Actions

1. **Review this plan** with stakeholders
2. **Prioritize phases** based on business needs
3. **Set up project tracking** (Trello, Jira, etc.)
4. **Create Git branch** for development
5. **Start Sprint 1** - Historical data models

### Questions to Answer

1. Which indicator library to use? (technicalindicators vs tulind)
2. Job queue needed? (Bull vs simple in-memory)
3. How many symbols to support initially?
4. How much historical data needed? (1 year, 5 years?)
5. Budget for cloud storage/compute?

---

## 📝 **DOCUMENT VERSION HISTORY**

- **v1.0** (2025-10-21): Initial comprehensive plan created

---

**End of Document**

This plan provides a complete roadmap for implementing the trading signals and backtesting system. We can proceed phase by phase, testing and validating each component before moving to the next. 🚀


