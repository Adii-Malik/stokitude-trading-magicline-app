# Portfolio & SIP System - Complete Guide

**Last Updated:** January 11, 2026

---

## 🎯 Overview

An intelligent portfolio management system that:
- Tracks investments with real-time P/L calculation
- Automatically generates monthly SIP (Systematic Investment Plan) recommendations
- Uses AI-driven scoring to select the best stocks
- Supports dividend investing, growth investing, or balanced strategies

---

## 📊 How It Works

### The Smart Allocation Engine

**Step 1: Score Stocks (0-100 points)**
The system evaluates stocks across 4 dimensions:
- **Dividend Yield** - How much income the stock provides
- **Payout Safety** - Can the company sustain dividends? (payout ratio, cash coverage, balance sheet)
- **Growth** - Revenue and earnings growth trends
- **Quality** - Financial health (ROE, debt levels, liquidity)

**Step 2: Calculate Target Weights**
- Top-scoring stocks get allocated more weight
- Position sizes are capped (e.g., max 15% per stock)
- Diversification is enforced (min 3 stocks, max 15 stocks)

**Step 3: Generate Monthly Allocations**
- Compares current holdings vs. ideal targets
- Prioritizes underweight positions (fills gaps first)
- Skips overweight positions
- Respects your budget and lot sizes

**Step 4: Auto-Rebalancing**
- Monitors drift from targets
- Alerts when stocks deviate >5%
- Next month's SIP automatically rebalances

---

## 🚀 Quick Start Guide

### 1. Create Your Portfolio
```
Portfolios → Create New
- Name: "My Dividend Portfolio"
- Currency: PKR
- Initial capital via DEPOSIT transaction
```

### 2. Choose Investment Strategy

**📈 Steady Income (Conservative)**
- Best for: Retirees, income seekers
- Focus: High dividend yield + safety
- Scoring: 35% yield, 50% safety, 15% quality
- Filters: Min 3% yield, 20-120% payout ratio
- Risk: Low

**⚖️ Balanced Growth (Moderate)**
- Best for: Long-term wealth building
- Focus: Mix of dividends and growth
- Scoring: 25% yield, 20% safety, 30% growth, 25% quality
- Filters: Min 2% yield (if applicable)
- Risk: Medium

**🚀 Aggressive Growth (High Risk)**
- Best for: Young investors, risk-tolerant
- Focus: Capital appreciation over income
- Scoring: 10% yield, 10% safety, 50% growth, 30% quality
- Filters: No dividend requirements
- Risk: High

### 3. Select Stock Universe

**Option A: Your Holdings**
- Uses stocks you already own
- Best if you've done your research
- System optimizes allocation weights

**Option B: Market Scan**
- AI finds best stocks from 480+ PSX stocks
- Applies Shariah compliance filter (optional)
- Discovers opportunities you might miss

### 4. Configure SIP Plan
```
Monthly Amount: 50,000 PKR
Start Date: 2026-01-01
Lot Size: 100 shares (for rounding)
Lump Sums: Optional (e.g., bonus month)
```

### 5. Generate & Execute
1. Click "Generate Recommendation"
2. Review AI-selected stocks and quantities
3. Approve recommendation
4. Execute trades in your broker
5. Add transactions (BUY) to portfolio
6. Mark recommendation as executed

---

## 🔧 Advanced Configuration

### Scoring Weights (Auto-set by strategy)
Fine-tune how the AI evaluates stocks:
```
Dividend Growth Strategy:
  dividendYield: 35%
  payoutSafety: 50%
  growth: 0%
  quality: 15%

Balanced Strategy:
  dividendYield: 25%
  payoutSafety: 20%
  growth: 30%
  quality: 25%

Growth Strategy:
  dividendYield: 10%
  payoutSafety: 10%
  growth: 50%
  quality: 30%
```

### Filters (Customizable)
```
minDividendYield: 3.0%        # Only stocks yielding 3%+
minPayoutRatio: 20%           # Must pay dividends
maxPositionPct: 15%           # Max 15% in one stock
shariahOnly: true             # Islamic investing
```

### Constraints
```
minHoldings: 3                # Minimum diversification
maxHoldings: 15               # Maximum positions
driftThresholdPct: 5%         # Rebalance alert trigger
```

---

## 📈 Understanding Scores

### Dividend Yield Score (0-100)
- 0% yield = 0 points
- 10%+ yield = 100 points
- Linear scaling in between

### Payout Safety Score (0-100)
**35% - Payout Ratio**
- 20-60% = Excellent (100 pts) - Sustainable
- 60-80% = Good (85 pts)
- 80-100% = Fair (70 pts)
- 100-120% = Warning (60 pts)
- 120%+ = Risky (30 pts)

**25% - Consistency**
- 5+ years paying = 100 pts
- 3+ years = 80 pts
- 1+ years = 60 pts
- New payer = 50 pts

**30% - Cash Coverage**
- 2.0x+ cash coverage = 100 pts (very safe)
- 1.5x = 85 pts
- 1.0x = 70 pts
- <0.8x = Risky

**10% - Balance Sheet**
- Low debt (<0.3 D/E) + strong liquidity (>1.5 current ratio) = Best

### Growth Score (0-100)
- 50% Revenue Growth (15%+ CAGR = 100 pts)
- 50% EPS Growth (15%+ YoY = 100 pts)

### Quality Score (0-100)
- 40% ROE (20%+ = Excellent)
- 40% Leverage (Low debt = Better)
- 20% Liquidity (Current ratio >1.5 = Best)

---

## 📝 Transaction Types

### Core Transactions
- **BUY** - Purchase shares (increases cost basis)
- **SELL** - Exit position (realizes P/L)
- **DIV** - Dividend received (income)
- **DEPOSIT** - Add cash to portfolio
- **WITHDRAW** - Take cash out

### CSV Bulk Import
```csv
Type,Symbol,Quantity,Price,Fees,Amount,Date,Notes
BUY,OGDC,100,118,50,,2026-01-05,Initial
SELL,OGDC,50,125,30,,2026-02-10,Partial exit
DIV,OGDC,,,,1000,2026-02-15,Q4 dividend
DEPOSIT,,,,,50000,2026-01-01,Monthly SIP
```

---

## 🔍 Troubleshooting

**"No eligible stocks in universe"**
- ✅ Relax dividend yield filter (try 2% instead of 5%)
- ✅ Check if stocks have fundamental data
- ✅ Try "Market Scan" instead of holdings-only

**"All scores are zero"**
- ✅ Run Fundamentals Refresh job (Admin → Jobs)
- ✅ Ensure Python TradingView service is running
- ✅ Check StockFundamental collection has data

**"Budget too small, can't allocate"**
- ✅ Increase monthly SIP amount
- ✅ Reduce number of target holdings
- ✅ Lower lot size from 100 to 1

**Recommendation excludes a stock I like**
- ✅ Stock doesn't meet strategy filters
- ✅ Stock scored lower than others
- ✅ Add manual transaction instead

**Drift not working**
- ✅ Ensure portfolio policy is active
- ✅ Check driftThresholdPct (default 5%)
- ✅ Generate fresh recommendation

---

## 🔐 Data Requirements

### For Dividend Strategies (Income, Balanced)
**Required:**
- Dividend Yield (%)
- Payout Ratio (%)
- Cash Dividend Coverage Ratio

**Nice-to-have:**
- Dividend Consistency (years)
- Historical DPS (for volatility analysis)

### For Growth Strategies
**Required:**
- Revenue Growth (CAGR 5Y or YoY)
- EPS Growth (YoY)
- ROE (%)

**Nice-to-have:**
- Historical EPS (for stability analysis)
- Free Cash Flow

### For All Strategies
- Debt-to-Equity Ratio
- Current Ratio
- Shariah Compliance Status
- Sector/Industry Classification

**Data is fetched from:**
1. TradingView API (Primary) - via Python service
2. PSX Website Scraper (Fallback)
3. Manual Override (Highest Priority)

---

## 📊 Dashboard Metrics

### Portfolio Level
- **Total Value** - Current market value
- **Cost Basis** - Total invested
- **Unrealized P/L** - Paper profit/loss
- **Realized P/L** - Locked-in gains/losses
- **Total Return %** - Overall performance
- **Dividend Income** - Total dividends received

### Per-Stock Level
- **Shares** - Quantity owned
- **Avg Cost** - Purchase price (average)
- **Current Price** - Real-time market price
- **Market Value** - shares × price
- **P/L %** - (price - avgCost) / avgCost
- **Weight %** - Position size in portfolio
- **Target Weight %** - AI-recommended allocation
- **Gap** - Difference (for SIP allocation)

---

## 🔄 Monthly SIP Workflow

**Week 1 of Month:**
1. System refreshes fundamental data (automated job)
2. You click "Generate Recommendation"
3. AI analyzes all eligible stocks + holdings
4. Recommendation created with buy list

**Week 2:**
5. Review recommendation (scores, rationale)
6. Approve or reject
7. Execute trades in your broker app

**Week 3:**
8. Add BUY transactions to portfolio
9. Mark recommendation as "Executed"
10. Dashboard updates with new holdings

**Rest of Month:**
- Track performance
- Monitor drift alerts
- Add dividends as received

---

## 🏗️ System Architecture

### Data Flow
```
1. TradingView API (Python Service)
   ↓
2. FundamentalsAggregator (Node.js)
   → Tries: Manual Override → TradingView → PSX → Stock Analysis
   ↓
3. StockFundamental (MongoDB)
   → Cached for 90 days
   ↓
4. Scoring Engine (Config-Driven)
   → Reads SCORING_CONFIG
   → Applies tier-based + linear scoring
   ↓
5. Allocation Engine
   → Universe Selection → Scoring → Weighting → Budgeting
   ↓
6. Recommendation (MongoDB)
   → Saved for audit trail
```

### Key Services
- **PortfolioService** - CRUD, holdings, P/L calculation
- **AllocationEngineService** - Stock scoring, SIP allocation
- **FundamentalsAggregator** - Multi-source data fetching
- **ScoringEngine** - Configurable scoring logic

### Models
- **Portfolio** - User's investment account
- **Transaction** - All buy/sell/dividend events
- **Position** - Real-time snapshot (calculated)
- **PortfolioPolicy** - Investment strategy settings
- **SIPPlan** - Monthly budget configuration
- **Recommendation** - Monthly AI allocation
- **StockFundamental** - Cached financial metrics

---

## 🔮 Future Enhancements

**Phase 2:**
- [ ] Auto-execute trades (broker API integration)
- [ ] Tax loss harvesting
- [ ] Dividend forecasting (predict annual income)
- [ ] Performance attribution (why did portfolio change?)

**Phase 3:**
- [ ] Stock health monitor (BUY/HOLD/SELL signals)
- [ ] Technical analysis (RSI, MACD overlays)
- [ ] Portfolio comparison (vs. KSE-100 index)
- [ ] Risk metrics (Sharpe ratio, volatility)

**Phase 4:**
- [ ] Multi-currency portfolios
- [ ] International stocks (US, UK markets)
- [ ] Options/derivatives tracking
- [ ] Social features (share strategies)

---

## 📚 Related Documentation

- `JOBS.md` - How to run Fundamentals Refresh job
- `SCORING_REQUIREMENTS.md` - Detailed scoring formulas
- `API.md` - Backend API endpoints
- `ARCHITECTURE.md` - Full system design

---

## 💡 Tips & Best Practices

1. **Start small** - Use MARKET scan first to discover stocks
2. **Diversify** - Don't put >20% in one stock
3. **Be patient** - SIP works over years, not weeks
4. **Trust the scores** - But verify - read company reports
5. **Rebalance annually** - Let SIP handle monthly tweaks
6. **Track dividends** - Add DIV transactions for accurate yield
7. **Use Shariah filter** - If you prefer Islamic investing
8. **Review monthly** - Check drift alerts, adjust if needed

---

## 🆘 Support

**Common Issues:**
- Python service down → Start on port 5002
- No fundamental data → Run Fundamentals Refresh job
- Scoring seems wrong → Check SCORING_CONFIG weights

**Need Help?**
- Check logs in Admin → Jobs → Execution History
- Review StockFundamental data for your symbols
- Test with 2-3 well-known stocks first (OGDC, PPL, HUBC)

---

**Built with:** Node.js + MongoDB + React + TradingView API + Scoring AI
