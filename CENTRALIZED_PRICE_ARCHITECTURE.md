# Centralized Price Storage Architecture

## Overview

The PSX SmartDesk application now uses a **centralized price storage** architecture to eliminate data redundancy and improve maintainability. All stock prices are stored in a single location (the `Stock` model), and all features read from this central source.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   PSX Website (Data Source)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
           ┌───────────────────────────────┐
           │  CentralizedPriceService      │
           │  (Fetches & Updates Prices)   │
           └───────────┬───────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Stock Model   │ ◄──────────────┐
              │ (Single Source │                │
              │   of Truth)    │                │
              └────────────────┘                │
                       │                        │
           ┌───────────┴───────────┐            │
           │                       │            │
           ▼                       ▼            │
┌──────────────────────┐  ┌──────────────────────┐
│ MagicLineStatus      │  │ TradePlanStatus      │
│ Service (Reader)     │  │ Service (Reader)     │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           ▼                         ▼
    ┌─────────────┐          ┌──────────────┐
    │Symbol Model │          │TradePlan Model│
    │(Status only)│          │(Status only) │
    └─────────────┘          └──────────────┘
```

---

## Key Components

### 1. Stock Model (Single Source of Truth)
**File**: `backend/src/models/Stock.js`

**Purpose**: Central repository for all stock information and prices.

**Fields**:
- `symbol`: Stock symbol (unique, uppercase)
- `companyName`: Full company name
- `sector`: Business sector
- `shariahCompliant`: Yes/No/null
- `currentPrice`: Latest price ⭐
- `previousPrice`: Previous closing price
- `priceChange`: Change in price
- `priceChangePercent`: % change
- `lastUpdated`: Timestamp of last price update

**Why Centralized?**
- ✅ Single update point - no duplicate price fetching
- ✅ Consistent data across all features
- ✅ Easier maintenance and debugging
- ✅ Reduced PSX scraping load

---

### 2. CentralizedPriceService
**File**: `backend/src/services/centralizedPriceService.js`

**Purpose**: Fetches prices from PSX and updates the Stock model.

**Key Features**:
- Runs every 15 minutes during market hours
- Fetches prices for ALL unique symbols (Magic Line + Trade Plans)
- Updates Stock model with latest prices
- Broadcasts updates via Socket.IO
- Market-hours aware (uses `marketHoursService`)

**Workflow**:
1. Check if market is open
2. Get unique symbols from Magic Line + Trade Plans
3. Fetch prices from PSX for each symbol
4. Update Stock model with new prices
5. Calculate price changes
6. Broadcast updates to connected clients

**Example Log Output**:
```
💰 [10:30:00 PKT] Fetching centralized stock prices...
   ✅ Market is OPEN - Updating price database
📊 Found 150 unique symbols to update
  ✓ OGDC: Rs. 120.50
  ✓ PPL: Rs. 95.30
  ✓ ENGRO: Rs. 280.75
✅ Centralized price update complete in 12.45s
   📊 Checked: 150 symbols
   🔄 Updated: 148 stocks
```

---

### 3. MagicLineStatusService
**File**: `backend/src/services/magicLineStatusService.js`

**Purpose**: Checks Magic Line thresholds by **reading** from Stock model.

**Key Features**:
- Runs every 15 minutes during market hours
- Reads prices from Stock model (no fetching)
- Updates Symbol model status (pending/met)
- Broadcasts status changes via Socket.IO

**Workflow**:
1. Check if market is open
2. Get all active Magic Line symbols
3. For each symbol:
   - Read currentPrice from Stock model
   - Compare with magicLine threshold
   - Update status if changed
4. Broadcast status updates

**Example Log Output**:
```
🎯 [10:30:05 PKT] Checking Magic Line statuses...
   ✅ Market is OPEN - Reading from Stock model
📊 Found 50 active Magic Line symbols
  🎯 OGDC: pending → met (Price: Rs. 120.50, Magic Line: Rs. 120.00)
✅ Magic Line status check complete in 0.85s
   📊 Checked: 50 symbols
   🔄 Status changes: 3
```

---

### 4. TradePlanStatusService
**File**: `backend/src/services/tradePlanStatusService.js`

**Purpose**: Checks Trade Plan levels/targets by **reading** from Stock model.

**Key Features**:
- Runs every 15 minutes during market hours
- Reads prices from Stock model (no fetching)
- Updates TradePlan model (buy hits, TP hits, SL hits)
- Broadcasts updates via Socket.IO

**Workflow**:
1. Check if market is open
2. Get all active trade plans
3. For each plan:
   - Read currentPrice from Stock model
   - Check buy levels
   - Check target prices (only if buy hit)
   - Check stop loss
   - Move to historical if all TPs hit or SL hit
4. Broadcast updates

**Example Log Output**:
```
📈 [10:30:05 PKT] Checking Trade Plan statuses...
   ✅ Market is OPEN - Reading from Stock model
📊 Found 25 active trade plans
  💰 OGDC - Buy Level 1 HIT! (Rs. 119.00 - 121.00)
  🎯 PPL - TP1 HIT! (Rs. 95.00)
  ✅ ENGRO - ALL TARGETS ACHIEVED! Moving to Historical. Price: Rs. 282.50
✅ Trade Plan status check complete in 1.20s
   📊 Checked: 25 plans
   💰 Buy Levels Hit: 2
   🎯 Targets Hit: 5
   ⚠️ Stop Losses Hit: 0
```

---

### 5. Symbol Model (Simplified)
**File**: `backend/src/models/Symbol.js`

**Fields** (Price-related fields REMOVED):
- `symbol`: Stock symbol
- `magicLine`: Threshold price
- `status`: pending/met (updated by MagicLineStatusService)
- `isActive`: Boolean
- `lastUpdated`: Timestamp

**Note**: ❌ No more `currentPrice` or `priceData` fields!  
Prices are read from Stock model.

---

### 6. Database.js Updates
**File**: `backend/src/db/database.js`

**Changes**:
- `getFullData()`: Now reads prices from Stock model
- `getStats()`: Now reads prices from Stock model
- ❌ Removed `updatePrice()` method
- ❌ Removed `getPrice()` method
- ❌ Removed `clearPrices()` method

**Example**:
```javascript
async getFullData() {
  const symbols = await Symbol.find({}).lean();
  const stocks = await Stock.find({}).lean();
  const stockMap = {};
  stocks.forEach(stock => {
    stockMap[stock.symbol] = stock;
  });
  
  return symbols.map(symbolInfo => {
    // Read price from Stock model (centralized)
    const stock = stockMap[symbolInfo.symbol];
    const currentPrice = stock?.currentPrice || null;
    // ... rest of mapping
  });
}
```

---

## Service Startup

**File**: `backend/src/index.js`

**Startup Sequence**:
```javascript
// 1. Start Centralized Price Service (fetches from PSX)
centralizedPriceService.start(15); // 15 min interval

// 2. Start Magic Line Status Service (reads from Stock)
magicLineStatusService.start(15); // 15 min interval

// 3. Start Trade Plan Status Service (reads from Stock)
tradePlanStatusService.start(15); // 15 min interval

// 4. Trigger initial fetch if market is open
setTimeout(async () => {
  if (marketHoursService.isMarketOpen().isOpen) {
    await centralizedPriceService.checkPrices();
    await magicLineStatusService.checkStatuses();
    await tradePlanStatusService.checkStatuses();
  }
}, 3000);
```

---

## Benefits of This Architecture

### 1. **Single Source of Truth**
- All prices stored in ONE place (Stock model)
- No conflicts or inconsistencies
- Easier to debug and maintain

### 2. **Reduced PSX Load**
- Fetch each symbol's price only ONCE per cycle
- Old architecture: Symbol price fetched 2x if used in Magic Line AND Trade Plan
- New architecture: Symbol price fetched 1x, shared by all features

### 3. **Better Performance**
- Fewer database writes
- Fewer API calls to PSX
- Parallel processing capabilities

### 4. **Scalability**
- Easy to add new features (just read from Stock)
- No need to modify price fetching logic
- Clean separation of concerns

### 5. **Maintainability**
- Clear responsibilities:
  - CentralizedPriceService = WRITE prices
  - MagicLineStatusService = READ prices
  - TradePlanStatusService = READ prices
- Less code duplication
- Easier to test

---

## Migration Notes

### Old Architecture (Deprecated)
- ❌ `pricePollingService.js` (deleted)
- ❌ `tradePlanPollingService.js` (deleted)
- ❌ Each service fetched its own prices
- ❌ Prices stored in multiple places

### New Architecture (Current)
- ✅ `centralizedPriceService.js` (NEW)
- ✅ `magicLineStatusService.js` (NEW)
- ✅ `tradePlanStatusService.js` (NEW)
- ✅ One service fetches, others read
- ✅ Prices stored in Stock model only

---

## Socket.IO Events

### Price Update Broadcast
```javascript
io.emit('priceUpdate', {
  checked: 150,
  updated: 148,
  timestamp: '2025-10-17T10:30:00.000Z',
  errors: []
});
```

### Magic Line Status Update
```javascript
io.emit('magicLineUpdate', {
  symbol: 'OGDC',
  status: 'met',
  currentPrice: 120.50,
  magicLine: 120.00,
  timestamp: '2025-10-17T10:30:05.000Z'
});
```

### Trade Plan Update
```javascript
io.emit('tradePlanUpdate', {
  type: 'buyLevelHit',
  data: {
    symbol: 'OGDC',
    level: 1,
    price: 120.50
  },
  timestamp: '2025-10-17T10:30:05.000Z'
});
```

---

## Testing the Architecture

### 1. Start Backend
```bash
cd backend
npm run dev
```

### 2. Check Startup Logs
Look for:
```
🚀 Starting PSX Monitor Backend...
📊 Starting Centralized Price & Status Services...
✅ Centralized Price Service started (15 min interval)
   → Updates Stock model with live prices from PSX
✅ Magic Line Status Service started (15 min interval)
   → Reads prices from Stock model (centralized)
✅ Trade Plan Status Service started (15 min interval)
   → Reads prices from Stock model (centralized)
```

### 3. Verify Database
- Check Stock collection has price data
- Check Symbol collection has status data (no prices)
- Check TradePlan collection has status data (no prices)

### 4. Monitor Logs
- Every 15 minutes (during market hours):
  - CentralizedPriceService fetches prices
  - MagicLineStatusService checks statuses
  - TradePlanStatusService checks statuses

---

## Future Enhancements

### Potential Additions
1. **Price History**: Store historical prices in Stock model
2. **Price Caching**: Redis cache for ultra-fast reads
3. **Price Alerts**: User-defined price alerts
4. **Price Charts**: Real-time charting from centralized data
5. **API Rate Limiting**: Better control of PSX scraping

### Extensibility
New features can simply:
1. Read from Stock model
2. Register with Socket.IO for updates
3. No need to fetch prices themselves

---

## Troubleshooting

### Issue: Prices not updating
**Check**:
1. Is market open? (Check marketHoursService logs)
2. Is CentralizedPriceService running?
3. Are there errors in PSX scraping?

### Issue: Status not updating
**Check**:
1. Are status services running?
2. Does Stock model have price data?
3. Are symbols properly linked between models?

### Issue: Socket.IO not working
**Check**:
1. Is client connected?
2. Are handlers registered properly?
3. Check browser console for events

---

## Summary

The centralized price architecture provides a robust, scalable, and maintainable solution for handling stock prices across all features in PSX SmartDesk. By separating price fetching (write) from price reading (read), we achieve better performance, consistency, and code quality.

**Key Principle**: 
> "Fetch Once, Use Everywhere" - One service writes, all services read.

---

*Last Updated: October 17, 2025*
*Version: 1.0.0*

