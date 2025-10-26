# 🤖 Complete Trading Bot System - Technical Guide

**Project**: PSX SmartDesk - Automated Trading Bot with Backtesting  
**Version**: 2.0  
**Date**: October 26, 2025  
**Status**: Technical Implementation Guide

---

## 📌 **DOCUMENT PURPOSE**

This is the **complete technical reference** for implementing:
1. **Historical Data Collection** - Scraping and storing years of PSX data
2. **Backtesting System** - Testing strategies against historical data
3. **Live Trading Bot** - Real-time signal generation with smart TP/SL
4. **Support/Resistance Detection** - Barry's fractal-based S/R algorithm
5. **Signal Notification** - Real-time alerts via Socket.IO

**Use this document for**: Implementation details, code examples, algorithms, database schemas.  
**Use MASTER_PLAN.md for**: Strategic planning, phase sequencing, priorities.

---

## 🎯 **SYSTEM OVERVIEW**

### **What This System Does**

```
┌─────────────────────────────────────────────────────────────┐
│             COMPLETE TRADING BOT ARCHITECTURE               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣ HISTORICAL DATA FOUNDATION                             │
│     • Scrape years of PSX data (ksestocks.com)            │
│     • Store daily, weekly, monthly OHLCV                   │
│     • 100+ symbols, 250+ days/year                         │
│                                                             │
│  2️⃣ BACKTESTING ENGINE                                     │
│     • Test strategies on historical data                   │
│     • Calculate 10+ performance metrics                    │
│     • Find strategies with 65%+ win rate                   │
│                                                             │
│  3️⃣ LIVE TRADING BOT                                       │
│     • Monitor 100+ stocks every 5 minutes                  │
│     • Detect signals (EMA, RSI, MACD, etc.)               │
│     • Calculate smart TP/SL using S/R detection           │
│     • Generate actionable trade recommendations            │
│                                                             │
│  4️⃣ SMART TP/SL SYSTEM                                     │
│     • Support/Resistance detection (Barry's fractals)      │
│     • Intelligent target calculation                       │
│     • Fibonacci fallback when no S/R found                 │
│     • Risk/Reward validation                               │
│                                                             │
│  5️⃣ NOTIFICATION SYSTEM                                    │
│     • Real-time Socket.IO broadcasts                       │
│     • Push notifications (PWA - see separate doc)          │
│     • Signal history and tracking                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### **Key Principle**

> **Data First, Bot Second** - Never deploy a trading bot without validating strategies on historical data first.

---

## 📊 **PART 1: HISTORICAL DATA INFRASTRUCTURE**

### **Why Historical Data is Critical**

Without historical data, you cannot:
- ❌ Test if your strategies actually work
- ❌ Optimize indicator parameters
- ❌ Calculate realistic performance metrics
- ❌ Understand risk (drawdown, win rate)
- ❌ Build confidence before going live

With historical data, you can:
- ✅ Backtest 10 strategies, find 2 winners
- ✅ Optimize EMA periods (9 vs 12 vs 21)
- ✅ See actual win rate, profit factor, drawdown
- ✅ Deploy bot with proven strategies only

---

### **1.1 Database Models**

#### **Model: PsxDaily.js** - Daily OHLCV Data

```javascript
import mongoose from 'mongoose';

const psxDailySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  open: {
    type: Number,
    required: true
  },
  high: {
    type: Number,
    required: true
  },
  low: {
    type: Number,
    required: true
  },
  close: {
    type: Number,
    required: true
  },
  change: {
    type: Number,
    default: 0
  },
  volume: {
    type: Number,
    default: 0
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

// CRITICAL: Compound index for fast queries
psxDailySchema.index({ symbol: 1, date: 1 }, { unique: true });
psxDailySchema.index({ date: 1 });

const PsxDaily = mongoose.model('PsxDaily', psxDailySchema);

export default PsxDaily;
```

#### **Model: PsxWeekly.js** - Weekly Aggregated Data

```javascript
import mongoose from 'mongoose';

const psxWeeklySchema = new mongoose.Schema({
  weekStartDate: {
    type: Date,
    required: true,
    index: true
  },
  weekEndDate: {
    type: Date,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  weekNumber: {
    type: Number,
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  open: Number,
  high: Number,
  low: Number,
  close: Number,
  volume: Number,
  change: Number,
  changePercent: Number,
  createdAt: Date,
  updatedAt: Date
}, {
  timestamps: true
});

psxWeeklySchema.index({ symbol: 1, weekStartDate: 1 }, { unique: true });
psxWeeklySchema.index({ symbol: 1, year: 1, weekNumber: 1 });

const PsxWeekly = mongoose.model('PsxWeekly', psxWeeklySchema);

export default PsxWeekly;
```

#### **Model: PsxMonthly.js** - Monthly Aggregated Data

```javascript
import mongoose from 'mongoose';

const psxMonthlySchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    index: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    index: true
  },
  monthStartDate: Date,
  monthEndDate: Date,
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  open: Number,
  high: Number,
  low: Number,
  close: Number,
  volume: Number,
  change: Number,
  changePercent: Number,
  createdAt: Date,
  updatedAt: Date
}, {
  timestamps: true
});

psxMonthlySchema.index({ symbol: 1, year: 1, month: 1 }, { unique: true });

const PsxMonthly = mongoose.model('PsxMonthly', psxMonthlySchema);

export default PsxMonthly;
```

#### **Model: BacktestSymbol.js** - Symbol Management

```javascript
import mongoose from 'mongoose';

const backtestSymbolSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  sector: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  dataFrom: {
    type: Date
  },
  dataTo: {
    type: Date
  },
  lastScraped: {
    type: Date
  },
  totalRecords: {
    type: Number,
    default: 0
  },
  scrapeStatus: {
    type: String,
    enum: ['idle', 'pending', 'scraping', 'completed', 'failed'],
    default: 'idle',
    index: true
  },
  scrapeProgress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  scrapeError: {
    type: String
  },
  createdAt: Date,
  updatedAt: Date
}, {
  timestamps: true
});

const BacktestSymbol = mongoose.model('BacktestSymbol', backtestSymbolSchema);

export default BacktestSymbol;
```

---

### **1.2 Historical Data Scraper Service**

**File**: `backend/src/services/historicalDataScraper.js`

```javascript
import axios from 'axios';
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import PsxDaily from '../models/PsxDaily.js';
import BacktestSymbol from '../models/BacktestSymbol.js';

class HistoricalDataScraper {
  constructor() {
    this.baseUrl = 'https://www.ksestocks.com/MarketSummary';
    this.minDelay = 2500; // 2.5 seconds between requests
    this.lastRequestTime = 0;
  }

  /**
   * Scrape single date for a symbol
   * @param {String} symbol - Stock symbol
   * @param {String} date - Date in YYYY-MM-DD format
   * @returns {Object} - Scraped data or null
   */
  async scrapeDate(symbol, date) {
    try {
      // Rate limiting
      await this.respectRateLimit();

      console.log(`Fetching ${symbol} for ${date}...`);

      // POST request to ksestocks.com
      const response = await axios.post(this.baseUrl, `sdate=${date}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 20000
      });

      // Parse HTML
      const $ = cheerio.load(response.data);
      const rows = $('tr.data-tr');

      let foundData = null;

      rows.each((_, row) => {
        const cols = $(row).find('td.plain');
        if (cols.length >= 8) {
          const rowSymbol = $(cols[0]).text().trim().toUpperCase();
          
          if (rowSymbol === symbol.toUpperCase()) {
            const open = parseFloat($(cols[2]).text().replace(/,/g, ''));
            const high = parseFloat($(cols[3]).text().replace(/,/g, ''));
            const low = parseFloat($(cols[4]).text().replace(/,/g, ''));
            const close = parseFloat($(cols[5]).text().replace(/,/g, ''));
            const change = parseFloat($(cols[6]).text().replace(/,/g, ''));
            const volume = parseFloat($(cols[7]).text().replace(/,/g, ''));

            if (!isNaN(open) && !isNaN(close)) {
              foundData = {
                date: new Date(date),
                symbol: symbol.toUpperCase(),
                open,
                high,
                low,
                close,
                change,
                volume
              };
            }
          }
        }
      });

      return foundData;

    } catch (error) {
      console.error(`Error scraping ${symbol} for ${date}:`, error.message);
      return null;
    }
  }

  /**
   * Scrape date range for a symbol
   * @param {String} symbol - Stock symbol
   * @param {String} startDate - Start date (YYYY-MM-DD)
   * @param {String} endDate - End date (YYYY-MM-DD)
   * @param {Function} onProgress - Progress callback
   */
  async scrapeDateRange(symbol, startDate, endDate, onProgress) {
    let current = dayjs(startDate);
    const end = dayjs(endDate);
    const totalDays = end.diff(current, 'day') + 1;
    let scrapedCount = 0;
    let savedCount = 0;

    while (current.isBefore(end) || current.isSame(end)) {
      const day = current.day(); // 0 = Sunday, 6 = Saturday

      // Skip weekends
      if (day !== 0 && day !== 6) {
        const dateStr = current.format('YYYY-MM-DD');
        const data = await this.scrapeDate(symbol, dateStr);

        if (data) {
          // Upsert to database
          await PsxDaily.findOneAndUpdate(
            { symbol: data.symbol, date: data.date },
            data,
            { upsert: true, new: true }
          );
          savedCount++;
        }

        scrapedCount++;

        // Progress callback
        if (onProgress) {
          const progress = Math.round((scrapedCount / totalDays) * 100);
          onProgress(progress, dateStr, savedCount);
        }
      }

      current = current.add(1, 'day');
    }

    return { scrapedCount, savedCount };
  }

  /**
   * Scrape today's data for all active symbols
   */
  async scrapeToday() {
    const today = dayjs().format('YYYY-MM-DD');
    console.log(`📅 Scraping today's data (${today})...`);

    const symbols = await BacktestSymbol.find({ isActive: true }).select('symbol');
    
    let successCount = 0;
    let failCount = 0;

    for (const { symbol } of symbols) {
      const data = await this.scrapeDate(symbol, today);
      
      if (data) {
        await PsxDaily.findOneAndUpdate(
          { symbol: data.symbol, date: data.date },
          data,
          { upsert: true, new: true }
        );
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(`✅ Today's scrape complete: ${successCount} success, ${failCount} failed`);
    return { successCount, failCount };
  }

  /**
   * Rate limiting helper
   */
  async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minDelay) {
      const delay = this.minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Validate scraped data
   */
  validateData(data) {
    if (!data) return false;
    if (!data.symbol || !data.date) return false;
    if (data.open <= 0 || data.high <= 0 || data.low <= 0 || data.close <= 0) return false;
    if (data.high < data.low) return false;
    if (data.high < data.open || data.high < data.close) return false;
    if (data.low > data.open || data.low > data.close) return false;
    return true;
  }
}

export default new HistoricalDataScraper();
```

---

### **1.3 Data Aggregation Service**

**File**: `backend/src/services/dataAggregationService.js`

```javascript
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import PsxDaily from '../models/PsxDaily.js';
import PsxWeekly from '../models/PsxWeekly.js';
import PsxMonthly from '../models/PsxMonthly.js';

dayjs.extend(isoWeek);

class DataAggregationService {
  /**
   * Aggregate daily data to weekly
   * @param {String} symbol - Stock symbol
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   */
  async aggregateWeekly(symbol, startDate, endDate) {
    const query = { symbol: symbol.toUpperCase() };
    if (startDate) query.date = { $gte: startDate };
    if (endDate) query.date = { ...query.date, $lte: endDate };

    const dailyData = await PsxDaily.find(query).sort({ date: 1 }).lean();

    if (dailyData.length === 0) {
      return [];
    }

    // Group by week
    const weeklyGroups = {};

    for (const record of dailyData) {
      const date = dayjs(record.date);
      const weekStart = date.startOf('isoWeek');
      const weekEnd = date.endOf('isoWeek');
      const year = date.year();
      const weekNumber = date.isoWeek();
      
      const weekKey = `${year}-W${weekNumber}`;

      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = {
          weekStartDate: weekStart.toDate(),
          weekEndDate: weekEnd.toDate(),
          year,
          weekNumber,
          symbol: symbol.toUpperCase(),
          records: []
        };
      }

      weeklyGroups[weekKey].records.push(record);
    }

    // Calculate OHLCV for each week
    const weeklyData = [];

    for (const weekKey in weeklyGroups) {
      const week = weeklyGroups[weekKey];
      const records = week.records;

      if (records.length === 0) continue;

      const open = records[0].open;
      const close = records[records.length - 1].close;
      const high = Math.max(...records.map(r => r.high));
      const low = Math.min(...records.map(r => r.low));
      const volume = records.reduce((sum, r) => sum + r.volume, 0);
      const change = close - open;
      const changePercent = ((change / open) * 100).toFixed(2);

      const weeklyRecord = {
        weekStartDate: week.weekStartDate,
        weekEndDate: week.weekEndDate,
        year: week.year,
        weekNumber: week.weekNumber,
        symbol: week.symbol,
        open,
        high,
        low,
        close,
        volume,
        change,
        changePercent: parseFloat(changePercent)
      };

      // Upsert to database
      await PsxWeekly.findOneAndUpdate(
        { symbol: week.symbol, weekStartDate: week.weekStartDate },
        weeklyRecord,
        { upsert: true, new: true }
      );

      weeklyData.push(weeklyRecord);
    }

    return weeklyData;
  }

  /**
   * Aggregate daily data to monthly
   * @param {String} symbol - Stock symbol
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   */
  async aggregateMonthly(symbol, startDate, endDate) {
    const query = { symbol: symbol.toUpperCase() };
    if (startDate) query.date = { $gte: startDate };
    if (endDate) query.date = { ...query.date, $lte: endDate };

    const dailyData = await PsxDaily.find(query).sort({ date: 1 }).lean();

    if (dailyData.length === 0) {
      return [];
    }

    // Group by month
    const monthlyGroups = {};

    for (const record of dailyData) {
      const date = dayjs(record.date);
      const year = date.year();
      const month = date.month() + 1; // dayjs months are 0-indexed
      const monthStart = date.startOf('month');
      const monthEnd = date.endOf('month');
      
      const monthKey = `${year}-${month}`;

      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = {
          year,
          month,
          monthStartDate: monthStart.toDate(),
          monthEndDate: monthEnd.toDate(),
          symbol: symbol.toUpperCase(),
          records: []
        };
      }

      monthlyGroups[monthKey].records.push(record);
    }

    // Calculate OHLCV for each month
    const monthlyData = [];

    for (const monthKey in monthlyGroups) {
      const monthGroup = monthlyGroups[monthKey];
      const records = monthGroup.records;

      if (records.length === 0) continue;

      const open = records[0].open;
      const close = records[records.length - 1].close;
      const high = Math.max(...records.map(r => r.high));
      const low = Math.min(...records.map(r => r.low));
      const volume = records.reduce((sum, r) => sum + r.volume, 0);
      const change = close - open;
      const changePercent = ((change / open) * 100).toFixed(2);

      const monthlyRecord = {
        year: monthGroup.year,
        month: monthGroup.month,
        monthStartDate: monthGroup.monthStartDate,
        monthEndDate: monthGroup.monthEndDate,
        symbol: monthGroup.symbol,
        open,
        high,
        low,
        close,
        volume,
        change,
        changePercent: parseFloat(changePercent)
      };

      // Upsert to database
      await PsxMonthly.findOneAndUpdate(
        { symbol: monthGroup.symbol, year: monthGroup.year, month: monthGroup.month },
        monthlyRecord,
        { upsert: true, new: true }
      );

      monthlyData.push(monthlyRecord);
    }

    return monthlyData;
  }

  /**
   * Get OHLCV data for any timeframe
   * @param {String} symbol - Stock symbol
   * @param {String} timeframe - 'daily', 'weekly', 'monthly'
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   * @param {Number} limit - Limit number of records (optional)
   * @returns {Object} - { dates, open, high, low, close, volume }
   */
  async getOHLCV(symbol, timeframe = 'daily', startDate, endDate, limit) {
    let Model;
    let dateField;

    switch (timeframe.toLowerCase()) {
      case 'weekly':
        Model = PsxWeekly;
        dateField = 'weekStartDate';
        break;
      case 'monthly':
        Model = PsxMonthly;
        dateField = 'monthStartDate';
        break;
      case 'daily':
      default:
        Model = PsxDaily;
        dateField = 'date';
        break;
    }

    const query = { symbol: symbol.toUpperCase() };
    if (startDate || endDate) {
      query[dateField] = {};
      if (startDate) query[dateField].$gte = startDate;
      if (endDate) query[dateField].$lte = endDate;
    }

    let queryBuilder = Model.find(query).sort({ [dateField]: 1 });
    if (limit) queryBuilder = queryBuilder.limit(limit);

    const data = await queryBuilder.lean();

    if (data.length === 0) {
      return {
        dates: [],
        open: [],
        high: [],
        low: [],
        close: [],
        volume: []
      };
    }

    return {
      dates: data.map(d => d[dateField]),
      open: data.map(d => d.open),
      high: data.map(d => d.high),
      low: data.map(d => d.low),
      close: data.map(d => d.close),
      volume: data.map(d => d.volume)
    };
  }

  /**
   * Update aggregations when new daily data is added
   */
  async updateAggregations(symbols, date) {
    console.log(`🔄 Updating aggregations for ${symbols.length} symbols...`);

    for (const symbol of symbols) {
      try {
        // Update weekly
        const weekStart = dayjs(date).startOf('isoWeek').toDate();
        const weekEnd = dayjs(date).endOf('isoWeek').toDate();
        await this.aggregateWeekly(symbol, weekStart, weekEnd);

        // Update monthly
        const monthStart = dayjs(date).startOf('month').toDate();
        const monthEnd = dayjs(date).endOf('month').toDate();
        await this.aggregateMonthly(symbol, monthStart, monthEnd);
      } catch (error) {
        console.error(`Error updating aggregations for ${symbol}:`, error.message);
      }
    }

    console.log(`✅ Aggregations updated`);
  }
}

export default new DataAggregationService();
```

---

## 📊 **PART 2: SUPPORT/RESISTANCE DETECTION (Barry's Method)**

### **What is Barry's Fractal Method?**

A fractal is a candle where price reversed - a clear turning point. Barry's method identifies these pivot points as potential support/resistance levels.

**Fractal Rules:**

**Resistance (High Fractal)**:
- Take a candle's HIGH
- Look X candles to the left
- Look X candles to the right
- If this HIGH is the HIGHEST in entire window → Resistance

**Support (Low Fractal)**:
- Take a candle's LOW
- Look X candles to the left  
- Look X candles to the right
- If this LOW is the LOWEST in entire window → Support

**Parameters**:
- FractalLength = 10 (moderate sensitivity)
- Window size = 10 left + 10 right + 1 center = 21 candles

---

### **2.1 S/R Detection Service**

**File**: `backend/src/services/srDetectionService.js`

```javascript
class SRDetectionService {
  constructor() {
    this.fractalLength = 10; // Default window size
  }

  /**
   * Detect support and resistance levels using Barry's fractal method
   * @param {Array} candles - Array of {high, low, close, date} objects
   * @param {Number} fractalLength - Window size (default 10)
   * @returns {Object} - {supports: [], resistances: []}
   */
  detectSupportResistance(candles, fractalLength = this.fractalLength) {
    if (candles.length < fractalLength * 2 + 1) {
      return { supports: [], resistances: [] };
    }

    const supports = [];
    const resistances = [];

    // Loop through candles (skip first and last fractalLength candles)
    for (let i = fractalLength; i < candles.length - fractalLength; i++) {
      const currentCandle = candles[i];

      // Check for resistance (high fractal)
      let isResistance = true;
      for (let j = i - fractalLength; j <= i + fractalLength; j++) {
        if (j !== i && candles[j].high >= currentCandle.high) {
          isResistance = false;
          break;
        }
      }

      if (isResistance) {
        resistances.push({
          price: currentCandle.high,
          index: i,
          date: currentCandle.date,
          strength: this.calculateStrength(candles, i, currentCandle.high, 'resistance')
        });
      }

      // Check for support (low fractal)
      let isSupport = true;
      for (let j = i - fractalLength; j <= i + fractalLength; j++) {
        if (j !== i && candles[j].low <= currentCandle.low) {
          isSupport = false;
          break;
        }
      }

      if (isSupport) {
        supports.push({
          price: currentCandle.low,
          index: i,
          date: currentCandle.date,
          strength: this.calculateStrength(candles, i, currentCandle.low, 'support')
        });
      }
    }

    return { supports, resistances };
  }

  /**
   * Calculate strength of S/R level (how many times price touched it)
   */
  calculateStrength(candles, pivotIndex, pivotPrice, type = 'resistance') {
    const tolerance = pivotPrice * 0.005; // 0.5% tolerance
    let strength = 1; // The pivot itself

    for (let i = 0; i < candles.length; i++) {
      if (i === pivotIndex) continue;

      const candle = candles[i];
      const testPrice = type === 'resistance' ? candle.high : candle.low;

      // Check if price touched this level
      if (Math.abs(testPrice - pivotPrice) <= tolerance) {
        strength++;
      }
    }

    return strength;
  }

  /**
   * Filter S/R levels to remove duplicates/clusters
   * @param {Array} levels - Array of S/R levels
   * @param {Number} clusterTolerance - % tolerance for clustering (default 0.5%)
   */
  filterClusters(levels, clusterTolerance = 0.5) {
    if (levels.length === 0) return [];

    // Sort by price
    const sorted = [...levels].sort((a, b) => a.price - b.price);
    const filtered = [];

    let currentCluster = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const priceDiff = Math.abs(curr.price - prev.price);
      const threshold = prev.price * (clusterTolerance / 100);

      if (priceDiff <= threshold) {
        // Same cluster
        currentCluster.push(curr);
      } else {
        // New cluster - consolidate previous cluster
        filtered.push(this.consolidateCluster(currentCluster));
        currentCluster = [curr];
      }
    }

    // Add last cluster
    if (currentCluster.length > 0) {
      filtered.push(this.consolidateCluster(currentCluster));
    }

    return filtered;
  }

  /**
   * Consolidate cluster into single level (weighted by strength)
   */
  consolidateCluster(cluster) {
    if (cluster.length === 1) return cluster[0];

    // Use strongest level as representative
    const strongest = cluster.reduce((max, level) => 
      level.strength > max.strength ? level : max
    , cluster[0]);

    // Calculate weighted average price
    const totalStrength = cluster.reduce((sum, l) => sum + l.strength, 0);
    const avgPrice = cluster.reduce((sum, l) => sum + (l.price * l.strength), 0) / totalStrength;

    return {
      price: avgPrice,
      index: strongest.index,
      date: strongest.date,
      strength: totalStrength
    };
  }

  /**
   * Find nearest S/R levels above/below current price
   */
  findNearestLevels(currentPrice, supports, resistances, maxDistance = 0.20) {
    // Find resistances above current price (within 20%)
    const nearestResistances = resistances
      .filter(r => r.price > currentPrice)
      .filter(r => (r.price - currentPrice) / currentPrice <= maxDistance)
      .sort((a, b) => a.price - b.price);

    // Find supports below current price (within 20%)
    const nearestSupports = supports
      .filter(s => s.price < currentPrice)
      .filter(s => (currentPrice - s.price) / currentPrice <= maxDistance)
      .sort((a, b) => b.price - a.price);

    return {
      resistancesAbove: nearestResistances,
      supportsBelow: nearestSupports
    };
  }
}

export default new SRDetectionService();
```

---

### **2.2 Smart TP/SL Calculator**

**File**: `backend/src/services/tpslCalculatorService.js`

```javascript
import srDetectionService from './srDetectionService.js';

class TPSLCalculatorService {
  constructor() {
    this.config = {
      tp: {
        preferResistance: true,
        minDistance: 2, // Min % gain for TP
        maxDistance: 25, // Max % gain for TP
        minStrength: 2, // Min touches for valid resistance
        fibLevels: [0.382, 0.618, 0.786] // Fibonacci retracement levels
      },
      sl: {
        preferSupport: true,
        belowSupportBuffer: 0.5, // Place SL 0.5% below support
        maxLoss: 5, // Max % loss allowed
        minLoss: 1, // Min % loss (avoid too tight)
        atrMultiplier: 1.5, // ATR × 1.5 for dynamic SL
        fallbackPercent: 2 // Default 2% loss if no support
      },
      risk: {
        minRiskReward: 1, // Min R:R ratio to accept signal
        preferredRiskReward: 1.5 // Preferred R:R ratio
      }
    };
  }

  /**
   * Calculate smart TP/SL for a trade signal
   * @param {Number} entryPrice - Entry price for the trade
   * @param {String} signalType - 'BUY' or 'SELL'
   * @param {Array} candles - Historical candles for S/R detection
   * @param {Object} options - Optional config overrides
   * @returns {Object} - {tp1, tp2, tp3, stopLoss, reasoning}
   */
  async calculate(entryPrice, signalType, candles, options = {}) {
    const config = { ...this.config, ...options };

    // Detect S/R levels
    const { supports, resistances } = srDetectionService.detectSupportResistance(candles);
    const filteredSupports = srDetectionService.filterClusters(supports);
    const filteredResistances = srDetectionService.filterClusters(resistances);

    // Find nearest levels
    const { resistancesAbove, supportsBelow } = srDetectionService.findNearestLevels(
      entryPrice,
      filteredSupports,
      filteredResistances
    );

    let result;

    if (signalType === 'BUY') {
      result = this.calculateBuyTPSL(entryPrice, resistancesAbove, supportsBelow, candles, config);
    } else {
      result = this.calculateSellTPSL(entryPrice, resistancesAbove, supportsBelow, candles, config);
    }

    return result;
  }

  /**
   * Calculate TP/SL for BUY signal
   */
  calculateBuyTPSL(entryPrice, resistancesAbove, supportsBelow, candles, config) {
    const result = {
      entry: entryPrice,
      tp1: null,
      tp2: null,
      tp3: null,
      stopLoss: null,
      reasoning: {
        tp1: null,
        tp2: null,
        tp3: null,
        stopLoss: null
      },
      riskReward: null
    };

    // Calculate Take Profits
    const tpLevels = this.calculateTakeProfits(
      entryPrice,
      resistancesAbove,
      candles,
      config.tp,
      'BUY'
    );

    result.tp1 = tpLevels[0]?.price || null;
    result.tp2 = tpLevels[1]?.price || null;
    result.tp3 = tpLevels[2]?.price || null;
    result.reasoning.tp1 = tpLevels[0]?.reason || null;
    result.reasoning.tp2 = tpLevels[1]?.reason || null;
    result.reasoning.tp3 = tpLevels[2]?.reason || null;

    // Calculate Stop Loss
    const slData = this.calculateStopLoss(
      entryPrice,
      supportsBelow,
      candles,
      config.sl,
      'BUY'
    );

    result.stopLoss = slData.price;
    result.reasoning.stopLoss = slData.reason;

    // Calculate Risk/Reward
    if (result.tp1 && result.stopLoss) {
      const risk = entryPrice - result.stopLoss;
      const reward = result.tp1 - entryPrice;
      result.riskReward = (reward / risk).toFixed(2);
    }

    return result;
  }

  /**
   * Calculate TP/SL for SELL signal
   */
  calculateSellTPSL(entryPrice, resistancesAbove, supportsBelow, candles, config) {
    const result = {
      entry: entryPrice,
      tp1: null,
      tp2: null,
      tp3: null,
      stopLoss: null,
      reasoning: {
        tp1: null,
        tp2: null,
        tp3: null,
        stopLoss: null
      },
      riskReward: null
    };

    // For SELL, TPs are below (use supports)
    const tpLevels = this.calculateTakeProfits(
      entryPrice,
      supportsBelow,
      candles,
      config.tp,
      'SELL'
    );

    result.tp1 = tpLevels[0]?.price || null;
    result.tp2 = tpLevels[1]?.price || null;
    result.tp3 = tpLevels[2]?.price || null;
    result.reasoning.tp1 = tpLevels[0]?.reason || null;
    result.reasoning.tp2 = tpLevels[1]?.reason || null;
    result.reasoning.tp3 = tpLevels[2]?.reason || null;

    // For SELL, SL is above (use resistances)
    const slData = this.calculateStopLoss(
      entryPrice,
      resistancesAbove,
      candles,
      config.sl,
      'SELL'
    );

    result.stopLoss = slData.price;
    result.reasoning.stopLoss = slData.reason;

    // Calculate Risk/Reward
    if (result.tp1 && result.stopLoss) {
      const risk = result.stopLoss - entryPrice;
      const reward = entryPrice - result.tp1;
      result.riskReward = (reward / risk).toFixed(2);
    }

    return result;
  }

  /**
   * Calculate take profit levels
   */
  calculateTakeProfits(entryPrice, srLevels, candles, config, signalType) {
    const tps = [];

    // Try to use S/R levels first
    if (config.preferResistance && srLevels.length > 0) {
      for (const level of srLevels) {
        const distance = Math.abs((level.price - entryPrice) / entryPrice) * 100;

        // Check if within acceptable range
        if (distance >= config.minDistance && distance <= config.maxDistance) {
          // Check strength
          if (level.strength >= config.minStrength) {
            tps.push({
              price: level.price,
              reason: `${signalType === 'BUY' ? 'Resistance' : 'Support'} zone (strength: ${level.strength})`,
              distance: distance.toFixed(2) + '%'
            });

            if (tps.length >= 3) break;
          }
        }
      }
    }

    // Fill remaining TPs with Fibonacci levels if needed
    if (tps.length < 3) {
      const fibLevels = this.calculateFibonacciLevels(candles, signalType);
      
      for (const fibLevel of fibLevels) {
        const distance = Math.abs((fibLevel.price - entryPrice) / entryPrice) * 100;

        if (distance >= config.minDistance && distance <= config.maxDistance) {
          tps.push({
            price: fibLevel.price,
            reason: `Fibonacci ${fibLevel.level}`,
            distance: distance.toFixed(2) + '%'
          });

          if (tps.length >= 3) break;
        }
      }
    }

    return tps;
  }

  /**
   * Calculate stop loss
   */
  calculateStopLoss(entryPrice, srLevels, candles, config, signalType) {
    // Try to use S/R level first
    if (config.preferSupport && srLevels.length > 0) {
      const nearest = srLevels[0];
      const buffer = nearest.price * (config.belowSupportBuffer / 100);
      const slPrice = signalType === 'BUY' 
        ? nearest.price - buffer 
        : nearest.price + buffer;

      const distance = Math.abs((slPrice - entryPrice) / entryPrice) * 100;

      // Validate SL is within acceptable range
      if (distance >= config.minLoss && distance <= config.maxLoss) {
        return {
          price: slPrice,
          reason: `Below ${signalType === 'BUY' ? 'support' : 'resistance'} (strength: ${nearest.strength})`
        };
      }
    }

    // Fallback to fixed percentage
    const fallbackSL = signalType === 'BUY'
      ? entryPrice * (1 - config.fallbackPercent / 100)
      : entryPrice * (1 + config.fallbackPercent / 100);

    return {
      price: fallbackSL,
      reason: `${config.fallbackPercent}% fixed stop loss`
    };
  }

  /**
   * Calculate Fibonacci retracement levels
   */
  calculateFibonacciLevels(candles, signalType) {
    if (candles.length < 20) return [];

    // Find swing high and low in last 50 candles
    const recentCandles = candles.slice(-50);
    const swingHigh = Math.max(...recentCandles.map(c => c.high));
    const swingLow = Math.min(...recentCandles.map(c => c.low));
    const range = swingHigh - swingLow;

    const fibLevels = this.config.tp.fibLevels;
    const levels = [];

    for (const level of fibLevels) {
      let price;
      if (signalType === 'BUY') {
        // For BUY, Fib levels are above (retracement from high)
        price = swingLow + (range * level);
      } else {
        // For SELL, Fib levels are below (retracement from low)
        price = swingHigh - (range * level);
      }

      levels.push({
        price,
        level: (level * 100).toFixed(1) + '%'
      });
    }

    return levels;
  }
}

export default new TPSLCalculatorService();
```

---

## 🤖 **PART 3: LIVE TRADING BOT**

### **3.1 Strategy Models**

#### **TradingStrategy Model**

```javascript
import mongoose from 'mongoose';

const tradingStrategySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  timeframe: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  indicators: [{
    name: String, // 'SMA', 'EMA', 'RSI', 'MACD'
    params: mongoose.Schema.Types.Mixed // { period: 20 }
  }],
  buyConditions: {
    type: String,
    required: true
    // "rsi < 30 && close > sma20"
  },
  sellConditions: {
    type: String,
    required: true
    // "rsi > 70 || close < sma50"
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  riskManagement: {
    stopLossPercent: Number,
    takeProfitPercent: Number,
    positionSize: {
      type: Number,
      default: 50 // 50% of capital per trade
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

tradingStrategySchema.index({ isActive: 1 });
tradingStrategySchema.index({ createdBy: 1 });

const TradingStrategy = mongoose.model('TradingStrategy', tradingStrategySchema);

export default TradingStrategy;
```

#### **TradingSignal Model**

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
  strategyName: String,
  
  // Smart TP/SL data
  tp1: Number,
  tp2: Number,
  tp3: Number,
  stopLoss: Number,
  reasoning: {
    tp1: String,
    tp2: String,
    tp3: String,
    stopLoss: String
  },
  riskReward: Number,
  
  // Indicator values at signal time
  indicators: mongoose.Schema.Types.Mixed,
  
  isBacktest: {
    type: Boolean,
    default: false,
    index: true
  },
  isExecuted: {
    type: Boolean,
    default: false,
    index: true
  },
  executedAt: Date,
  executedPrice: Number,
  notes: String
}, {
  timestamps: true
});

tradingSignalSchema.index({ symbol: 1, date: 1 });
tradingSignalSchema.index({ strategyId: 1, isBacktest: 1 });

const TradingSignal = mongoose.model('TradingSignal', tradingSignalSchema);

export default TradingSignal;
```

---

### **3.2 Live Signal Generation**

**File**: `backend/src/services/liveSignalGeneratorService.js`

```javascript
import TradingStrategy from '../models/TradingStrategy.js';
import TradingSignal from '../models/TradingSignal.js';
import Stock from '../models/Stock.js';
import PsxDaily from '../models/PsxDaily.js';
import indicatorService from './indicatorService.js';
import tpslCalculatorService from './tpslCalculatorService.js';

class LiveSignalGeneratorService {
  /**
   * Check for new signals across all active strategies
   * @param {Array} symbols - List of symbols to check
   */
  async checkAllSymbols(symbols) {
    const activeStrategies = await TradingStrategy.find({ isActive: true });

    if (activeStrategies.length === 0) {
      return [];
    }

    console.log(`🔍 Checking ${symbols.length} symbols with ${activeStrategies.length} strategies...`);

    const newSignals = [];

    for (const symbol of symbols) {
      for (const strategy of activeStrategies) {
        try {
          // Check if signal already generated recently (last 24 hours)
          const recentSignal = await TradingSignal.findOne({
            symbol,
            strategyId: strategy._id,
            isBacktest: false,
            createdAt: {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          });

          if (recentSignal) {
            continue; // Skip if already generated
          }

          // Check for signal
          const signal = await this.checkSignal(symbol, strategy);

          if (signal) {
            // Calculate smart TP/SL
            const candles = await this.getRecentCandles(symbol, 100);
            const currentPrice = await this.getCurrentPrice(symbol);

            const tpsl = await tpslCalculatorService.calculate(
              currentPrice,
              signal.type,
              candles
            );

            // Save signal with TP/SL
            const savedSignal = await TradingSignal.create({
              ...signal,
              ...tpsl,
              isBacktest: false,
              isExecuted: false
            });

            newSignals.push(savedSignal);

            console.log(`📢 NEW SIGNAL: ${signal.type} ${symbol} @ ${currentPrice} | TP1: ${tpsl.tp1} | SL: ${tpsl.stopLoss}`);
          }
        } catch (error) {
          console.error(`Error checking ${symbol} with ${strategy.name}:`, error.message);
        }
      }
    }

    return newSignals;
  }

  /**
   * Check single symbol against single strategy
   */
  async checkSignal(symbol, strategy) {
    // Get recent historical data
    const candles = await this.getRecentCandles(symbol, 100);

    if (candles.length < 50) {
      return null; // Not enough data
    }

    // Calculate indicators
    const indicators = await indicatorService.calculateIndicators(
      symbol,
      strategy.timeframe,
      strategy.indicators
    );

    // Get latest values
    const latestIndex = candles.length - 1;
    const latestCandle = candles[latestIndex];

    // Build context for condition evaluation
    const context = this.buildContext(latestCandle, indicators, latestIndex);

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

    return {
      symbol: symbol.toUpperCase(),
      signalType,
      price: latestCandle.close,
      date: new Date(),
      strategyId: strategy._id,
      strategyName: strategy.name,
      indicators: context
    };
  }

  /**
   * Build context object for condition evaluation
   */
  buildContext(candle, indicators, index) {
    const context = {
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      price: candle.close,
      date: candle.date
    };

    // Add indicator values
    for (const [key, values] of Object.entries(indicators)) {
      if (Array.isArray(values)) {
        context[key] = values[index];
      } else if (typeof values === 'object') {
        context[key] = {};
        for (const [subKey, subValues] of Object.entries(values)) {
          context[key][subKey] = subValues[index];
        }
      }
    }

    return context;
  }

  /**
   * Evaluate condition string safely
   */
  evaluateCondition(conditionStr, context) {
    try {
      const varDeclarations = Object.keys(context)
        .map(key => `const ${key} = context.${key};`)
        .join('\n');

      const func = new Function('context', `
        ${varDeclarations}
        return (${conditionStr});
      `);

      return Boolean(func(context));
    } catch (error) {
      console.error(`Error evaluating condition: ${conditionStr}`, error.message);
      return false;
    }
  }

  /**
   * Get recent candles for a symbol
   */
  async getRecentCandles(symbol, limit = 100) {
    const candles = await PsxDaily.find({ symbol: symbol.toUpperCase() })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return candles.reverse(); // Oldest to newest
  }

  /**
   * Get current price from Stock model
   */
  async getCurrentPrice(symbol) {
    const stock = await Stock.findOne({ symbol: symbol.toUpperCase() });
    return stock?.currentPrice || null;
  }
}

export default new LiveSignalGeneratorService();
```

---

### **3.3 Integration with Price Monitoring**

**Update `backend/src/services/centralizedPriceService.js`:**

```javascript
import liveSignalGeneratorService from './liveSignalGeneratorService.js';

class CentralizedPriceService {
  // ... existing code ...

  async checkPrices(skipMarketCheck = false) {
    // ... existing price fetch logic ...

    // After updating Stock model, check for signals
    if (stocksUpdated > 0) {
      await this.checkForNewSignals(activeSymbols);
    }

    return result;
  }

  /**
   * Check for new trading signals
   */
  async checkForNewSignals(symbols) {
    try {
      const newSignals = await liveSignalGeneratorService.checkAllSymbols(symbols);

      if (newSignals.length > 0) {
        // Notify via Socket.IO
        this.notifyHandlers({
          type: 'tradingSignals',
          data: {
            count: newSignals.length,
            signals: newSignals
          }
        });
      }
    } catch (error) {
      console.error('Error checking for signals:', error.message);
    }
  }
}
```

---

## 📊 **PART 4: BACKTESTING ENGINE**

### **4.1 Backtesting Service**

**File**: `backend/src/services/backtestingService.js`

```javascript
import signalGeneratorService from './signalGeneratorService.js';
import BacktestResult from '../models/BacktestResult.js';

class BacktestingService {
  async runBacktest(symbol, strategy, config = {}) {
    const {
      startDate,
      endDate,
      initialCapital = 100000,
      positionSizing = 'percentage',
      positionSizeValue = 50,
      commission = 0,
      slippage = 0
    } = config;

    console.log(`\n🔬 Running backtest: ${strategy.name} on ${symbol}`);
    console.log(`   Period: ${startDate} to ${endDate}`);
    console.log(`   Initial Capital: Rs ${initialCapital.toLocaleString()}`);

    // 1. Generate historical signals
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

    // 2. Initialize simulation
    let capital = initialCapital;
    let position = 0;
    let positionEntryPrice = 0;
    const trades = [];
    const equityCurve = [];

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

        if (position === 0 && capital > 0) {
          let investmentAmount = positionSizing === 'percentage'
            ? capital * (positionSizeValue / 100)
            : Math.min(positionSizeValue, capital);

          const buyPrice = signal.price * (1 + slippage / 100);
          const shares = Math.floor(investmentAmount / buyPrice);

          if (shares > 0) {
            const cost = shares * buyPrice;
            const commissionCost = cost * (commission / 100);
            const totalCost = cost + commissionCost;

            position = shares;
            positionEntryPrice = buyPrice;
            capital -= totalCost;
            executedBuys++;

            trades.push({
              type: 'BUY',
              date: signal.date,
              price: buyPrice,
              shares,
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

        if (position > 0) {
          const sellPrice = signal.price * (1 - slippage / 100);
          const proceeds = position * sellPrice;
          const commissionCost = proceeds * (commission / 100);
          const totalProceeds = proceeds - commissionCost;

          const costBasis = position * positionEntryPrice;
          const profitLoss = totalProceeds - costBasis;
          const profitLossPercent = (profitLoss / costBasis) * 100;

          if (profitLoss > 0) {
            winningTrades++;
            totalProfit += profitLoss;
          } else {
            losingTrades++;
            totalLoss += Math.abs(profitLoss);
          }

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
            profitLoss,
            profitLossPercent,
            indicators: signal.indicators
          });

          position = 0;
          positionEntryPrice = 0;
        }
      }
    }

    // 4. Close remaining position
    if (position > 0) {
      const finalPrice = signals[signals.length - 1].price;
      capital += position * finalPrice;
      position = 0;
    }

    // 5. Calculate metrics
    const finalEquity = capital;
    const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
    const totalTrades = executedBuys + executedSells;
    const winRate = totalTrades > 0 ? (winningTrades / (winningTrades + losingTrades)) * 100 : 0;
    const avgWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

    const returns = this.calculateReturns(equityCurve);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDevReturn = this.calculateStdDev(returns);
    const sharpeRatio = stdDevReturn > 0 ? (avgReturn / stdDevReturn) * Math.sqrt(252) : 0;

    const result = {
      strategy: {
        id: strategy._id,
        name: strategy.name
      },
      symbol,
      dateRange: { from: startDate, to: endDate },
      config: { initialCapital, positionSizing, positionSizeValue, commission, slippage },
      signals: { totalBuySignals, totalSellSignals, executedBuys, executedSells },
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
    console.log(`   Win Rate: ${winRate.toFixed(2)}%`);
    console.log(`   Profit Factor: ${profitFactor.toFixed(2)}`);
    console.log(`   Max Drawdown: ${maxDrawdown.toFixed(2)}%`);

    return result;
  }

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

  calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  createEmptyResult(symbol, strategy, config) {
    return {
      strategy: { id: strategy._id, name: strategy.name },
      symbol,
      dateRange: { from: config.startDate, to: config.endDate },
      config,
      signals: { totalBuySignals: 0, totalSellSignals: 0, executedBuys: 0, executedSells: 0 },
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

  async saveResult(result) {
    const backtestResult = new BacktestResult(result);
    await backtestResult.save();
    return backtestResult;
  }
}

export default new BacktestingService();
```

---

## 📈 **PART 5: CHART VISUALIZATION SYSTEM**

### **Why Chart Visualization is Critical**

Visual confirmation that S/R calculations and TP/SL levels are correct and make sense.

### **5.1 What User Should See on Chart**

```
Chart Display:

Price Scale (Right side)
95.00 |━━━━━━━━━━━━━━━━━━━  ← TP3 (Red dashed line)
      |
91.50 |━━━━━━━━━━━━━━━━━━━  ← TP2 (Red dashed line)
      |
88.20 |━━━━━━━━━━━━━━━━━━━  ← TP1 (Red dashed line)
      |
85.50 |     🎯 BUY HERE     ← Entry marker (Yellow arrow)
      |    ┌─┐
83.50 |   ┌┘ └┐ ┌─┐        ← Support fractal (Green dot)
      |  ┌┘   └┐│ │
83.08 |━━━━━━━━━━━━━━━━━━━  ← SL (Green solid line)
      |──────────────────────→
      Time Scale (Bottom)
```

### **5.2 Chart Elements Required**

1. **Candlesticks** - Green/red bars showing OHLC data
2. **S/R Lines** - Horizontal lines at fractal levels
   - Red lines = Resistance
   - Green lines = Support
   - Solid = Current levels
   - Dashed = Previous levels
3. **Fractal Markers** - Small circles/triangles at pivot points
4. **TP/SL Lines** - Dashed lines showing target levels
5. **Entry Marker** - Arrow or star showing entry point
6. **Labels** - Price labels and reasoning text
7. **Interactive** - Hover for details, zoom, pan

### **5.3 Recommended Library: Lightweight Charts by TradingView ⭐**

**Why Lightweight Charts (NOT Chart.js):**

✅ **Free and open-source**  
✅ **Professional quality** (made by TradingView)  
✅ **Perfect for financial data** (built specifically for trading charts)  
✅ **Easy to integrate with React**  
✅ **Real-time updates support**  
✅ **Mobile responsive**  
✅ **Great documentation**  
✅ **Active community**  
✅ **Much better performance** than Chart.js for candlestick charts  

**Features You Get:**
- Native candlestick charts
- Draw horizontal lines dynamically (for S/R, TP, SL)
- Custom markers and labels
- Interactive (zoom, pan, hover)
- Multiple timeframes
- Price scale on right
- Time scale on bottom
- Export chart images
- Series overlays (for indicators like EMA, SMA)

**Installation:**

```bash
npm install lightweight-charts
```

**Implementation Time:** 1-2 days

### **5.4 Basic Implementation Example**

**Component: `TradingChart.jsx`**

```jsx
import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

function TradingChart({ symbol, candles, signal }) {
  const chartContainerRef = useRef();
  const chartRef = useRef();

  useEffect(() => {
    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
      },
      timeScale: {
        borderColor: '#2a2e39',
      },
    });

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Set candle data
    const formattedCandles = candles.map(c => ({
      time: new Date(c.date).getTime() / 1000,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candlestickSeries.setData(formattedCandles);

    // Add TP lines
    if (signal.tp1) {
      candlestickSeries.createPriceLine({
        price: signal.tp1,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `TP1: ${signal.tp1}`,
      });
    }

    if (signal.tp2) {
      candlestickSeries.createPriceLine({
        price: signal.tp2,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `TP2: ${signal.tp2}`,
      });
    }

    if (signal.tp3) {
      candlestickSeries.createPriceLine({
        price: signal.tp3,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `TP3: ${signal.tp3}`,
      });
    }

    // Add SL line
    if (signal.stopLoss) {
      candlestickSeries.createPriceLine({
        price: signal.stopLoss,
        color: '#26a69a',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: `SL: ${signal.stopLoss}`,
      });
    }

    // Add entry marker
    if (signal.price) {
      candlestickSeries.setMarkers([
        {
          time: new Date(signal.date).getTime() / 1000,
          position: 'aboveBar',
          color: '#ffd700',
          shape: 'arrowDown',
          text: `${signal.signalType} @ ${signal.price}`,
        },
      ]);
    }

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, signal]);

  return (
    <div 
      ref={chartContainerRef} 
      style={{ width: '100%', height: '500px' }}
    />
  );
}

export default TradingChart;
```

### **5.5 Advanced Features to Add**

1. **S/R Level Visualization**
   - Show all detected support/resistance levels
   - Color code by strength (stronger = thicker line)
   - Add fractal markers at pivot points

2. **Indicator Overlays**
   - Add EMA/SMA lines on chart
   - Add Bollinger Bands
   - Separate pane for RSI/MACD

3. **Interactive Features**
   - Click on fractal to see details
   - Hover over TP/SL to see reasoning
   - Toggle S/R levels on/off
   - Switch timeframes (1D, 1W, 1M)

4. **Export & Sharing**
   - Download chart as PNG
   - Share chart URL
   - Print chart

### **5.6 Resources**

- **Official Docs**: https://tradingview.github.io/lightweight-charts/
- **Examples**: https://tradingview.github.io/lightweight-charts/tutorials/
- **React Integration**: https://github.com/tradingview/lightweight-charts/tree/master/plugin-examples/react
- **TypeScript Support**: Built-in types included

**Implementation Priority**: High (Phase 4 in MASTER_PLAN.md)

---

## 📦 **DEPENDENCIES REQUIRED**

### **Backend**

```json
{
  "dependencies": {
    "technicalindicators": "^3.1.0",
    "node-cron": "^3.0.3",
    "dayjs": "^1.11.10",
    "axios": "^1.6.0",
    "cheerio": "^1.0.0-rc.12",
    "mathjs": "^12.0.0"
  }
}
```

**Optional (for production scale):**
```json
{
  "dependencies": {
    "bull": "^4.12.0",
    "ioredis": "^5.3.2"
  }
}
```

### **Frontend**

```json
{
  "dependencies": {
    "lightweight-charts": "^4.1.0"
  }
}
```

**Note:** We are NOT using Chart.js or react-chartjs-2 because:
- ❌ Chart.js is NOT optimized for financial candlestick charts
- ❌ Poor performance with real-time updates
- ❌ Limited financial chart features
- ✅ Lightweight Charts is purpose-built for trading applications

---

## 🎯 **CONFIGURATION PARAMETERS**

### **TP/SL Configuration**

```javascript
const config = {
  tp: {
    preferResistance: true,
    minDistance: 2,      // Min % gain for TP
    maxDistance: 25,     // Max % gain for TP
    minStrength: 2,      // Min touches for valid resistance
    fibLevels: [0.382, 0.618, 0.786]
  },
  sl: {
    preferSupport: true,
    belowSupportBuffer: 0.5, // 0.5% below support
    maxLoss: 5,          // Max % loss
    minLoss: 1,          // Min % loss
    fallbackPercent: 2   // Default 2% if no support
  },
  risk: {
    minRiskReward: 1,
    preferredRiskReward: 1.5
  }
};
```

### **S/R Detection Configuration**

```javascript
const srConfig = {
  fractalLength: 10,        // Window size
  minFractalAge: 5,         // Min candles since fractal
  maxFractalAge: 100,       // Max candles to look back
  clusterTolerance: 0.5,    // % tolerance for clustering
  minStrength: 2            // Min touches to consider valid
};
```

### **Scanner Configuration**

```javascript
const scannerConfig = {
  scanInterval: 300,        // 5 minutes
  tradingHours: {
    start: "09:30",
    end: "15:30"
  },
  tradingDays: [1, 2, 3, 4, 5], // Monday-Friday
  candleTimeframe: "5m",
  lookbackCandles: 100
};
```

---

## 📝 **DOCUMENT VERSION**

- **v2.0** (2025-10-26): Merged trading-bot-summary.md + TRADING_SIGNALS_PLAN.md into single comprehensive guide
- **v1.0** (2025-10-21): Initial separate documents created

---

**End of Technical Guide**

This document provides the complete technical implementation details for the trading bot system. For strategic planning and phase sequencing, refer to **MASTER_PLAN.md**.

