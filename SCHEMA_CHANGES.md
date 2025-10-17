# Database Schema Changes - Centralized Price Architecture

## Overview
This document outlines the database schema changes made to support the centralized price storage architecture.

**Important**: After deploying these changes, you will need to flush and re-import your data due to schema modifications.

---

## Schema Changes by Model

### 1. Symbol Model (`backend/src/models/Symbol.js`)

#### ❌ REMOVED Fields
- `currentPrice` - Now stored centrally in Stock model
- `priceData` - Now stored centrally in Stock model
- `lastUpdated` - Replaced by `updatedAt` (timestamps: true)
- `createdAt` - Replaced by `createdAt` (timestamps: true)

#### ✅ KEPT/ADDED Fields
- `symbol` - Stock symbol (unique, indexed)
- `originalSymbol` - Original symbol format
- `magicLine` - Threshold price (indexed)
- `status` - 'pending' or 'met' (indexed)
- `isActive` - Boolean for active tracking (indexed)
- `createdAt` - Auto-managed by MongoDB timestamps
- `updatedAt` - Auto-managed by MongoDB timestamps

#### Indexes
```javascript
// Inline indexes
symbol: { index: true }
magicLine: { index: true }
status: { index: true }
isActive: { index: true }

// Compound indexes
{ isActive: 1, status: 1 }
{ symbol: 1, isActive: 1 }
```

---

### 2. TradePlan Model (`backend/src/models/TradePlan.js`)

#### ❌ REMOVED Fields
- `currentPrice` - Now read from Stock model
- `entryDate` - Replaced by `createdAt` (timestamps: true)
- `closedAt` - Replaced by `exitDate`
- `performance` - Can be calculated on-demand if needed

#### ✅ KEPT Fields
- `symbol` - Stock symbol (indexed)
- `companyName` - Company name
- `tradeType` - 'buy' or 'short'
- `setupQuality` - 'excellent', 'good', 'fair', 'poor'
- `buyLevels` - Array of buy level ranges with hit tracking
- `targetPrices` - Array of target prices with hit tracking
- `shortTermTPRange` - Display range (from, to)
- `stopLoss` - Object with price and hit tracking
- `analysis` - Trade analysis text
- `status` - 'active', 'tp_hit', 'sl_hit', 'closed', 'cancelled' (indexed)
- `isActive` - Boolean (indexed)
- `createdBy` - Reference to User (indexed)
- `exitDate` - When trade was closed/completed
- `createdAt` - Auto-managed by MongoDB timestamps
- `updatedAt` - Auto-managed by MongoDB timestamps

#### Indexes
```javascript
// Inline indexes
symbol: { index: true }
status: { index: true }
isActive: { index: true }

// Compound indexes
{ symbol: 1, createdAt: -1 }
{ status: 1, isActive: 1 }
{ createdBy: 1, createdAt: -1 }
{ tradeType: 1, status: 1 }
```

---

### 3. Stock Model (`backend/src/models/Stock.js`)

#### ✅ FIELDS (No Removals - Clean Model)
- `symbol` - Stock symbol (unique, indexed)
- `companyName` - Company name (required)
- `sector` - Business sector
- `shariahCompliant` - 'Yes', 'No', or null
- **`currentPrice`** - Latest price (CENTRALIZED)
- **`previousPrice`** - Previous closing price
- **`priceChange`** - Price change amount
- **`priceChangePercent`** - Price change percentage
- **`lastUpdated`** - When price was last updated
- `createdAt` - Auto-managed by MongoDB timestamps
- `updatedAt` - Auto-managed by MongoDB timestamps

#### Indexes
```javascript
symbol: { index: true }
{ symbol: 'text', companyName: 'text' } // Text search
```

---

### 4. User Model (`backend/src/models/User.js`)

#### ❌ REMOVED Fields
- `createdAt` - Replaced by auto-managed timestamps

#### ✅ ADDED
- `timestamps: true` - Auto-manages createdAt and updatedAt

#### KEPT Fields (No Changes to Core Fields)
- `username`
- `email`
- `password`
- `role`
- `isActive`

---

## Migration Guide

### Step 1: Backup Current Data (Optional)
```bash
# Export current data (optional)
mongodump --db psx_terminal --out ./backup
```

### Step 2: Drop Collections (REQUIRED)
Since we're changing schemas significantly, you need to flush the data:

```javascript
// In MongoDB shell or script
use psx_terminal;
db.symbols.drop();
db.tradeplans.drop();
db.stocks.drop();
// Users can be kept if you want to preserve accounts
```

Or using the app's clear endpoints:
```bash
# Clear Magic Line symbols
DELETE http://localhost:5000/api/symbols

# Clear Trade Plans
DELETE http://localhost:5000/api/trade-plans/clear-all

# Clear Stocks
DELETE http://localhost:5000/api/stocks/clear-all
```

### Step 3: Re-import Data
After deploying the new code:

1. **Import Stocks** (if you have a CSV):
   ```
   POST /api/stocks/upload
   File: stocks.csv with columns: Symbol, CompanyName, Sector, ShariahCompliant
   ```

2. **Import Magic Line Symbols**:
   ```
   POST /api/upload
   File: symbols.csv with columns: Symbol, MagicLine
   ```

3. **Import Trade Plans** (if you have a CSV):
   ```
   POST /api/trade-plans/upload/csv
   File: trade-plans.csv with appropriate columns
   ```

---

## API Changes

### Removed Endpoints
- `POST /api/trade-plans/check-prices` - Replaced by automatic centralized service

### Modified Endpoints

#### `PUT /api/trade-plans/:id`
- ❌ Removed: `currentPrice` field in request body
- Note: Prices are now read from Stock model

#### `PUT /api/trade-plans/:id/status`
- ❌ Removed: `currentPrice` field in request body
- ❌ Removed: `closedAt` field (uses `exitDate` instead)
- ✅ Changed: Uses `exitDate` when closing plans

---

## Frontend Changes Needed

### TradePlans Component
If you're reading `currentPrice` from trade plans directly, you now need to:

1. **Option A**: Read from Stock model separately
   ```javascript
   // Fetch stock price for the symbol
   const stock = await fetch(`/api/stocks?symbol=${plan.symbol}`);
   const currentPrice = stock.currentPrice;
   ```

2. **Option B**: Backend can join the data
   - Modify GET `/api/trade-plans` to include currentPrice from Stock
   - This is already handled in the new architecture via Socket.IO updates

### Expected Behavior
- Prices update automatically every 15 minutes during market hours
- Real-time updates via Socket.IO
- No manual refresh needed

---

## Testing Checklist

After migration:

- [ ] Start backend server
- [ ] Verify services start without errors:
  - [ ] CentralizedPriceService
  - [ ] MagicLineStatusService
  - [ ] TradePlanStatusService
- [ ] Import stocks via CSV
- [ ] Import Magic Line symbols via CSV
- [ ] Import Trade Plans via CSV
- [ ] Wait for market hours or test manually
- [ ] Verify prices update in Stock model
- [ ] Verify Magic Line statuses update
- [ ] Verify Trade Plan hits update
- [ ] Check Socket.IO broadcasts in browser console

---

## Rollback Plan

If issues occur:

1. Stop the application
2. Restore from backup:
   ```bash
   mongorestore --db psx_terminal ./backup/psx_terminal
   ```
3. Revert to previous code version
4. Restart application

---

## Benefits of New Schema

1. **No Data Duplication**: Prices stored once in Stock model
2. **Consistency**: All features read from same source
3. **Performance**: Fewer database writes
4. **Scalability**: Easy to add new features that need prices
5. **Maintainability**: Clear separation of concerns

---

*Last Updated: October 17, 2025*
*Migration Required: YES*
*Breaking Changes: YES (Schema changes)*

