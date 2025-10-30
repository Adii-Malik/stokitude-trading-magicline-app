# Python Strategy Engine Integration Plan

**Project**: PSX SmartDesk - Python Microservice Integration  
**Date**: October 30, 2025  
**Status**: ✅ SYNCED with Integration Contract v1.0

---

## 📌 OVERVIEW

This document outlines how the Node.js backend will integrate with the Python strategy engine microservice for backtesting, signal generation, and technical analysis.

**🔗 Related Documents:**
- `INTEGRATION_CONTRACT.md` - Single source of truth for APIs and workflows
- `TRADING_BOT_COMPLETE_GUIDE.md` - Technical implementation details
- `MASTER_PLAN.md` - Strategic planning and phases

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                           │
│              (React Frontend - Port 5173)                   │
│  • Strategy Management UI                                   │
│  • Backtest Configuration & Results                         │
│  • Live Signal Dashboard                                    │
│  • Performance Charts                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              NODE.JS BACKEND (Port 3000)                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  INTEGRATION LAYER                                 │    │
│  │  • pythonStrategyService.js (HTTP Client)          │    │
│  │  • Request/Response transformation                 │    │
│  │  • Error handling & retry logic                    │    │
│  │  • Caching layer (optional)                        │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  COORDINATION MODELS (Node.js MongoDB)             │    │
│  │  • TradingStrategy (metadata, user ownership)      │    │
│  │  • TradingSignal (cache signals from Python)       │    │
│  │  • BacktestResult (cache results from Python)      │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  API ROUTES                                        │    │
│  │  • /api/strategies (CRUD + list Python strategies) │    │
│  │  • /api/backtest (trigger & fetch results)         │    │
│  │  • /api/signals (fetch & subscribe to signals)     │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│         PYTHON STRATEGY ENGINE (Port 5000)                  │
│  • Backtesting engine                                       │
│  • Signal generation                                        │
│  • Technical indicators (TA-Lib)                            │
│  • Strategy plugins                                         │
│  • Performance metrics calculation                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ MongoDB Connection
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  MONGODB DATABASE                           │
│  • psxdailies (OHLCV data - already exists)                │
│  • psxweeklies (aggregated data - already exists)          │
│  • psxmonthlies (aggregated data - already exists)         │
│  • stocks (symbol metadata - already exists)               │
│  • tradingstrategies (Node.js managed)                     │
│  • tradingsignals (Node.js cached)                         │
│  • backtestresults (Node.js cached)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 INTEGRATION APPROACH

### **Design Principle: Separation of Concerns**

- **Python Service**: Heavy computation (backtesting, indicators, signal generation)
- **Node.js Backend**: Orchestration, user management, caching, API gateway
- **Frontend**: User interface for managing strategies and viewing results

### **Why This Architecture?**

✅ **Best of Both Worlds**: Python for data science, Node.js for real-time & web  
✅ **Scalability**: Services can scale independently  
✅ **Maintainability**: Clear boundaries between systems  
✅ **Performance**: Python service runs computations, Node.js serves results quickly  
✅ **Flexibility**: Can swap Python service without touching Node.js logic

---

## 📦 COMPONENTS TO BUILD

### **1. Python Service Client (Node.js)**

**File**: `backend/src/services/pythonStrategyService.js`

**Purpose**: HTTP client to communicate with Python microservice

**Key Methods** (matches INTEGRATION_CONTRACT.md):
```javascript
class PythonStrategyService {
  constructor() {
    this.baseUrl = config.pythonService.baseUrl;
    this.timeout = config.pythonService.timeout;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Health Check (Contract: GET /health)
  async healthCheck()
  
  // Strategy Management (Contract: GET /api/strategies, GET /api/strategies/:name)
  async listStrategies()
  async getStrategy(name)
  
  // Signal Generation (Contract: POST /api/signals/generate, POST /api/signals/batch)
  async generateSignals(params)
  async batchGenerateSignals(params)
  
  // Backtesting (Contract: POST /api/backtest/run)
  async runBacktest(params)
  
  // Symbols (Contract: GET /api/symbols, GET /api/symbols/:symbol)
  async getAvailableSymbols()
  async getSymbolInfo(symbol)
}
```

**Features**:
- Axios HTTP client with timeout & retry
- Request/response validation
- Error handling & logging
- Connection pooling
- Circuit breaker pattern (optional)

---

### **2. Node.js Models (Coordination Layer)**

#### **Model: TradingStrategy** (matches INTEGRATION_CONTRACT.md)

**Purpose**: Store strategy metadata and user ownership in Node.js

```javascript
{
  _id: ObjectId,
  userId: ObjectId(User),           // Owner
  name: String,                     // "My EMA Strategy"
  description: String,              // Optional
  pythonStrategy: String,           // "ema_crossover" (from Python)
  pythonConfig: {                   // Config sent to Python
    fast_period: Number,
    slow_period: Number,
    rsi_period: Number,
    timeframe: String               // "daily" | "weekly" | "monthly"
  },
  isActive: Boolean,                // Enable for live signals
  lastBacktestDate: Date,
  lastSignalDate: Date,
  performance: {                    // Cached from last backtest
    winRate: Number,
    profitFactor: Number,
    sharpeRatio: Number,
    totalReturn: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### **Model: TradingSignal** (matches INTEGRATION_CONTRACT.md)

**Purpose**: Cache signals from Python service

```javascript
{
  _id: ObjectId,
  userId: ObjectId(User),
  symbol: String,                   // "OGDC"
  signalType: String,               // "BUY" | "SELL"
  price: Number,
  date: Date,
  strategyId: ObjectId(TradingStrategy),
  strategyName: String,             // Cached for display
  indicators: Object,               // From Python response
  reasoning: String,                // Why this signal
  source: String,                   // "python_service"
  isExecuted: Boolean,              // User marked as executed
  executedAt: Date,
  executedPrice: Number,
  createdAt: Date
}
```

#### **Model: BacktestResult** (matches INTEGRATION_CONTRACT.md)

**Purpose**: Cache backtest results from Python service

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
  config: Object,                   // Backtest config
  performance: Object,              // Full performance from Python
  trades: Array,                    // Full trade list from Python
  status: String,                   // "completed" | "failed"
  error: String,                    // If failed
  createdAt: Date,
  completedAt: Date
}
```

**Important**: Store the ENTIRE Python response in `performance` and `trades` fields for visualization.

---

### **3. API Routes**

#### **Route: `/api/strategies`**

**Purpose**: Strategy management and Python service proxy

```
GET    /api/strategies              - List user's strategies
GET    /api/strategies/available    - List available Python strategies
GET    /api/strategies/:id          - Get strategy details
POST   /api/strategies              - Create new strategy
PUT    /api/strategies/:id          - Update strategy
DELETE /api/strategies/:id          - Delete strategy
POST   /api/strategies/:id/activate - Activate strategy for live trading
POST   /api/strategies/:id/deactivate - Deactivate strategy
```

#### **Route: `/api/backtest`**

**Purpose**: Trigger and manage backtests

```
POST   /api/backtest/run            - Trigger backtest (async)
GET    /api/backtest/:id            - Get backtest result
GET    /api/backtest/:id/status     - Check backtest status
GET    /api/backtest/history        - List user's backtests
DELETE /api/backtest/:id            - Delete backtest result
```

#### **Route: `/api/signals`**

**Purpose**: Fetch and manage trading signals

```
GET    /api/signals                 - List recent signals
GET    /api/signals/:id             - Get signal details
POST   /api/signals/generate        - Generate signal for symbol
POST   /api/signals/batch           - Generate signals for multiple symbols
PUT    /api/signals/:id/execute     - Mark signal as executed
GET    /api/signals/live            - SSE endpoint for live signals
```

#### **Route: `/api/python/health`**

**Purpose**: Monitor Python service health

```
GET    /api/python/health           - Python service health check
GET    /api/python/symbols          - Available symbols in Python service
GET    /api/python/symbols/:symbol  - Symbol info from Python service
```

---

### **4. Frontend Components**

#### **Component: StrategyManager**

**Purpose**: CRUD interface for strategies

**Features**:
- List available Python strategies
- Create custom strategy configuration
- Edit strategy parameters
- Activate/deactivate for live trading
- View strategy performance

#### **Component: BacktestRunner**

**Purpose**: Configure and run backtests

**Features**:
- Select strategy
- Choose symbols (multi-select)
- Date range picker
- Capital & position sizing
- Start backtest (async)
- View real-time progress
- Display results (metrics, equity curve, trades)

#### **Component: SignalDashboard**

**Purpose**: View live and historical signals

**Features**:
- Real-time signal feed
- Filter by symbol, strategy, date
- Signal details (TP/SL, reasoning, indicators)
- Mark as executed
- Chart visualization (lightweight-charts)
- Export signals

#### **Component: PythonServiceMonitor**

**Purpose**: Admin panel for Python service health

**Features**:
- Connection status
- Response time
- Available symbols count
- Last successful request
- Error logs

---

### **5. Visualization Components (Node.js Side)**

> **Note:** Python service returns RAW data only. All chart rendering happens in Node.js/React frontend.

#### **Component: BacktestChart** 

**Purpose**: Visualize backtest results with buy/sell signals on candlestick chart

**Library**: `lightweight-charts` (TradingView's free charting library)

**Features**:
- **Candlestick Chart**: Display OHLCV data for backtest period
- **Buy/Sell Markers**: Show entry/exit points on chart
  - Green arrow UP ▲ for BUY signals
  - Red arrow DOWN ▼ for SELL signals
  - Hover to see: date, price, indicators at signal time
- **Equity Curve Overlay**: Optional toggle to show portfolio value over time
- **Indicator Overlays**: Show EMA/SMA lines on price chart
- **Trade Details Panel**: Click on marker to see full trade details
- **Date Range Slider**: Focus on specific period
- **Export**: Download chart as PNG

**Data Flow**:
```
Python Response (trades array) 
→ Node.js transforms to lightweight-charts format
→ Frontend renders interactive chart
```

**Example Trade Marker**:
```javascript
{
  time: '2024-03-15',
  position: 'belowBar',    // Buy marker below candle
  color: '#26a69a',        // Green for BUY
  shape: 'arrowUp',
  text: 'BUY @ 85.50',
  tooltip: {
    indicators: { ema_fast: 84.20, ema_slow: 83.10, rsi: 45.23 },
    shares: 606,
    cost: 50045.15
  }
}
```

#### **Component: EquityCurveChart**

**Purpose**: Show portfolio growth over backtest period

**Library**: `lightweight-charts` (Area series)

**Features**:
- **Area Chart**: Portfolio value over time
- **Drawdown Shading**: Highlight drawdown periods in red
- **Peak Markers**: Show equity peaks
- **Return Annotations**: Show total return percentage
- **Benchmark Comparison**: Compare with buy-and-hold strategy
- **Statistics Panel**: Display metrics alongside chart

**Data Source**: Python response `equity_curve` field (if available) or calculated from trades

#### **Component: SignalChart**

**Purpose**: Visualize live/historical signals on recent price chart

**Features**:
- **Real-time Candles**: Last 100 candles
- **Signal Markers**: Recent BUY/SELL signals
- **Indicator Lines**: Show strategy indicators (EMA, RSI, etc.)
- **Auto-refresh**: Update every 5 minutes during market hours
- **Signal Replay**: Scrub through historical signals
- **Multiple Strategies Toggle**: Compare signals from different strategies

#### **Component: PerformanceMetricsCard**

**Purpose**: Display backtest metrics in clean, visual format

**Features**:
- **Metrics Grid**: Win rate, profit factor, Sharpe ratio, max drawdown
- **Visual Indicators**:
  - Green/Red color coding for good/bad metrics
  - Progress bars for win rate
  - Sparklines for returns distribution
- **Comparison**: Compare against other backtests
- **Export**: Download metrics as CSV

**Metrics Displayed**:
```
┌─────────────────────────────────────────────────┐
│  Total Return        │  +25.43%    [████████]   │
│  Win Rate            │   66.67%    [██████░░]   │
│  Profit Factor       │   2.15      [█████░░░]   │
│  Sharpe Ratio        │   1.85      [████░░░░]   │
│  Max Drawdown        │  -8.52%     [███░░░░░]   │
│  Total Trades        │   12                     │
│  Winning Trades      │    8                     │
│  Losing Trades       │    4                     │
└─────────────────────────────────────────────────┘
```

#### **Component: TradeListTable**

**Purpose**: Display all trades from backtest in sortable table

**Features**:
- **Columns**: Date, Type, Symbol, Price, Shares, P/L, P/L%, Indicators
- **Sortable**: Click column headers to sort
- **Filterable**: Filter by profitable/losing trades
- **Row Click**: Highlight trade on chart
- **Export**: Download trade list as CSV
- **Pagination**: Handle 100+ trades

**Data Source**: Python response `trades` array

---

### **6. Visualization Strategy Summary**

| Visualization | Responsibility | Library | Data Source |
|---------------|----------------|---------|-------------|
| Candlestick Chart | Frontend (React) | lightweight-charts | Python response |
| Buy/Sell Markers | Frontend (React) | lightweight-charts | Python `trades` |
| Equity Curve | Frontend (React) | lightweight-charts | Python `equity_curve` or calculated |
| Indicator Overlays | Frontend (React) | lightweight-charts | Python `indicators` |
| Performance Metrics | Frontend (React) | Custom components | Python `performance` |
| Trade Table | Frontend (React) | React Table | Python `trades` |

**Key Point**: Python does NOT generate charts. It only returns JSON data. All visualization happens in React using `lightweight-charts`.

---

## 🔄 DATA FLOW SCENARIOS

### **Scenario 1: Running a Backtest**

```
1. User Action:
   - User selects strategy "EMA Crossover"
   - Chooses symbol "OGDC"
   - Date range: 2023-01-01 to 2024-01-01
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
   - Validate user owns strategy
   - Get Python strategy config from TradingStrategy model
   - Call Python service

4. Node.js → Python Service:
   POST http://localhost:5000/api/backtest/run
   {
     symbol: "OGDC",
     strategy: "ema_crossover",
     config: { fast: 9, slow: 21 },
     start_date: "2023-01-01",
     end_date: "2024-01-01",
     initial_capital: 100000
   }

5. Python Service Response:
   {
     backtest_id: "bt_abc123",
     status: "running",
     estimated_time: 30
   }

6. Node.js:
   - Create BacktestResult document (status: 'running')
   - Return backtest ID to frontend

7. Frontend:
   - Poll GET /api/backtest/bt_abc123/status every 2 seconds
   - Show progress indicator

8. When Complete:
   - Node.js fetches result from Python service
   - Updates BacktestResult document
   - Frontend displays results
```

### **Scenario 2: Generating Live Signals**

```
1. Automated Trigger (Every 5 minutes during market hours):
   - centralizedPriceService finishes price update
   - Triggers signal check

2. Node.js:
   - Get active strategies from TradingStrategy.find({ isActive: true })
   - Get symbols from active trade plans
   - For each (symbol, strategy) pair:
     - Check if signal already generated today
     - If not, call Python service

3. Node.js → Python Service:
   POST http://localhost:5000/api/signals/generate
   {
     symbol: "OGDC",
     strategy: "rsi_oversold",
     config: { rsi_period: 14, oversold_level: 30 }
   }

4. Python Service Response:
   {
     signal: "BUY",
     price: 85.50,
     tp1: 88.20,
     tp2: 91.50,
     tp3: 95.00,
     stop_loss: 83.08,
     risk_reward: 2.15,
     reasoning: {
       tp1: "Resistance zone (strength: 3)",
       stop_loss: "Below support (strength: 4)"
     },
     indicators: { rsi: 28.5, ema_9: 84.2 }
   }

5. Node.js:
   - Create TradingSignal document
   - Broadcast via Socket.IO to connected clients
   - Send push notification (if enabled)

6. Frontend:
   - Receives signal via WebSocket
   - Shows notification
   - Updates SignalDashboard in real-time
```

### **Scenario 3: Viewing Available Strategies**

```
1. User Action:
   - Opens Strategy Manager
   - Clicks "Add New Strategy"

2. Frontend → Node.js:
   GET /api/strategies/available

3. Node.js → Python Service:
   GET http://localhost:5000/api/strategies

4. Python Service Response:
   {
     strategies: [
       {
         name: "ema_crossover",
         description: "EMA 9/21 crossover strategy",
         parameters: {
           fast_period: { type: "int", default: 9, min: 5, max: 50 },
           slow_period: { type: "int", default: 21, min: 10, max: 200 }
         },
         timeframes: ["daily", "weekly"]
       },
       {
         name: "rsi_oversold",
         description: "RSI oversold/overbought strategy",
         parameters: {
           rsi_period: { type: "int", default: 14 },
           oversold: { type: "int", default: 30 },
           overbought: { type: "int", default: 70 }
         }
       }
     ]
   }

5. Frontend:
   - Displays strategy list
   - Shows parameter forms
   - User configures and saves
```

---

## 🔧 CONFIGURATION

### **Environment Variables**

```bash
# Python Service Configuration
PYTHON_SERVICE_URL=http://localhost:5000
PYTHON_SERVICE_TIMEOUT=30000        # 30 seconds
PYTHON_SERVICE_RETRY_ATTEMPTS=3
PYTHON_SERVICE_RETRY_DELAY=1000     # 1 second

# Feature Flags
ENABLE_PYTHON_INTEGRATION=true
ENABLE_AUTO_SIGNAL_GENERATION=true
SIGNAL_CHECK_INTERVAL=300000        # 5 minutes
```

### **Python Service Connection**

```javascript
// backend/src/config/pythonService.js
export default {
  baseUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:5000',
  timeout: parseInt(process.env.PYTHON_SERVICE_TIMEOUT) || 30000,
  retryAttempts: parseInt(process.env.PYTHON_SERVICE_RETRY_ATTEMPTS) || 3,
  retryDelay: parseInt(process.env.PYTHON_SERVICE_RETRY_DELAY) || 1000,
  endpoints: {
    strategies: '/api/strategies',
    backtest: '/api/backtest',
    signals: '/api/signals',
    symbols: '/api/symbols',
    health: '/health'
  }
};
```

---

## 🚀 IMPLEMENTATION PHASES (Synced with INTEGRATION_CONTRACT.md)

### **Phase 1: Foundation (Week 1)**

**Goal**: Basic Python service communication

- [ ] Install lightweight-charts: `npm install lightweight-charts`
- [ ] Create `pythonStrategyService.js` client (following contract endpoints)
- [ ] Implement health check monitoring (GET /health)
- [ ] Test basic connectivity with Python service
- [ ] Add error handling & logging (follow contract error codes)
- [ ] Environment configuration (PYTHON_SERVICE_URL, etc.)

**Deliverable**: Node.js can communicate with Python service

---

### **Phase 2: Strategy Management (Week 2)**

**Goal**: Users can manage strategies

- [ ] Create TradingStrategy model (match contract schema)
- [ ] Create `/api/strategies` routes
- [ ] Implement CRUD operations
- [ ] Proxy GET /api/strategies from Python (list available)
- [ ] Frontend: StrategyManager component
- [ ] Test: Create, list, edit, delete strategies

**Deliverable**: Full strategy management UI

---

### **Phase 3: Backtesting + Visualization (Week 3-4)**

**Goal**: Users can run backtests and SEE results visually

**Backend (Week 3)**:
- [ ] Create BacktestResult model (store full Python response)
- [ ] Create `/api/backtest` routes
- [ ] Implement POST /api/backtest/run (proxy to Python)
- [ ] Cache results in MongoDB
- [ ] Transform Python response for frontend consumption

**Frontend Visualization (Week 4)**:
- [ ] Frontend: BacktestRunner component (config form)
- [ ] Frontend: BacktestChart component (lightweight-charts)
  - [ ] Render candlestick chart
  - [ ] Add buy/sell markers from trades array
  - [ ] Add hover tooltips with indicator values
- [ ] Frontend: EquityCurveChart component
  - [ ] Area chart showing portfolio value over time
  - [ ] Drawdown shading
- [ ] Frontend: PerformanceMetricsCard component
  - [ ] Display win rate, profit factor, Sharpe, drawdown
  - [ ] Visual progress bars and color coding
- [ ] Frontend: TradeListTable component
  - [ ] Sortable, filterable table of all trades
  - [ ] Click row to highlight on chart
- [ ] Test: Run backtest, see visual results

**Deliverable**: Full backtesting with rich visualization (NOT just JSON!)

---

### **Phase 5: Signal Generation (Week 5)**

**Goal**: Automated signal generation with chart visualization

- [ ] Create TradingSignal model
- [ ] Create `/api/signals` routes
- [ ] Integrate with centralizedPriceService (trigger after price update)
- [ ] Auto-generate signals during market hours
- [ ] Cache signals in MongoDB
- [ ] Broadcast via Socket.IO
- [ ] Frontend: SignalDashboard component
  - [ ] Signal list with filters
  - [ ] SignalChart component (real-time candlesticks + markers)
  - [ ] Signal details panel with indicators
- [ ] Test: Signals generated, broadcast, and displayed

**Deliverable**: Live signal generation with visualization

---

### **Phase 6: Polish & Production (Week 6)**

**Goal**: Production-ready system

- [ ] Add request caching (optional Redis)
- [ ] Implement circuit breaker for Python service
- [ ] Add comprehensive error handling (follow contract error codes)
- [ ] Performance monitoring & logging
- [ ] Admin: PythonServiceMonitor component
- [ ] Chart export functionality (download as PNG)
- [ ] Mobile-responsive charts
- [ ] Documentation for deployment
- [ ] Load testing

**Deliverable**: Production-ready integration with professional visualization

---

## 🔒 ERROR HANDLING

### **Connection Failures**

```javascript
// When Python service is down
if (!pythonService.isHealthy()) {
  // Graceful degradation:
  // 1. Return cached results if available
  // 2. Show user-friendly error message
  // 3. Log for monitoring
  // 4. Retry with exponential backoff
}
```

### **Timeout Handling**

```javascript
// Long-running backtests
if (request.timeout) {
  // 1. Save request ID
  // 2. Return "processing" status
  // 3. Poll for results later
  // 4. Notify user when complete
}
```

### **Data Validation**

```javascript
// Validate Python service responses
if (!validateBacktestResult(response)) {
  // 1. Log invalid data
  // 2. Return error to user
  // 3. Alert developers
}
```

---

## 📊 MONITORING & OBSERVABILITY

### **Key Metrics to Track**

- Python service uptime
- Request/response latency
- Success/failure rates
- Cache hit rates
- Active strategies count
- Daily signal generation count
- Backtest queue length

### **Logging Strategy**

```javascript
// Log all Python service interactions
logger.info('Python Service Request', {
  endpoint: '/api/backtest/run',
  symbol: 'OGDC',
  strategyId: '67890',
  userId: req.user._id,
  timestamp: Date.now()
});

logger.info('Python Service Response', {
  endpoint: '/api/backtest/run',
  status: 200,
  duration: 1250,
  backtestId: 'bt_abc123'
});
```

---

## 🎯 SUCCESS CRITERIA

### **Phase 1 Complete When:**
✅ Node.js can ping Python service  
✅ Health check returns service status  
✅ Error handling tested  

### **Phase 2 Complete When:**
✅ User can view available strategies  
✅ User can create/edit/delete strategies  
✅ Strategies stored in MongoDB  

### **Phase 3 Complete When:**
✅ User can run backtest from UI  
✅ Results display correctly  
✅ Metrics calculated accurately  

### **Phase 4 Complete When:**
✅ Signals auto-generate during market hours  
✅ Signals broadcast in real-time  
✅ Users receive notifications  

### **Phase 5 Complete When:**
✅ System handles 100+ symbols  
✅ Python service failure doesn't crash Node.js  
✅ Performance acceptable under load  

---

## 📊 VISUALIZATION LIBRARY: LIGHTWEIGHT-CHARTS

### **Why lightweight-charts?**

✅ **Built by TradingView** - Industry-standard charting  
✅ **Free & Open Source** - MIT license  
✅ **Perfect for Financial Data** - Native candlestick support  
✅ **React Integration** - Easy to use in React  
✅ **High Performance** - Handles 1000+ candles smoothly  
✅ **Rich Features** - Markers, overlays, custom indicators  
✅ **Mobile Friendly** - Touch gestures, responsive  
✅ **Active Development** - Well-maintained  

### **Installation**
```bash
npm install lightweight-charts
```

### **Basic Usage Example**
```javascript
import { createChart } from 'lightweight-charts';

// Create chart
const chart = createChart(containerRef.current, {
  width: 800,
  height: 500
});

// Add candlestick series
const candlestickSeries = chart.addCandlestickSeries();
candlestickSeries.setData(candles);

// Add buy/sell markers
candlestickSeries.setMarkers([
  {
    time: '2024-03-15',
    position: 'belowBar',
    color: 'green',
    shape: 'arrowUp',
    text: 'BUY @ 85.50'
  }
]);

// Add TP/SL lines
candlestickSeries.createPriceLine({
  price: 88.20,
  color: 'red',
  lineStyle: 2, // Dashed
  title: 'TP1'
});
```

### **Resources**
- **Docs**: https://tradingview.github.io/lightweight-charts/
- **React Examples**: https://codesandbox.io/s/lightweight-charts-react-example
- **Plugin Examples**: https://github.com/tradingview/lightweight-charts/tree/master/plugin-examples

---

## 📚 NEXT STEPS

1. **✅ DONE: Review INTEGRATION_CONTRACT.md**
   - APIs are defined
   - Data formats agreed
   - Error codes standardized

2. **Set up development environment**
   - Ensure Python service is running (Port 5000)
   - Configure Node.js environment variables
   - Test health check: `curl http://localhost:5000/health`
   - Install lightweight-charts: `npm install lightweight-charts`

3. **Start Phase 1 implementation**
   - Create pythonStrategyService.js (follow contract)
   - Implement all 8 endpoint methods
   - Test end-to-end connectivity

4. **Build visualization components (Phase 3-4)**
   - Study lightweight-charts documentation
   - Create BacktestChart component
   - Transform Python response to chart format
   - Test with real backtest data

5. **Iterate and refine**
   - Gather user feedback on charts
   - Optimize chart performance
   - Add advanced features (zoom, export, etc.)

---

**Document Version**: 2.0 (Synced with INTEGRATION_CONTRACT.md)  
**Last Updated**: October 30, 2025  
**Status**: ✅ Ready for Implementation  
**Contract Compliance**: 100%

