# 🤝 Integration Contract: Node.js ↔ Python Strategy Engine

**Version:** 1.0  
**Date:** October 30, 2025  
**Status:** ✅ ACTIVE - Both teams must follow this contract

---

## 📋 PURPOSE

This is the **SINGLE SOURCE OF TRUTH** for integration between:
- **Node.js Backend** (Port 3000) - User management, caching, orchestration
- **Python Strategy Engine** (Port 5000) - Computation, backtesting, signals

**⚠️ CRITICAL:** Any changes to APIs, data formats, or workflows MUST be updated here first.

---

## 🎯 RESPONSIBILITY MATRIX

| Task | Node.js | Python | Notes |
|------|---------|--------|-------|
| User Authentication | ✅ | ❌ | JWT, sessions |
| Strategy Ownership | ✅ | ❌ | Users own strategies |
| Strategy Metadata Storage | ✅ | ❌ | MongoDB (Node.js) |
| Strategy Computation | ❌ | ✅ | Indicators, signals |
| Backtest Execution | ❌ | ✅ | Heavy computation |
| Backtest Result Caching | ✅ | ❌ | MongoDB (Node.js) |
| Signal Generation Logic | ❌ | ✅ | Technical analysis |
| Signal Caching | ✅ | ❌ | MongoDB (Node.js) |
| Real-time Broadcasting | ✅ | ❌ | Socket.IO |
| OHLCV Data Scraping | ✅ | ❌ | Node.js scraper |
| OHLCV Data Reading | ✅ | ✅ | Both read MongoDB |
| Performance Metrics | ❌ | ✅ | Sharpe, drawdown |
| API Gateway | ✅ | ❌ | Frontend → Node.js only |
| Request Retry Logic | ✅ | ❌ | Node.js handles retries |

---

## 📡 PYTHON API ENDPOINTS (Port 5000)

### **1. Health Check**
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "service": "python-strategy-engine",
  "version": "1.0.0",
  "environment": "production"
}
```
**Node.js Usage:** Poll every 30 seconds, enable circuit breaker if unhealthy

---

### **2. List Available Strategies**
```http
GET /api/strategies
```
**Response:**
```json
{
  "success": true,
  "strategies": [
    {
      "name": "ema_crossover",
      "class": "EMACrossoverStrategy",
      "description": "EMA Crossover Strategy with RSI filter",
      "metadata": {
        "parameters": {
          "fast_period": {"type": "integer", "default": 9, "min": 5, "max": 50},
          "slow_period": {"type": "integer", "default": 21, "min": 10, "max": 200},
          "rsi_period": {"type": "integer", "default": 14}
        },
        "timeframes": ["daily", "weekly"],
        "entry_conditions": "EMA(9) crosses above EMA(21) AND RSI < 70",
        "exit_conditions": "EMA(9) crosses below EMA(21) AND RSI > 30"
      }
    }
  ],
  "total": 3
}
```
**Node.js Usage:** Cache for 5 minutes, use for strategy selection UI

---

### **3. Generate Signals**
```http
POST /api/signals/generate
Content-Type: application/json
```
**Request:**
```json
{
  "symbol": "OGDC",
  "strategy": "ema_crossover",
  "config": {
    "fast_period": 9,
    "slow_period": 21,
    "rsi_period": 14,
    "timeframe": "daily"
  },
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```
**Response:**
```json
{
  "success": true,
  "symbol": "OGDC",
  "strategy": "ema_crossover",
  "signals": [
    {
      "date": "2024-03-15T00:00:00",
      "type": "BUY",
      "price": 85.50,
      "reason": "EMA(9) crossed above EMA(21), RSI=45.23",
      "indicators": {
        "ema_fast": 84.20,
        "ema_slow": 83.10,
        "rsi": 45.23
      }
    }
  ],
  "total_signals": 12,
  "buy_signals": 6,
  "sell_signals": 6
}
```
**Node.js Usage:** 
- Call during market hours for active strategies
- Cache in TradingSignal model
- Broadcast via Socket.IO

---

### **4. Batch Signal Generation**
```http
POST /api/signals/batch
Content-Type: application/json
```
**Request:**
```json
{
  "symbols": ["OGDC", "PPL", "MARI"],
  "strategy": "ema_crossover",
  "config": {"fast_period": 9, "slow_period": 21, "timeframe": "daily"},
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```
**Response:**
```json
{
  "success": true,
  "results": {
    "OGDC": {"success": true, "total_signals": 12, "signals": [...]},
    "PPL": {"success": true, "total_signals": 8, "signals": [...]}
  },
  "total_symbols": 3
}
```
**Node.js Usage:** Bulk signal generation during off-peak hours

---

### **5. Run Backtest**
```http
POST /api/backtest/run
Content-Type: application/json
```
**Request:**
```json
{
  "symbol": "OGDC",
  "strategy": "ema_crossover",
  "config": {
    "fast_period": 9,
    "slow_period": 21,
    "timeframe": "daily"
  },
  "start_date": "2023-01-01",
  "end_date": "2024-12-31",
  "initial_capital": 100000,
  "position_sizing": "percentage",
  "position_size_value": 50,
  "commission": 0.15,
  "slippage": 0.1
}
```
**Response:**
```json
{
  "success": true,
  "symbol": "OGDC",
  "strategy": "ema_crossover",
  "period": {"from": "2023-01-01", "to": "2024-12-31", "days": 730},
  "signals": {"total": 24, "buy": 12, "sell": 12},
  "trades": [
    {
      "type": "BUY",
      "date": "2023-03-15T00:00:00",
      "price": 82.50,
      "shares": 606,
      "cost": 50045.15,
      "commission": 75.07,
      "indicators": {"ema_fast": 81.20, "ema_slow": 80.10, "rsi": 42.30}
    },
    {
      "type": "SELL",
      "date": "2023-05-20T00:00:00",
      "price": 88.30,
      "shares": 606,
      "proceeds": 53390.55,
      "profit_loss": 3265.33,
      "profit_loss_percent": 6.52
    }
  ],
  "performance": {
    "initial_capital": 100000,
    "final_equity": 125430.50,
    "total_return": 25430.50,
    "total_return_percent": 25.43,
    "total_trades": 12,
    "winning_trades": 8,
    "losing_trades": 4,
    "win_rate": 66.67,
    "profit_factor": 2.15,
    "sharpe_ratio": 1.85,
    "max_drawdown": 8.52
  }
}
```
**Node.js Usage:** 
- Store entire response in BacktestResult model
- Display in frontend
- Cache for future reference

---

### **6. List Symbols**
```http
GET /api/symbols
```
**Response:**
```json
{
  "success": true,
  "symbols": ["OGDC", "PPL", "MARI", "PSO", "ENGRO"],
  "total": 150
}
```

---

### **7. Get Symbol Info**
```http
GET /api/symbols/:symbol
```
**Response:**
```json
{
  "success": true,
  "symbol": "OGDC",
  "date_range": {
    "from": "2020-01-01T00:00:00",
    "to": "2024-12-31T00:00:00",
    "total_records": 1250
  },
  "latest_price": 85.50
}
```

---

### **8. Get Strategy Details**
```http
GET /api/strategies/:name
```
**Response:**
```json
{
  "success": true,
  "strategy": {
    "name": "ema_crossover",
    "metadata": {/* full metadata */}
  }
}
```

---

## 🗄️ NODE.JS MONGODB MODELS

### **TradingStrategy**
```javascript
{
  _id: ObjectId,
  userId: ObjectId(User),              // Owner
  name: String,                        // "My EMA Strategy"
  description: String,                 // Optional
  pythonStrategy: String,              // "ema_crossover" (from Python)
  pythonConfig: {                      // Config sent to Python
    fast_period: Number,
    slow_period: Number,
    rsi_period: Number,
    timeframe: String                  // "daily" | "weekly" | "monthly"
  },
  isActive: Boolean,                   // Enable for live signals
  lastBacktestDate: Date,
  lastSignalDate: Date,
  performance: {                       // Cached from last backtest
    winRate: Number,
    profitFactor: Number,
    sharpeRatio: Number,
    totalReturn: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### **TradingSignal**
```javascript
{
  _id: ObjectId,
  userId: ObjectId(User),
  symbol: String,                      // "OGDC"
  signalType: String,                  // "BUY" | "SELL"
  price: Number,
  date: Date,
  strategyId: ObjectId(TradingStrategy),
  strategyName: String,                // Cached for display
  indicators: Object,                  // From Python response
  reasoning: String,                   // Why this signal
  source: String,                      // "python_service"
  isExecuted: Boolean,                 // User marked as executed
  executedAt: Date,
  executedPrice: Number,
  createdAt: Date
}
```

### **BacktestResult**
```javascript
{
  _id: ObjectId,
  userId: ObjectId(User),
  strategyId: ObjectId(TradingStrategy),
  symbol: String,
  dateRange: {
    from: Date,
    to: Date
  },
  config: Object,                      // Backtest config
  performance: Object,                 // Full performance from Python
  trades: Array,                       // Full trade list from Python
  status: String,                      // "completed" | "failed"
  error: String,                       // If failed
  createdAt: Date,
  completedAt: Date
}
```

---

## 🔄 WORKFLOW 1: User Creates Strategy

```
1. Frontend → Node.js:
   POST /api/strategies
   {
     name: "My EMA Strategy",
     pythonStrategy: "ema_crossover",
     config: {fast_period: 9, slow_period: 21, timeframe: "daily"}
   }

2. Node.js:
   - Authenticate user
   - Validate pythonStrategy exists (call Python GET /api/strategies)
   - Create TradingStrategy document
   - Return strategy to frontend

3. Frontend:
   - Display success
   - Add to user's strategy list
```

---

## 🔄 WORKFLOW 2: User Runs Backtest

```
1. Frontend → Node.js:
   POST /api/backtest/run
   {
     strategyId: "67890abc",
     symbol: "OGDC",
     startDate: "2023-01-01",
     endDate: "2024-12-31",
     initialCapital: 100000
   }

2. Node.js:
   - Validate user owns strategy
   - Get TradingStrategy document
   - Extract pythonStrategy and pythonConfig
   
3. Node.js → Python:
   POST http://localhost:5000/api/backtest/run
   {
     symbol: "OGDC",
     strategy: "ema_crossover",
     config: {fast_period: 9, slow_period: 21, timeframe: "daily"},
     start_date: "2023-01-01",
     end_date: "2024-12-31",
     initial_capital: 100000,
     position_sizing: "percentage",
     position_size_value: 50
   }

4. Python:
   - Fetch OHLCV from MongoDB
   - Run backtest
   - Calculate metrics
   - Return results

5. Node.js:
   - Create BacktestResult document
   - Update TradingStrategy.performance
   - Return backtest ID to frontend

6. Frontend:
   - Display results
   - Show equity curve
   - Show trade list
```

---

## 🔄 WORKFLOW 3: Automated Signal Generation

```
1. Node.js Cron (Every 5 minutes during market hours):
   - Trigger after centralizedPriceService updates
   - Get active strategies: TradingStrategy.find({isActive: true})
   - Get symbols from user trade plans
   
2. For each (symbol, strategy):
   - Check if signal already generated today
   - If not, call Python service

3. Node.js → Python:
   POST http://localhost:5000/api/signals/generate
   {
     symbol: "OGDC",
     strategy: "rsi_oversold",
     config: {rsi_period: 14, oversold: 30, timeframe: "daily"}
   }

4. Python:
   - Fetch latest OHLCV
   - Calculate indicators
   - Check for signals
   - Return signal (if any)

5. Node.js (if signal received):
   - Create TradingSignal document
   - Broadcast via Socket.IO: io.emit('new-signal', {...})
   - Send push notification (if enabled)

6. Frontend:
   - Receive via WebSocket
   - Show notification
   - Update dashboard
```

---

## 🔒 ERROR HANDLING

### **Python Error Codes**

| Code | Meaning | Node.js Action |
|------|---------|----------------|
| `INVALID_SYMBOL` | Symbol not found | Return 404 to user |
| `INVALID_STRATEGY` | Strategy not found | Return 404 to user |
| `INVALID_CONFIG` | Invalid parameters | Return 400 to user |
| `INSUFFICIENT_DATA` | Not enough candles | Return 400 to user |
| `MONGODB_ERROR` | Database error | Retry 3 times, then 503 |
| `CALCULATION_ERROR` | Indicator failed | Log error, return 500 |
| `TIMEOUT` | Request too long | Retry once, then 504 |

### **Python Error Response Format**
```json
{
  "success": false,
  "error": "Error message",
  "error_code": "INVALID_SYMBOL"
}
```

### **Node.js Error Handling**
```javascript
try {
  const result = await pythonService.runBacktest(params);
  // Success
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    // Python service down
    return res.status(503).json({error: 'Service unavailable'});
  }
  if (error.response?.status === 400) {
    // Invalid request
    return res.status(400).json({error: error.response.data.error});
  }
  if (error.code === 'ETIMEDOUT') {
    // Timeout
    return res.status(504).json({error: 'Request timeout'});
  }
  // Unknown error
  return res.status(500).json({error: 'Internal error'});
}
```

---

## 🔧 CONFIGURATION

### **Node.js Environment Variables**
```bash
# Python Service
PYTHON_SERVICE_URL=http://localhost:5000
PYTHON_SERVICE_TIMEOUT=30000        # 30 seconds
PYTHON_SERVICE_RETRY_ATTEMPTS=3
PYTHON_SERVICE_RETRY_DELAY=1000     # 1 second

# Features
ENABLE_PYTHON_INTEGRATION=true
ENABLE_AUTO_SIGNAL_GENERATION=true
SIGNAL_CHECK_INTERVAL=300000        # 5 minutes

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000       # 60 seconds
```

### **Python Environment Variables**
```bash
# MongoDB (Read-Only)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=psx_smartdesk

# Flask
PORT=5000
FLASK_ENV=production

# Performance
WORKERS=4
CACHE_TTL=300
```

---

## 🚀 IMPLEMENTATION PHASES

### **Phase 1: Foundation (Week 1)**
- [ ] Create `pythonStrategyService.js` HTTP client
- [ ] Implement health check monitoring
- [ ] Test basic connectivity
- [ ] Add error handling & logging

### **Phase 2: Strategy Management (Week 2)**
- [ ] Create TradingStrategy model
- [ ] Create `/api/strategies` routes
- [ ] Implement CRUD operations
- [ ] Frontend: StrategyManager component

### **Phase 3: Backtesting (Week 3)**
- [ ] Create BacktestResult model
- [ ] Create `/api/backtest` routes
- [ ] Implement async backtest triggering
- [ ] Frontend: BacktestRunner component

### **Phase 4: Signal Generation (Week 4)**
- [ ] Create TradingSignal model
- [ ] Create `/api/signals` routes
- [ ] Integrate with centralizedPriceService
- [ ] Auto-generate signals during market hours
- [ ] Frontend: SignalDashboard component

### **Phase 5: Production Ready (Week 5)**
- [ ] Add request caching
- [ ] Implement circuit breaker
- [ ] Performance monitoring
- [ ] Load testing

---

## ✅ DEPLOYMENT CHECKLIST

### **Python Service**
- [ ] Python 3.9+ installed
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` configured with MongoDB URI
- [ ] Service starts: `python app.py`
- [ ] Health check responds: `curl http://localhost:5000/health`
- [ ] Strategies load (check logs)
- [ ] Port 5000 accessible from Node.js server

### **Node.js Integration**
- [ ] `pythonStrategyService.js` created
- [ ] Environment variables configured
- [ ] Models created (TradingStrategy, TradingSignal, BacktestResult)
- [ ] API routes implemented
- [ ] Error handling tested
- [ ] Circuit breaker configured

---

## 📊 MONITORING

### **Key Metrics**
- Python service uptime (target: > 99%)
- Request latency (target: < 5 seconds)
- Request failure rate (target: < 1%)
- Backtest queue length (alert if > 10)
- Signal generation rate

### **Health Check**
Node.js should poll Python `/health` every 30 seconds:
```javascript
setInterval(async () => {
  try {
    const health = await axios.get('http://localhost:5000/health');
    if (health.data.status !== 'healthy') {
      logger.error('Python service unhealthy');
      // Enable circuit breaker
    }
  } catch (error) {
    logger.error('Python service unreachable');
    // Enable circuit breaker
  }
}, 30000);
```

---

## 📞 CONTACT & COORDINATION

### **Python Team**
- **Service:** Python Strategy Engine (Port 5000)
- **Documentation:** `README.md`, `QUICKSTART.md`
- **Health Check:** `GET /health`
- **Logs:** `logs/strategy_engine.log`

### **Node.js Team**
- **Service:** Node.js Backend (Port 3000)
- **Integration Client:** `pythonStrategyService.js`
- **Models:** `TradingStrategy`, `TradingSignal`, `BacktestResult`

### **Communication Protocol**
1. **API Changes:** Update this document FIRST, then implement
2. **Bug Reports:** Include request/response logs from both sides
3. **New Features:** Discuss impact on both systems before coding
4. **Deployment:** Coordinate to avoid downtime

---

## 🎯 SUCCESS CRITERIA

### **Integration is successful when:**
✅ Node.js can call all 8 Python endpoints  
✅ User can create strategies via UI  
✅ User can run backtests and see results  
✅ Signals auto-generate during market hours  
✅ Signals broadcast in real-time to frontend  
✅ Python service failure doesn't crash Node.js  
✅ System handles 100+ symbols without issues  
✅ Response times are acceptable (< 5 seconds)  

---

**Document Version:** 1.0  
**Last Updated:** October 30, 2025  
**Next Review:** When adding new features or changing APIs

**⚠️ IMPORTANT:** Both teams must keep this document updated. Any API changes MUST be reflected here immediately.
