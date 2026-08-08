# Trading Journal, Risk Calculator & Open Positions - Implementation Plan

**Created:** June 30, 2026  
**Status:** Planned — Not Yet Implemented

---

## Overview

Three interconnected features for personal trade management:

1. **Trading Journal** — Log completed trades with notes, setup analysis, and performance stats
2. **Risk Management Calculator** — Position sizing based on account capital and risk tolerance
3. **Open Positions Tracker** — Monitor active trades with live TP/SL notifications

**System boundary:** This system is frontend-focused. Heavy backend logic and DB storage lives in the other system. This system stores only what's needed for display and notification: journal entries, open position thresholds, and risk profile preferences.

---

## Architecture Overview

```
centralizedPriceService (EXISTING — no changes)
    ↓ emits 'priceUpdate' event
    ├→ magicLineHandler (existing)
    ├→ tradePlanHandler (existing)
    ├→ portfolioHandler (existing)
    └→ openPositionHandler (NEW)
            - checks live price vs. TP/SL thresholds
            - triggers notification via notificationService
            - emits 'openPositionUpdate' via Socket.IO
```

**Key Principle:** Same event-driven pattern as Magic Line and Trade Plans. No new polling. No new timers.

---

## Feature 1: Trading Journal

### What It Does

A personal trade log. Record each completed trade with context — what was the setup, how did you manage it, what went right or wrong. Over time this builds a dataset for self-improvement.

### Journal Entry Fields

| Field | Type | Notes |
|-------|------|-------|
| symbol | String | PSX stock symbol (e.g. LUCK, ENGRO) |
| direction | Enum | `long` / `short` |
| setupType | Enum | `breakout`, `reversal`, `pullback`, `trend`, `range`, `other` |
| entryDate | Date | When trade was entered |
| exitDate | Date | When trade was closed |
| entryPrice | Number | Buy price (PKR) |
| exitPrice | Number | Sell price (PKR) |
| quantity | Number | Shares traded |
| fees | Number | Brokerage + CDC fees (PKR), optional |
| notes | String | Free-text analysis (max 2000 chars) |
| emotionalState | Enum | `disciplined`, `confident`, `fearful`, `fomo`, `neutral` |
| marketCondition | Enum | `bullish`, `bearish`, `sideways`, `volatile` |
| tags | [String] | Custom labels (e.g. "earnings play", "sector rotation") |
| user | ObjectId | Ref to User |

### Computed Fields (calculated on fetch, not stored)

- `grossPnL` = (exitPrice - entryPrice) × quantity (long) or (entryPrice - exitPrice) × quantity (short)
- `netPnL` = grossPnL - fees
- `rMultiple` = netPnL / riskAmount (if risk amount provided)
- `outcome` = `win` | `loss` | `breakeven` based on netPnL

### Journal Stats (computed from all entries)

- Win rate (%)
- Average R multiple
- Profit factor (gross wins / gross losses)
- Average winner vs. average loser
- Longest win/loss streak
- Best and worst trade
- Breakdown by setup type, emotional state

### UI Components

```
frontend/src/components/Journal/
├── JournalPage.jsx          ← main page with list + stats header
├── JournalList.jsx          ← table of past trades (filterable)
├── JournalEntryModal.jsx    ← add/edit trade form (modal)
└── JournalStats.jsx         ← win rate, profit factor cards
```

### API Endpoints (Backend)

```
GET    /api/journal              → list entries (filter: symbol, outcome, setup, dateRange)
POST   /api/journal              → create entry
GET    /api/journal/:id          → get single entry
PUT    /api/journal/:id          → update entry
DELETE /api/journal/:id          → delete entry
GET    /api/journal/stats        → aggregated performance stats
```

---

## Feature 2: Risk Management Calculator

### What It Does

Given account capital and risk tolerance, calculates exactly how many shares to buy and what your capital exposure is. PSX-specific: accounts for lot sizes and brokerage.

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| accountCapital | Total trading capital (PKR) | From saved profile |
| riskPercent | Max % of capital to risk per trade | 2% |
| entryPrice | Planned buy price (PKR) | — |
| stopLossPrice | Stop loss level (PKR) | — |
| targetPrice | Take profit level (PKR, optional) | — |
| useLotSize | Round down to nearest 100 shares | true |

### Outputs

| Output | Formula |
|--------|---------|
| Risk Amount (PKR) | `accountCapital × riskPercent / 100` |
| Risk Per Share | `entryPrice - stopLossPrice` (long) |
| Position Size (shares) | `riskAmount / riskPerShare` |
| Position Size (lots) | `floor(positionSize / 100) × 100` |
| Capital Required | `positionSize × entryPrice` |
| Capital % Used | `capitalRequired / accountCapital × 100` |
| Potential Profit | `(targetPrice - entryPrice) × positionSize` |
| R:R Ratio | `potentialProfit / riskAmount` |

### Risk Presets

```
Conservative:  1% risk per trade  → small position sizes, slow drawdown
Moderate:      2% risk per trade  → standard approach
Aggressive:    3% risk per trade  → larger sizes, higher swings
```

### Saved Risk Profile (per user)

Stored in user Settings or a lightweight `RiskProfile` model:
- `accountCapital`
- `defaultRiskPercent`
- `defaultBrokerage` (% fee estimate)
- `useLotSize` toggle

### UI Component

```
frontend/src/components/RiskCalculator.jsx    ← standalone page/tab
```

**No backend needed for calculations** — all math is pure JavaScript on the frontend.  
Backend only for saving/loading the user's risk profile (optional, can use localStorage first).

---

## Feature 3: Open Positions Tracker

### What It Does

Track trades that are currently open (you own the shares). Monitor live price against your TP and SL. Get notified when either level is hit.

### Open Position Fields

| Field | Type | Notes |
|-------|------|-------|
| symbol | String | PSX stock symbol |
| entryPrice | Number | Your buy price |
| quantity | Number | Shares held |
| targetPrice | Number | Take profit level |
| stopLossPrice | Number | Stop loss level |
| entryDate | Date | When you entered |
| notes | String | Optional trade context |
| status | Enum | `open`, `tp_hit`, `sl_hit`, `closed_manual` |
| tpNotified | Boolean | Prevent duplicate notifications |
| slNotified | Boolean | Prevent duplicate notifications |
| user | ObjectId | Ref to User |

### Computed on Frontend (from live price)

- `currentPrice` — from Socket.IO price feed
- `unrealizedPnL` = (currentPrice - entryPrice) × quantity
- `unrealizedPnLPercent` = unrealizedPnL / (entryPrice × quantity) × 100
- `priceProgress` — percentage position between SL and TP (visual bar)
- `riskRewardRemaining` — remaining upside vs. downside

### Backend Handler (Event-Driven)

New handler `openPositionHandler.js` plugged into the existing price event:

```javascript
// handlers/openPositionHandler.js
centralizedPriceService.on('priceUpdate', async (prices) => {
  const openPositions = await OpenPosition.find({ status: 'open' });
  for (const pos of openPositions) {
    const currentPrice = prices[pos.symbol];
    if (!currentPrice) continue;

    if (currentPrice >= pos.targetPrice && !pos.tpNotified) {
      // send notification, update status, emit socket event
    }
    if (currentPrice <= pos.stopLossPrice && !pos.slNotified) {
      // send notification, update status, emit socket event
    }
  }
});
```

Uses **existing** `notificationService` for alerts — no new notification infrastructure needed.

### Socket.IO Event

Backend emits `openPositionUpdate` with current price data.  
Frontend subscribes in the same pattern as `magicLineUpdate`.

### API Endpoints (Backend)

```
GET    /api/open-positions           → list user's open positions
POST   /api/open-positions           → add new position
PUT    /api/open-positions/:id       → update TP/SL/notes
DELETE /api/open-positions/:id       → close/remove position
POST   /api/open-positions/:id/close → mark as manually closed
```

### UI Components

```
frontend/src/components/OpenPositions/
├── OpenPositionsPage.jsx       ← main page
├── OpenPositionsList.jsx       ← table with live price + progress bar
└── AddOpenPositionModal.jsx    ← form to add new position
```

---

## Navigation Updates

Add three new items to the existing `Header.jsx` sidebar/nav:

```
existing nav items...
+ Journal           → /journal
+ Risk Calculator   → /risk-calculator
+ Open Positions    → /open-positions
```

---

## Backend Files to Create

```
backend/src/
├── models/
│   ├── JournalEntry.js          ← new Mongoose schema
│   ├── OpenPosition.js          ← new Mongoose schema
│   └── RiskProfile.js           ← new Mongoose schema (optional)
├── routes/
│   ├── journal.js               ← CRUD + stats endpoint
│   └── openPositions.js         ← CRUD + close endpoint
└── handlers/
    └── openPositionHandler.js   ← plugs into priceUpdate event
```

Register in `backend/src/index.js`:
- Mount routes: `/api/journal`, `/api/open-positions`
- Initialize handler alongside existing handlers

---

## Frontend Files to Create

```
frontend/src/
├── components/
│   ├── Journal/
│   │   ├── JournalPage.jsx
│   │   ├── JournalList.jsx
│   │   ├── JournalEntryModal.jsx
│   │   └── JournalStats.jsx
│   ├── OpenPositions/
│   │   ├── OpenPositionsPage.jsx
│   │   ├── OpenPositionsList.jsx
│   │   └── AddOpenPositionModal.jsx
│   └── RiskCalculator.jsx
└── services/
    ├── journal.js               ← API service (matches existing pattern)
    └── openPositions.js         ← API service
```

Update:
- `App.jsx` — add three new routes
- `Header.jsx` — add nav items

---

## UI Patterns to Follow (No Deviations)

| Pattern | Source to Follow |
|---------|-----------------|
| Page layout | `Portfolio/PortfolioDetail.jsx` |
| Data table | `Portfolio/HoldingsTable.jsx` |
| Add/edit modal | `Portfolio/AddTransactionModal.jsx` |
| Status badges | `MagicLine.jsx` (green/red/gray) |
| Stats cards | `Admin/TradingBot/PerformanceMetricsCard.jsx` |
| Form inputs | `TradePlans.jsx` |
| Empty state | Any existing list component |
| Loading state | `common/LoadingSpinner.jsx` |
| Toast feedback | `react-hot-toast` (already installed) |
| Icons | `lucide-react` (already installed) |
| Colors | cyan-500 primary, green success, red danger |
| Dark mode | `dark:` Tailwind prefix throughout |

---

## Implementation Phases

### Phase 1 — Risk Calculator (Frontend Only, No Backend)
- `RiskCalculator.jsx` with full calculation logic
- Risk preset buttons (Conservative / Moderate / Aggressive)
- localStorage for saving last-used capital and risk %
- Add route `/risk-calculator` and nav item
- **No backend required** — pure client-side math

### Phase 2 — Trading Journal
- `JournalEntry.js` model + `journal.js` routes
- `journal.js` API service (frontend)
- `JournalEntryModal.jsx` — add/edit form
- `JournalList.jsx` — table with filters
- `JournalStats.jsx` — summary cards
- `JournalPage.jsx` — compose the above
- Add route `/journal` and nav item

### Phase 3 — Open Positions Tracker
- `OpenPosition.js` model + `openPositions.js` routes
- `openPositionHandler.js` — plugged into price events
- `openPositions.js` API service (frontend)
- `OpenPositionsList.jsx` with real-time price updates
- `AddOpenPositionModal.jsx`
- `OpenPositionsPage.jsx`
- Add route `/open-positions` and nav item

---

## Suggested Improvements (Within Existing Patterns)

1. **Journal ↔ Open Positions link** — When you close an Open Position, offer a one-click "Add to Journal" that pre-fills symbol, entry price, exit price, quantity. Reduces double entry.

2. **Risk Calculator → Open Positions link** — After calculating position size, a button "Track This Trade" opens `AddOpenPositionModal` with symbol and size pre-filled.

3. **Dashboard widget** — Add a small "Open Positions Summary" card to the existing `Dashboard.jsx` (count of open positions, total unrealized P/L). Same pattern as existing dashboard stats.

4. **Journal tag autocomplete** — Reuse the same tags across entries (store unique user tags, suggest them on input). Small UX lift.

5. **Journal export** — Simple CSV export button (same pattern as existing CSV functionality in the project).

---

## What Is NOT in Scope

- Charts or charting for journal (no new charting library)
- Screenshot/image attachment for journal entries (Phase 2+ if needed)
- Sharing journal entries with other users
- Importing trades from broker statements (separate feature)
- P&L tax reporting (separate feature)
- Anything that requires a new npm package

---

## Open Questions Before Implementation

1. Should Risk Profile (account capital, risk %) be saved to DB (per user) or localStorage only?
2. Should Open Positions be completely separate from Portfolio positions, or should there be an option to link them?
3. For Journal stats, should the stats page be a separate tab on the Journal page or a dedicated `/journal/stats` route?

---
