# 🚀 PSX SmartDesk - Master Implementation Roadmap

**Version**: 2.0  
**Date**: October 30, 2025  
**Status**: ✅ Updated for Python Integration Architecture  

---

## 📌 EXECUTIVE SUMMARY

PSX SmartDesk is evolving into a complete trading system with **two-service architecture**:

- **Node.js Backend** (Port 3000): User management, real-time monitoring, API gateway, caching
- **Python Strategy Engine** (Port 5000): Heavy computation, backtesting, signal generation, technical analysis

**Key Decision**: Python handles ALL computation (backtesting, indicators, signals). Node.js handles orchestration, users, and visualization.

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌────────────────────────────────────────────────────────┐
│              FRONTEND (React - Port 5173)              │
│  • User Interface                                      │
│  • Chart Visualization (lightweight-charts)            │
│  • Real-time Updates (Socket.IO)                       │
└────────────────────┬───────────────────────────────────┘
                     │ REST API + WebSocket
┌────────────────────▼───────────────────────────────────┐
│          NODE.JS BACKEND (Port 3000)                   │
│  ✅ EXISTING:                                          │
│  • User authentication (JWT)                           │
│  • Stock price monitoring (centralizedPriceService)    │
│  • Magic Line & Trade Plan features                    │
│  • Real-time broadcasting (Socket.IO)                  │
│  • Historical data scraping                            │
│                                                         │
│  🆕 TO BUILD (Integration Layer):                      │
│  • pythonStrategyService.js (HTTP client)              │
│  • TradingStrategy model (user ownership)              │
│  • TradingSignal model (cache from Python)             │
│  • BacktestResult model (cache from Python)            │
│  • /api/strategies routes (CRUD + proxy)               │
│  • /api/backtest routes (trigger + fetch)              │
│  • /api/signals routes (generate + subscribe)          │
│  • Visualization components (charts, metrics)          │
└────────────────────┬───────────────────────────────────┘
                     │ HTTP REST API
┌────────────────────▼───────────────────────────────────┐
│       PYTHON STRATEGY ENGINE (Port 5000)               │
│  ⚡ EXTERNAL SERVICE (Already Built by Python Team)    │
│  • Backtesting engine                                  │
│  • Signal generation                                   │
│  • Technical indicators (TA-Lib)                       │
│  • Strategy plugins                                    │
│  • Performance metrics                                 │
└────────────────────┬───────────────────────────────────┘
                     │ MongoDB (Read OHLCV data)
┌────────────────────▼───────────────────────────────────┐
│                 MONGODB DATABASE                       │
│  ✅ EXISTING:                                          │
│  • stocks, users, magiclines, tradeplans              │
│  • psxdailies, psxweeklies, psxmonthlies (OHLCV)     │
│                                                         │
│  🆕 TO ADD:                                            │
│  • tradingstrategies (Node.js managed)                 │
│  • tradingsignals (cached from Python)                 │
│  • backtestresults (cached from Python)                │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 OUR RESPONSIBILITY (Node.js Team)

| Component | Status | Description |
|-----------|--------|-------------|
| **Integration Client** | 🆕 TO BUILD | `pythonStrategyService.js` - HTTP client to Python |
| **Models** | 🆕 TO BUILD | TradingStrategy, TradingSignal, BacktestResult |
| **API Routes** | 🆕 TO BUILD | /api/strategies, /api/backtest, /api/signals |
| **Frontend Components** | 🆕 TO BUILD | StrategyManager, BacktestRunner, SignalDashboard |
| **Visualization** | 🆕 TO BUILD | Charts using lightweight-charts library |
| **Historical Data** | ✅ DONE | PsxDaily, PsxWeekly, PsxMonthly models exist |
| **Data Scraping** | ✅ DONE | historicalDataScraper.js exists |
| **User Management** | ✅ DONE | Authentication, roles, permissions |
| **Real-time System** | ✅ DONE | Socket.IO, centralizedPriceService |

---

## 📋 IMPLEMENTATION PHASES (Node.js Team)

### **Phase 1: Python Service Integration (Week 1) - FOUNDATION**

**Goal**: Establish communication with Python service

**What We Build**:
- [ ] `pythonStrategyService.js` - HTTP client with axios
- [ ] Health check monitoring (poll every 30 sec)
- [ ] Error handling & retry logic
- [ ] Environment configuration
- [ ] Circuit breaker pattern
- [ ] Connection testing & logging

**Deliverable**: Node.js can call all Python endpoints

**Reference**: See `PYTHON_INTEGRATION_PLAN.md` - Phase 1

---

### **Phase 2: Strategy Management (Week 2)**

**Goal**: Users can create and manage trading strategies

**What We Build**:
- [ ] `TradingStrategy` model (MongoDB schema)
- [ ] `/api/strategies` routes (CRUD operations)
- [ ] Proxy to Python `GET /api/strategies` (list available)
- [ ] Strategy validation logic
- [ ] Frontend: `StrategyManager` component
  - [ ] List available Python strategies
  - [ ] Create custom strategy
  - [ ] Edit strategy parameters
  - [ ] Activate/deactivate for live trading

**Deliverable**: Full strategy management UI

**Reference**: See `PYTHON_INTEGRATION_PLAN.md` - Phase 2

---

### **Phase 3: Backtesting Backend (Week 3)**

**Goal**: Users can trigger backtests and store results

**What We Build**:
- [ ] `BacktestResult` model (MongoDB schema)
- [ ] `/api/backtest` routes
  - [ ] POST /run - Trigger backtest (proxy to Python)
  - [ ] GET /:id - Get cached results
  - [ ] GET /history - List user's backtests
- [ ] Response transformation logic
- [ ] Result caching in MongoDB
- [ ] Frontend: `BacktestRunner` component
  - [ ] Configuration form (symbol, dates, capital)
  - [ ] Start backtest button
  - [ ] Loading state

**Deliverable**: Backend for backtesting (no visualization yet)

**Reference**: See `PYTHON_INTEGRATION_PLAN.md` - Phase 3

---

### **Phase 4: Backtest Visualization (Week 4) - CHARTS!**

**Goal**: Rich visual display of backtest results (NOT just JSON!)

**Library**: `lightweight-charts` by TradingView

**What We Build**:
- [ ] Install: `npm install lightweight-charts`
- [ ] Frontend: `BacktestChart` component
  - [ ] Candlestick chart (OHLCV data)
  - [ ] Buy/Sell markers (green ▲, red ▼)
  - [ ] Hover tooltips (indicators, price, date)
  - [ ] Zoom & pan
- [ ] Frontend: `EquityCurveChart` component
  - [ ] Area chart (portfolio value over time)
  - [ ] Drawdown shading (red zones)
  - [ ] Peak markers
- [ ] Frontend: `PerformanceMetricsCard` component
  - [ ] Win rate, profit factor, Sharpe ratio
  - [ ] Visual progress bars
  - [ ] Color-coded metrics (green = good, red = bad)
- [ ] Frontend: `TradeListTable` component
  - [ ] Sortable/filterable table
  - [ ] All trades with P/L
  - [ ] Click row to highlight on chart
  - [ ] Export to CSV

**Deliverable**: Professional backtest visualization (like TradingView!)

**Reference**: See `PYTHON_INTEGRATION_PLAN.md` - Phase 4

---

### **Phase 5: Signal Generation (Week 5)**

**Goal**: Automated signal generation during market hours

**What We Build**:
- [ ] `TradingSignal` model (MongoDB schema)
- [ ] `/api/signals` routes
  - [ ] POST /generate - Trigger signal generation
  - [ ] GET / - List signals (with filters)
  - [ ] PUT /:id/execute - Mark as executed
- [ ] Integration with `centralizedPriceService`
  - [ ] Trigger signal check after price update
  - [ ] Only during market hours
- [ ] Signal caching in MongoDB
- [ ] Socket.IO broadcasting
- [ ] Frontend: `SignalDashboard` component
  - [ ] Real-time signal feed
  - [ ] Filter by symbol/strategy/date
  - [ ] Signal details panel
  - [ ] Mark as executed
- [ ] Frontend: `SignalChart` component
  - [ ] Candlestick chart (last 100 candles)
  - [ ] Signal markers
  - [ ] Indicator overlays (EMA, RSI)
  - [ ] Auto-refresh every 5 minutes

**Deliverable**: Live signal generation with visualization

**Reference**: See `PYTHON_INTEGRATION_PLAN.md` - Phase 5

---

### **Phase 6: Production Polish (Week 6)**

**Goal**: Production-ready system

**What We Build**:
- [ ] Request caching (Redis optional)
- [ ] Circuit breaker implementation
- [ ] Comprehensive error handling
- [ ] Performance monitoring & logging
- [ ] Admin: `PythonServiceMonitor` component
  - [ ] Connection status
  - [ ] Response times
  - [ ] Error logs
- [ ] Chart export (download as PNG)
- [ ] Mobile-responsive charts
- [ ] Load testing
- [ ] Documentation

**Deliverable**: Production-ready integration

**Reference**: See `PYTHON_INTEGRATION_PLAN.md` - Phase 6

---

### **Phase 7: PWA & Notifications (Week 7-8) - OPTIONAL**

**Goal**: Mobile app experience with push notifications

**What We Build**:
- [ ] Service Worker setup
- [ ] Web App Manifest
- [ ] Push notification integration
- [ ] Offline capability
- [ ] Install prompts

**Deliverable**: Installable mobile app

**Reference**: See `PWA_NOTIFICATION_PLAN.md`

---

## 📚 DOCUMENT STRUCTURE

```
PROJECT_ROOT/
├── MASTER_PLAN.md                    ← You are here (high-level roadmap)
├── INTEGRATION_CONTRACT.md           ← API contracts with Python team
├── PYTHON_INTEGRATION_PLAN.md        ← Detailed Node.js implementation
├── TRADING_BOT_COMPLETE_GUIDE.md     ← Reference only (Python details)
└── PWA_NOTIFICATION_PLAN.md          ← Phase 7 (optional)
```

### **Which Document to Use When:**

| Task | Document |
|------|----------|
| "What's the big picture?" | `MASTER_PLAN.md` (this file) |
| "What APIs does Python expose?" | `INTEGRATION_CONTRACT.md` |
| "How do I build the Node.js integration?" | `PYTHON_INTEGRATION_PLAN.md` |
| "How do backtesting algorithms work?" | ❌ Not our concern (Python team) |
| "How do I add push notifications?" | `PWA_NOTIFICATION_PLAN.md` |

---

## 🎯 WHAT WE'RE BUILDING (Summary)

### **Backend (Node.js)**
1. HTTP client to Python service (`pythonStrategyService.js`)
2. Three new models (TradingStrategy, TradingSignal, BacktestResult)
3. Three new route groups (/api/strategies, /api/backtest, /api/signals)
4. Integration with existing price monitoring system

### **Frontend (React)**
1. Strategy management UI (create, edit, list)
2. Backtest runner UI (config form + results display)
3. Visualization components (charts, metrics, tables)
4. Signal dashboard (real-time feed + chart)
5. Admin monitoring panel (Python service health)

### **Visualization (lightweight-charts)**
1. Candlestick charts with buy/sell markers
2. Equity curve charts
3. Performance metrics display
4. Trade tables
5. Signal overlays

---

## 📊 TIMELINE ESTIMATE

| Phase | Duration | Complexity |
|-------|----------|------------|
| Phase 1: Integration Foundation | 1 week | Medium |
| Phase 2: Strategy Management | 1 week | Easy |
| Phase 3: Backtesting Backend | 1 week | Medium |
| Phase 4: Visualization | 1 week | Medium-Hard |
| Phase 5: Signal Generation | 1 week | Medium |
| Phase 6: Production Polish | 1 week | Medium |
| Phase 7: PWA (Optional) | 2 weeks | Hard |
| **TOTAL** | **6-8 weeks** | |

---

## ✅ SUCCESS CRITERIA

### **Phase 1-2 Complete:**
✅ Node.js can communicate with Python service  
✅ Users can create and manage strategies  

### **Phase 3-4 Complete:**
✅ Users can run backtests from UI  
✅ Beautiful charts display results (NOT just JSON!)  
✅ Metrics visualized with colors and progress bars  

### **Phase 5 Complete:**
✅ Signals auto-generate during market hours  
✅ Signals broadcast in real-time  
✅ Users see signals on chart with indicators  

### **Phase 6 Complete:**
✅ System handles 100+ symbols smoothly  
✅ Python service failure doesn't crash Node.js  
✅ Performance acceptable under load  
✅ Charts exportable as PNG  

---

## 🚀 NEXT STEPS

1. **✅ DONE**: Review `INTEGRATION_CONTRACT.md`
2. **NOW**: Set up Python service locally (Port 5000)
3. **THEN**: Start Phase 1 (build `pythonStrategyService.js`)
4. **NEXT**: Build visualization components (Phase 4)

---

**Version**: 2.0 (Updated for Python Integration)  
**Last Updated**: October 30, 2025  
**Status**: ✅ Ready for Implementation
