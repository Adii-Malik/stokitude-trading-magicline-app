# 🤖 Trading Bot System - Reference Guide

**Version**: 2.0  
**Date**: October 30, 2025  
**Status**: Reference Only (Python Implementation)

---

## ⚠️ IMPORTANT NOTICE

**This document is for REFERENCE ONLY.**

The trading bot computation (backtesting, indicators, signals) is handled by the **Python Strategy Engine** (separate microservice).

**For Node.js implementation**, see:
- `MASTER_PLAN.md` - High-level roadmap
- `INTEGRATION_CONTRACT.md` - API contracts
- `PYTHON_INTEGRATION_PLAN.md` - Detailed Node.js tasks

---

## 📋 PURPOSE

This document explains:
1. How backtesting algorithms work (conceptual understanding)
2. Technical indicators (EMA, RSI, MACD, etc.)
3. Support/Resistance detection methods
4. Smart TP/SL calculation logic

**You DON'T need to implement these** - they're already built in the Python service.

---

## 🎯 WHAT'S IN THE PYTHON SERVICE (External)

### **Available via Python API:**

1. **Backtesting Engine**
   - Endpoint: `POST /api/backtest/run`
   - Returns: Full backtest results (trades, metrics, performance)
   
2. **Signal Generation**
   - Endpoint: `POST /api/signals/generate`
   - Returns: BUY/SELL signals with indicators
   
3. **Strategy Management**
   - Endpoint: `GET /api/strategies`
   - Returns: List of available strategies
   
4. **Technical Indicators**
   - Built-in: EMA, SMA, RSI, MACD, Bollinger Bands, etc.
   - Calculated automatically by Python service

---

## 📊 CONCEPTUAL OVERVIEW (For Understanding)

### **1. Backtesting Concept**

```
Historical Data (2023-2024) → Strategy Rules → Simulate Trades → Metrics
```

**Example**:
- Strategy: "Buy when EMA(9) crosses above EMA(21)"
- Test on 2023 data
- Count wins/losses
- Calculate return, drawdown, Sharpe ratio

**Result**: Python returns JSON with all metrics → Node.js displays it visually

---

### **2. Technical Indicators (Examples)**

#### **EMA (Exponential Moving Average)**
- Smooths price data
- Fast EMA (9) vs Slow EMA (21)
- Crossover = signal

#### **RSI (Relative Strength Index)**
- Measures momentum (0-100)
- < 30 = Oversold (potential buy)
- \> 70 = Overbought (potential sell)

#### **MACD (Moving Average Convergence Divergence)**
- Trend-following indicator
- MACD line crosses signal line = entry/exit

**Note**: All calculations done by Python using TA-Lib library.

---

### **3. Support/Resistance Detection (Barry's Fractal Method)**

**Concept**:
- Find price reversal points (fractals)
- High fractal = Resistance
- Low fractal = Support

**Use**:
- Python detects S/R levels
- Returns levels in API response
- Node.js visualizes them on chart

---

### **4. Smart TP/SL Calculation**

**Logic**:
1. Detect nearest resistance above current price → TP1
2. Find next resistance → TP2, TP3
3. Find nearest support below price → SL
4. Validate risk/reward ratio (min 1:1.5)

**Fallback**:
- If no S/R found, use Fibonacci levels
- If still none, use fixed percentages

**Output**: Python returns `{tp1, tp2, tp3, stopLoss, reasoning}`

---

## 🔄 DATA FLOW (What Node.js Does)

```
1. User Action (Frontend):
   "Run backtest on OGDC with EMA Crossover strategy"
   
2. Node.js Backend:
   - Validate user owns strategy
   - Get strategy config from TradingStrategy model
   - Call Python API: POST /api/backtest/run
   
3. Python Service:
   - Fetch OHLCV from MongoDB
   - Calculate indicators
   - Simulate trades
   - Return results as JSON
   
4. Node.js Backend:
   - Cache results in BacktestResult model
   - Transform data for frontend
   - Return to user
   
5. Frontend (React):
   - Receive JSON data
   - Render candlestick chart (lightweight-charts)
   - Add buy/sell markers
   - Display metrics visually
```

**Key Point**: Python does computation → Node.js does orchestration → React does visualization

---

## 📦 PYTHON API ENDPOINTS (Quick Reference)

| Endpoint | Method | Purpose | Node.js Action |
|----------|--------|---------|----------------|
| `/health` | GET | Health check | Poll every 30 sec |
| `/api/strategies` | GET | List strategies | Cache & display in UI |
| `/api/strategies/:name` | GET | Strategy details | Show parameters in form |
| `/api/backtest/run` | POST | Run backtest | Trigger & cache results |
| `/api/signals/generate` | POST | Generate signal | Cache & broadcast |
| `/api/signals/batch` | POST | Batch signals | Bulk generation |
| `/api/symbols` | GET | Available symbols | Validate user input |
| `/api/symbols/:symbol` | GET | Symbol info | Show data coverage |

**Full contracts**: See `INTEGRATION_CONTRACT.md`

---

## 🎨 VISUALIZATION (What Node.js Builds)

### **Components We Build:**

1. **BacktestChart** (lightweight-charts)
   - Candlestick chart
   - Buy/Sell markers from Python `trades` array
   - Indicator overlays (EMA lines)
   
2. **EquityCurveChart**
   - Portfolio value over time
   - Data from Python response
   
3. **PerformanceMetricsCard**
   - Win rate, profit factor, Sharpe ratio
   - Visual progress bars
   
4. **TradeListTable**
   - All trades from Python `trades` array
   - Sortable, filterable

---

## 📚 TECHNICAL DETAILS (For Deep Dive)

### **Backtesting Metrics Explained**

| Metric | Formula | Good Value |
|--------|---------|------------|
| **Win Rate** | (Winning Trades / Total Trades) × 100 | > 60% |
| **Profit Factor** | Total Profit / Total Loss | > 2.0 |
| **Sharpe Ratio** | (Return - Risk-Free Rate) / StdDev | > 1.5 |
| **Max Drawdown** | Largest peak-to-trough decline | < 15% |
| **Total Return** | (Final - Initial) / Initial × 100 | Varies |

**Python calculates all of these** → Returns in JSON → Node.js displays

---

### **Strategy Example: EMA Crossover**

**Python Implementation** (for understanding only):
```python
def check_signal(candles, config):
    fast_ema = calculate_ema(candles['close'], config['fast_period'])
    slow_ema = calculate_ema(candles['close'], config['slow_period'])
    
    if fast_ema[-1] > slow_ema[-1] and fast_ema[-2] < slow_ema[-2]:
        return {'type': 'BUY', 'price': candles['close'][-1]}
    
    if fast_ema[-1] < slow_ema[-1] and fast_ema[-2] > slow_ema[-2]:
        return {'type': 'SELL', 'price': candles['close'][-1]}
    
    return None
```

**Node.js doesn't implement this** - just calls Python API.

---

### **S/R Detection Example**

**Concept** (Python implements):
```python
def detect_resistance(candles, fractal_length=10):
    resistances = []
    for i in range(fractal_length, len(candles) - fractal_length):
        current_high = candles[i]['high']
        is_resistance = True
        
        # Check if this high is highest in window
        for j in range(i - fractal_length, i + fractal_length):
            if j != i and candles[j]['high'] >= current_high:
                is_resistance = False
                break
        
        if is_resistance:
            resistances.append({'price': current_high, 'index': i})
    
    return resistances
```

**Node.js receives**: `{resistances: [{price: 88.20, strength: 3}, ...]}`  
**Node.js displays**: Horizontal lines on chart

---

## 🛠️ DEPENDENCIES (Python Side - Not Our Concern)

Python service uses:
- `pandas` - Data manipulation
- `ta-lib` - Technical indicators
- `numpy` - Numerical calculations
- `flask` - REST API
- `pymongo` - MongoDB connection

**Node.js only needs**: `axios` (to call Python API)

---

## 📈 PERFORMANCE EXPECTATIONS

| Operation | Python Service Time | Node.js Overhead |
|-----------|---------------------|------------------|
| List strategies | < 100ms | + 50ms |
| Generate signal | 1-2 seconds | + 100ms |
| Run backtest (1 year) | 3-5 seconds | + 200ms |
| Batch signals (100 symbols) | 30-60 seconds | + 500ms |

**Total response time** = Python time + Node.js overhead + Network latency

---

## 🚨 ERROR HANDLING (Node.js Responsibility)

**Possible Python Errors:**

| Error Code | Meaning | Node.js Action |
|------------|---------|----------------|
| `INVALID_SYMBOL` | Symbol not found | Return 404 to user |
| `INVALID_STRATEGY` | Strategy not found | Return 404 to user |
| `INVALID_CONFIG` | Bad parameters | Return 400 to user |
| `INSUFFICIENT_DATA` | Not enough candles | Show error message |
| `MONGODB_ERROR` | DB connection failed | Retry 3 times |
| `CALCULATION_ERROR` | Indicator failed | Log & return 500 |
| `TIMEOUT` | Request too slow | Retry once |

**Node.js handles all error cases** - Python just returns error codes.

---

## 📚 FURTHER READING (External Resources)

### **Technical Indicators:**
- Investopedia: https://www.investopedia.com/technical-analysis-4689657
- TA-Lib: https://ta-lib.org/

### **Backtesting:**
- Quantopian Lectures: https://www.quantopian.com/lectures
- Python for Finance: https://www.oreilly.com/library/view/python-for-finance/9781491945360/

### **Chart Visualization:**
- TradingView Lightweight Charts: https://tradingview.github.io/lightweight-charts/

---

## 🎯 SUMMARY FOR NODE.JS TEAM

### **What We DON'T Build:**
❌ Backtesting algorithms  
❌ Technical indicators (EMA, RSI, etc.)  
❌ Signal generation logic  
❌ S/R detection algorithms  
❌ TP/SL calculation logic  

### **What We DO Build:**
✅ HTTP client to Python service  
✅ Models to cache Python responses  
✅ API routes to proxy Python endpoints  
✅ Frontend components for user interaction  
✅ Visualization (charts, tables, metrics display)  
✅ Real-time broadcasting (Socket.IO)  
✅ User management & authentication  

---

**For implementation details, see:**
- `MASTER_PLAN.md` - What we're building (high-level)
- `INTEGRATION_CONTRACT.md` - API contracts with Python
- `PYTHON_INTEGRATION_PLAN.md` - Step-by-step Node.js tasks

---

**Version**: 2.0 (Reference Only)  
**Last Updated**: October 30, 2025  
**Purpose**: Conceptual understanding of trading bot algorithms
