# Data Adjustment Requirements for MongoDB

## 🔍 Problem Identified

Currently, the MongoDB `psxdailies` collection stores:
- **Raw OHLC** values (Open, High, Low, Close)
- **Adjusted Close** separately as `adjClose`

This causes **inconsistent data** because:
- Indicators (RSI, Stochastic, MACD) calculate using **mixed data**
- Open/High/Low are raw, but Close is adjusted
- This creates different indicator values compared to TradingView/StockAnalysis.com

## 📊 Current Data Structure (WRONG)

```javascript
{
  symbol: "HCAR",
  date: ISODate("2025-01-01T00:00:00.000Z"),
  open: 312.00,     // ❌ Raw value
  high: 329.00,     // ❌ Raw value
  low: 311.00,      // ❌ Raw value
  close: 326.89,    // ❌ Raw value
  adjClose: 317.98, // ✅ Adjusted value
  volume: 2224912
}
```

## ✅ Required Data Structure (CORRECT)

When storing data in MongoDB, **all OHLC values must be adjusted**, not just Close:

```javascript
{
  symbol: "HCAR",
  date: ISODate("2025-01-01T00:00:00.000Z"),
  open: 303.50,     // ✅ Adjusted (312.00 × 0.972743)
  high: 320.03,     // ✅ Adjusted (329.00 × 0.972743)
  low: 302.52,      // ✅ Adjusted (311.00 × 0.972743)
  close: 317.98,    // ✅ Adjusted (326.89 × 0.972743)
  adjClose: 317.98, // ✅ Same as close (for reference)
  volume: 2224912   // Volume stays unchanged
}
```

## 🔢 Calculation Method

For each trading day:

1. **Calculate adjustment factor:**
   ```javascript
   adjustmentFactor = adjClose / rawClose
   // Example: 317.98 / 326.89 = 0.972743
   ```

2. **Apply to ALL OHLC:**
   ```javascript
   adjustedOpen = rawOpen × adjustmentFactor
   adjustedHigh = rawHigh × adjustmentFactor
   adjustedLow = rawLow × adjustmentFactor
   adjustedClose = adjClose  // Already adjusted from source
   ```

3. **Volume remains unchanged**

## 📝 Implementation Steps

### Option 1: Adjust During Scraping (RECOMMENDED)
When scraping from StockAnalysis.com or other sources:

```javascript
// Example for HCAR on 2025-01-01
const rawData = {
  open: 312.00,
  high: 329.00,
  low: 311.00,
  close: 326.89,
  adjClose: 317.98,
  volume: 2224912
};

// Calculate adjustment factor
const adjustmentFactor = rawData.adjClose / rawData.close;

// Store adjusted values
const adjustedData = {
  symbol: "HCAR",
  date: new Date("2025-01-01"),
  open: rawData.open * adjustmentFactor,      // 303.50
  high: rawData.high * adjustmentFactor,      // 320.03
  low: rawData.low * adjustmentFactor,        // 302.52
  close: rawData.adjClose,                    // 317.98
  adjClose: rawData.adjClose,                 // 317.98 (for reference)
  volume: rawData.volume                      // 2224912 (unchanged)
};

// Insert into MongoDB
await db.collection('psxdailies').insertOne(adjustedData);
```

### Option 2: Batch Update Existing Data

If you need to fix existing data:

```javascript
// For each document in psxdailies collection
const documents = await db.collection('psxdailies').find({}).toArray();

for (const doc of documents) {
  if (doc.close && doc.adjClose && doc.close !== doc.adjClose) {
    const adjustmentFactor = doc.adjClose / doc.close;
    
    await db.collection('psxdailies').updateOne(
      { _id: doc._id },
      {
        $set: {
          open: doc.open * adjustmentFactor,
          high: doc.high * adjustmentFactor,
          low: doc.low * adjustmentFactor,
          close: doc.adjClose  // Use adjClose as close
        }
      }
    );
  }
}
```

## ✅ Verification

After implementing, verify with sample data:

**Example verification for HCAR 2025-01-01:**

| Field | Current (Wrong) | Required (Correct) | TradingView |
|-------|----------------|-------------------|-------------|
| Open  | 312.00 ❌      | 303.50 ✅         | 303.49      |
| High  | 329.00 ❌      | 320.03 ✅         | 320.03      |
| Low   | 311.00 ❌      | 302.52 ✅         | 302.52      |
| Close | 326.89 ❌      | 317.98 ✅         | 317.98      |

The adjusted values should match TradingView exactly!

## 🎯 Expected Impact

After this fix:
- ✅ Indicator calculations (RSI, Stochastic, MACD) will match TradingView
- ✅ Crossover signals will be accurate and verifiable
- ✅ Backtest results will be consistent with manual chart analysis
- ✅ No more 8-9 point discrepancies in High/Low values

## 📌 Important Notes

1. **Consistency**: Once adjusted, ALL OHLC should use adjusted values consistently
2. **Volume**: Volume should NEVER be adjusted
3. **Historical data**: You may need to re-scrape or batch-update all existing data
4. **Source**: StockAnalysis.com provides both raw and adjusted values - use adjusted for all OHLC

## 🔗 Reference

Data source: https://stockanalysis.com/quote/psx/HCAR/history/

The "Adj Close" column is what should be used for ALL OHLC after applying the adjustment factor.
