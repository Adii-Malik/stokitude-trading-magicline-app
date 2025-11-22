# PSX SmartDesk - Trading Bot System

Complete guide for Python-based trading bot integration, backtesting, and signal generation.

---

## Overview

The trading bot system integrates a **Python Strategy Engine** with the Node.js backend to provide:
- Automated backtesting with historical data
- Real-time signal generation
- Technical indicator calculations (EMA, RSI, MACD, etc.)
- Strategy management and performance tracking

---

## Architecture

### Two-Service Design

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (React - Port 5173)               │
│  • Strategy Management UI                               │
│  • Backtest Configuration & Results                     │
│  • Live Signal Dashboard                                │
│  • Performance Charts                                   │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│          NODE.JS BACKEND (Port 3000)                    │
│  ✅ EXISTING:                                           │
│  • User authentication (JWT)                            │
│  • Stock price monitoring                               │
│  • Magic Line & Trade Plan features                     │
│  • Real-time broadcasting (Socket.IO)                   │
│  • Historical data scraping                             │
│                                                          │
│  🆕 INTEGRATION LAYER:                                  │
│  • pythonStrategyService.js (HTTP client)               │
│  • TradingStrategy model (user ownership)               │
│  • TradingSignal model (cache from Python)              │
│  • BacktestResult model (cache from Python)             │
│  • /api/strategies routes (CRUD + proxy)                │
│  • /api/backtest routes (trigger + fetch)               │
│  • /api/signals routes (generate + subscribe)           │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST API
┌──────────────────────▼──────────────────────────────────┐
│       PYTHON STRATEGY ENGINE (Port 5000)                │
│  ⚡ EXTERNAL SERVICE                                    │
│  • Backtesting engine                                   │
│  • Signal generation                                    │
│  • Technical indicators (TA-Lib)                        │
│  • Strategy plugins                                     │
│  • Performance metrics                                  │
└──────────────────────┬──────────────────────────────────┘
                       │ MongoDB (Read OHLCV data)
┌──────────────────────▼──────────────────────────────────┐
│                 MONGODB DATABASE                        │
│  • stocks, users, magiclines, tradeplans               │
│  • psxdailies, psxweeklies, psxmonthlies (OHLCV)      │
│  • tradingstrategies (Node.js managed)                  │
│  • tradingsignals (cached from Python)                  │
│  • backtestresults (cached from Python)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Responsibility Matrix

| Task | Node.js | Python |
|------|---------|--------|
| User Authentication | ✅ | ❌ |
| Strategy Ownership | ✅ | ❌ |
| Strategy Metadata Storage | ✅ | ❌ |
| Strategy Computation | ❌ | ✅ |
| Backtest Execution | ❌ | ✅ |
| Backtest Result Caching | ✅ | ❌ |
| Signal Generation Logic | ❌ | ✅ |
| Signal Caching | ✅ | ❌ |
| Real-time Broadcasting | ✅ | ❌ |
| OHLCV Data Scraping | ✅ | ❌ |
| OHLCV Data Reading | ✅ | ✅ |
| Performance Metrics | ❌ | ✅ |

---

## Python API Endpoints

### 1. Health Check
```http
GET /health

Response:
{
  "status": "healthy",
  "service": "python-strategy-engine",
  "version": "1.0.0"
}
```

### 2. List Available Strategies
```http
GET /api/strategies

Response:
{
  "success": true,
  "strategies": [
    {
      "name": "ema_crossover",
      "description": "EMA Crossover Strategy with RSI filter",
      "parameters": {
        "fast_period": {"type": "integer", "default": 9},
        "slow_period": {"type": "integer", "default": 21}
      },
      "timeframes": ["daily", "weekly"]
    }
  ]
}
```

### 3. Generate Signals
```http
POST /api/signals/generate

Request:
{
  "symbol": "OGDC",
  "strategy": "ema_crossover",
  "config": {
    "fast_period": 9,
    "slow_period": 21
  },
  "timeframe": "daily"
}

Response:
{
  "success": true,
  "signal": "BUY",
  "price": 85.50,
  "indicators": {
    "ema_fast": 84.20,
    "ema_slow": 83.10,
    "rsi": 45.23
  },
  "reasoning": "EMA(9) crossed above EMA(21), RSI=45.23"
}
```

### 4. Run Backtest
```http
POST /api/backtest/run

Request:
{
  "symbol": "OGDC",
  "strategy": "ema_crossover",
  "config": {"fast_period": 9, "slow_period": 21},
  "start_date": "2023-01-01",
  "end_date": "2024-12-31",
  "initial_capital": 100000
}

Response:
{
  "success": true,
  "performance": {
    "total_return": 25.43,
    "win_rate": 66.67,
    "profit_factor": 2.15,
    "sharpe_ratio": 1.85,
    "max_drawdown": 8.52
  },
  "trades": [
    {
      "type": "BUY",
      "date": "2023-03-15",
      "price": 82.50,
      "shares": 606
    }
  ]
}
```

---

## Node.js Models

### TradingStrategy

```javascript
{
  userId: ObjectId(User),
  name: String,                     // "My EMA Strategy"
  description: String,
  pythonStrategy: String,           // "ema_crossover"
  pythonConfig: {
    fast_period: Number,
    slow_period: Number,
    timeframe: String               // "daily" | "weekly"
  },
  isActive: Boolean,
  performance: {
    winRate: Number,
    profitFactor: Number,
    sharpeRatio: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### TradingSignal

```javascript
{
  userId: ObjectId(User),
  symbol: String,
  signalType: String,               // "BUY" | "SELL"
  price: Number,
  date: Date,
  strategyId: ObjectId(TradingStrategy),
  indicators: Object,
  reasoning: String,
  isExecuted: Boolean,
  createdAt: Date
}
```

### BacktestResult

```javascript
{
  userId: ObjectId(User),
  strategyId: ObjectId(TradingStrategy),
  symbol: String,
  dateRange: {
    from: Date,
    to: Date
  },
  performance: Object,              // Full performance from Python
  trades: Array,                    // Full trade list
  status: String,                   // "completed" | "failed"
  createdAt: Date
}
```

---

## Workflow: Running a Backtest

```
1. User Action (Frontend):
   - Selects strategy "EMA Crossover"
   - Chooses symbol "OGDC"
   - Sets date range: 2023-01-01 to 2024-01-01
   - Clicks "Run Backtest"

2. Frontend → Node.js:
   POST /api/backtest/run
   {
     strategyId: "67890",
     symbol: "OGDC",
     startDate: "2023-01-01",
     endDate: "2024-01-01",
     initialCapital: 100000
   }

3. Node.js Processing:
   - Validates user owns strategy
   - Gets Python strategy config from TradingStrategy model
   - Calls Python service

4. Node.js → Python:
   POST http://localhost:5000/api/backtest/run
   {
     symbol: "OGDC",
     strategy: "ema_crossover",
     config: {fast_period: 9, slow_period: 21},
     start_date: "2023-01-01",
     end_date: "2024-01-01",
     initial_capital: 100000
   }

5. Python Service:
   - Fetches OHLCV from MongoDB
   - Runs backtest
   - Calculates metrics
   - Returns results

6. Node.js:
   - Creates BacktestResult document
   - Updates TradingStrategy.performance
   - Returns backtest ID to frontend

7. Frontend:
   - Displays results
   - Shows equity curve chart
   - Shows trade list table
   - Displays performance metrics
```

---

## Implementation Status

### ✅ Complete

- Backend models (TradingStrategy, TradingSignal, BacktestResult)
- Python service HTTP client (pythonStrategyService.js)
- API routes (/api/strategies, /api/backtest, /api/signals)
- Frontend components (9 components total)
- Visualization with lightweight-charts
- Route registration
- ES6 module conversion

### 🔜 Next Steps

1. **Test with Python Service**
   - Ensure Python service is running
   - Test all API endpoints
   - Verify data flow end-to-end

2. **Integration Testing**
   - Test error scenarios
   - Verify user-friendly error messages
   - Performance testing with multiple strategies

3. **Production Readiness**
   - Add request caching
   - Implement circuit breaker
   - Performance monitoring
   - Load testing

---

## Frontend Components

### 1. TradingBot.jsx
Main container with tabbed interface (Strategies, Backtest, Signals)

### 2. StrategyManager.jsx
- Create/Edit/Delete strategies
- Configure strategy parameters
- Activate/Deactivate for live trading
- View strategy performance metrics

### 3. BacktestRunner.jsx
- Strategy selection
- Symbol selection
- Date range picker
- Capital and position sizing configuration
- Backtest history viewer

### 4. SignalDashboard.jsx
- Real-time signal feed with WebSocket
- Filter by symbol, type, status, date
- Mark signals as executed
- Signal statistics cards

### 5. Visualization Components

**BacktestChart:**
- Candlestick chart with buy/sell markers
- Uses lightweight-charts library
- Interactive zoom and pan
- Hover tooltips

**EquityCurveChart:**
- Portfolio value over time
- Drawdown shading
- Peak markers

**PerformanceMetricsCard:**
- Win rate, profit factor, Sharpe ratio
- Visual progress bars
- Color-coded metrics

**TradeListTable:**
- Sortable/filterable trade history
- Click row to highlight on chart
- Export to CSV

---

## Configuration

### Environment Variables

```env
# Python Service
PYTHON_SERVICE_URL=http://localhost:5000
PYTHON_SERVICE_TIMEOUT=30000
PYTHON_SERVICE_RETRY_ATTEMPTS=3
PYTHON_SERVICE_RETRY_DELAY=1000

# Features
ENABLE_PYTHON_INTEGRATION=true
ENABLE_AUTO_SIGNAL_GENERATION=true
SIGNAL_CHECK_INTERVAL=300000  # 5 minutes
```

---

## Error Handling

### Python Error Codes

| Code | Meaning | Node.js Action |
|------|---------|----------------|
| `INVALID_SYMBOL` | Symbol not found | Return 404 to user |
| `INVALID_STRATEGY` | Strategy not found | Return 404 to user |
| `INVALID_CONFIG` | Invalid parameters | Return 400 to user |
| `INSUFFICIENT_DATA` | Not enough candles | Show error message |
| `MONGODB_ERROR` | DB connection failed | Retry 3 times |
| `CALCULATION_ERROR` | Indicator failed | Log & return 500 |
| `TIMEOUT` | Request too long | Retry once |

### Node.js Error Handling

```javascript
try {
  const result = await pythonService.runBacktest(params);
  // Success
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({error: 'Service unavailable'});
  }
  if (error.response?.status === 400) {
    return res.status(400).json({error: error.response.data.error});
  }
  // Unknown error
  return res.status(500).json({error: 'Internal error'});
}
```

---

## Performance Expectations

| Operation | Python Time | Node.js Overhead | Total |
|-----------|-------------|------------------|-------|
| List strategies | < 100ms | + 50ms | ~150ms |
| Generate signal | 1-2 seconds | + 100ms | ~2s |
| Run backtest (1 year) | 3-5 seconds | + 200ms | ~5s |
| Batch signals (100) | 30-60 seconds | + 500ms | ~60s |

---

## Technical Indicators (Python Handles)

- **EMA** (Exponential Moving Average) - Trend following
- **RSI** (Relative Strength Index) - Momentum (0-100)
- **MACD** (Moving Average Convergence Divergence) - Trend
- **Bollinger Bands** - Volatility
- **Stochastic** - Momentum oscillator
- **ATR** (Average True Range) - Volatility

All calculations done by Python using TA-Lib library.

---

## Success Criteria

### Integration is successful when:
✅ Node.js can call all 8 Python endpoints  
✅ User can create strategies via UI  
✅ User can run backtests and see results  
✅ Signals auto-generate during market hours  
✅ Signals broadcast in real-time to frontend  
✅ Python service failure doesn't crash Node.js  
✅ System handles 100+ symbols without issues  
✅ Response times are acceptable (< 5 seconds)  

---

## Files Created

### Backend (7 files)
```
backend/src/
├── models/
│   ├── TradingStrategy.js
│   ├── TradingSignal.js
│   └── BacktestResult.js
├── services/
│   └── pythonStrategyService.js
└── routes/
    ├── strategies.js
    ├── backtest.js
    └── signals.js
```

### Frontend (9 files)
```
frontend/src/components/TradingBot/
├── TradingBot.jsx
├── StrategyManager.jsx
├── BacktestRunner.jsx
├── SignalDashboard.jsx
├── BacktestChart.jsx
├── EquityCurveChart.jsx
├── PerformanceMetricsCard.jsx
├── TradeListTable.jsx
└── SignalChart.jsx
```

---

## Next Actions

1. ✅ Review this consolidated documentation
2. ✅ Set up Python service locally (Port 5000)
3. ✅ Test end-to-end integration
4. ✅ Add navigation link to Trading Bot in Header
5. ✅ Deploy to production
6. ✅ Monitor performance and errors

---

**Status:** ✅ Ready for Testing  
**Branch:** `feature/trading-bot-integration`  
**Next:** Start Python service and test integration

