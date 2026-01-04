# Portfolio & SIP System Guide

**Last Updated:** January 5, 2026

---

## 🎯 What This System Does

Your portfolio module tracks investments, calculates P/L, receives dividends, and **automatically recommends monthly SIP allocations** using a scoring engine.

---

## 📊 How SIP Allocation Works

### 1. **Score Stocks** (0-100 points)
- **Dividend Yield** (40% weight): Higher yield = better
- **Payout Safety** (25% weight): 40-60% payout ideal, consistency matters
- **Growth** (20% weight): EPS + Revenue growth
- **Quality** (15% weight): ROE + Low debt

### 2. **Calculate Target Weights**
- Top N stocks get equal weight baseline
- Tilt toward higher scores
- Cap at maxPositionPct (e.g., 15%)

### 3. **Allocate Monthly Budget**
- Compare current vs target weights
- Prioritize underweight stocks (fill gaps)
- Skip overweight stocks
- Round to lot sizes (e.g., 100 shares)

### 4. **Detect Drift**
- Alert if stock deviates >5% from target
- Next month's SIP rebalances automatically

---

## 🔧 Setup Steps

### Create Portfolio
1. Go to Portfolios → Create New
2. Add initial transactions (BUY, SELL, DIV, DEPOSIT)

### Configure Policy
Set your investment strategy:
```javascript
{
  universeMode: "MANUAL_LIST",  // Or ALL_ACTIVE_HOLDINGS
  allowedSymbols: ["OGDC", "PPL", "HUBC", "MCB"],  // Stocks to pick from
  
  scoringWeights: {
    dividendYield: 0.40,
    payoutSafety: 0.25,
    growth: 0.20,
    quality: 0.15
  },
  
  filters: {
    minDividendYield: 4.0,  // Only stocks yielding 4%+
    maxPayoutRatio: 80      // Avoid unsustainable dividends
  },
  
  constraints: {
    minHoldings: 8,
    maxHoldings: 15,
    maxPositionPct: 15
  }
}
```

### Configure SIP Plan
```javascript
{
  monthlyAmount: 50000,
  startDate: "2026-01-01",
  lumpSums: [
    { date: "2026-12-15", amount: 150000 }
  ],
  rounding: { type: "LOT", lotSize: 100 }
}
```

### Generate Recommendation
1. Click "Generate Recommendation"
2. Review allocations
3. Approve
4. Execute trades
5. Mark as executed

---

## ⚠️ Current Limitation: No Fundamental Data

**The allocation engine needs fundamental data** (dividend yield, payout ratio, EPS growth, ROE, debt/equity).

### Getting Fundamental Data

You have 3 options:

**Option 1: Use Fundamental API** (Recommended)
- Find API that provides PSX fundamental data
- Integrate with `FundamentalsAggregator` service
- Auto-refresh daily

**Option 2: Manual Entry**
- Admin manually enters data for key stocks
- Set `manualOverride: true` in StockFundamental model
- Highest priority source

**Option 3: Enable Scrapers**
- Set `ENABLE_PSX_SCRAPER=true`
- Set `ENABLE_STOCK_ANALYSIS_SCRAPER=true`
- Run fundamentals refresh job

---

## 🔍 Debugging

**"No eligible stocks in universe"**
- Check if StockFundamental data exists
- Relax filters (minDividendYield too high?)
- Verify allowedSymbols has data

**Scores all zeros**
- Fundamental data missing critical fields
- Check dividendYield, payoutRatio, epsGrowthYoY, roe

**Drift not detected**
- Check rebalance.driftThresholdPct (default 5%)
- Ensure policy is active

---

## 📝 CSV Import Format

```csv
Type,Symbol,Quantity,Price,Fees,Amount,Date,Notes
BUY,OGDC,100,118,50,,2026-01-05,Initial purchase
SELL,OGDC,50,125,30,,2026-02-10,Partial exit
DIV,OGDC,,,,1000,2026-02-15,Dividend received
DEPOSIT,,,,,50000,2026-01-01,Monthly SIP
WITHDRAW,,,,,10000,2026-01-20,Withdrawal
```

---

## 🚀 Next Features to Build

1. **Stock Health Monitor** - BUY/HOLD/SELL AI for existing holdings
2. **Performance Charts** - Portfolio value over time, winners/losers
3. **Technical Analysis** - RSI, MACD, moving averages
4. **Dividend Forecasting** - Predict future dividend income

---

For detailed architecture, see `PORTFOLIO_ARCHITECTURE.md`
