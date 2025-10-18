# PSX SmartDesk - Database Schema

## Overview
PSX SmartDesk uses MongoDB as the database with Mongoose ODM for data modeling.

---

## Database Models

### 1. User Model (`backend/src/models/User.js`)

**Purpose:** User authentication and authorization

**Schema:**
```javascript
{
  username: String (required, unique),
  email: String (required, unique),
  password: String (required, hashed with bcrypt),
  role: String (enum: ['user', 'admin', 'super_admin'], default: 'user'),
  isActive: Boolean (default: false, requires admin approval),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Key Features:**
- Password hashing before save
- Email/username case-insensitive uniqueness
- Role-based access control (RBAC)
- New users require admin approval (isActive: false)

---

### 2. MagicLine Model (`backend/src/models/MagicLine.js`)

**Purpose:** Store magic line thresholds for stock symbols

**Schema:**
```javascript
{
  symbol: String (required, unique, uppercase, indexed),
  originalSymbol: String (required),
  magicLine: Number (required, indexed),
  status: String (enum: ['pending', 'met'], default: 'pending', indexed),
  isActive: Boolean (default: true, indexed),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Indexes:**
- Compound: { isActive: 1, status: 1 }
- Compound: { symbol: 1, isActive: 1 }

**Notes:**
- Prices are NOT stored here (see Stock model)
- Status updated by magicLineHandler when price meets threshold

---

### 3. Stock Model (`backend/src/models/Stock.js`)

**Purpose:** Centralized storage for all stock price data (Single Source of Truth)

**Schema:**
```javascript
{
  symbol: String (required, unique, uppercase, indexed),
  currentPrice: Number,
  previousPrice: Number,
  priceChange: Number,
  priceChangePercent: Number,
  high: Number,
  low: Number,
  open: Number,
  volume: Number,
  lastUpdated: Date (indexed),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Key Features:**
- Single source of truth for ALL price data
- Updated by centralizedPriceService
- Scraped directly from PSX website
- Used by both MagicLine and TradePlan features

---

### 4. TradePlan Model (`backend/src/models/TradePlan.js`)

**Purpose:** Store trading plans with entry/exit levels

**Schema:**
```javascript
{
  symbol: String (required, indexed),
  buyLevels: [
    {
      price: Number (required),
      quantity: Number,
      isMet: Boolean (default: false),
      metAt: Date
    }
  ],
  targetPrices: [
    {
      price: Number (required),
      isMet: Boolean (default: false),
      metAt: Date
    }
  ],
  stopLoss: {
    price: Number (required),
    isMet: Boolean (default: false),
    metAt: Date
  },
  notes: String,
  isActive: Boolean (default: true, indexed),
  createdBy: ObjectId (ref: 'User'),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Indexes:**
- Compound: { symbol: 1, isActive: 1 }

**Notes:**
- Prices come from Stock model
- Status updated by tradePlanHandler

---

### 5. Settings Model (`backend/src/models/Settings.js`)

**Purpose:** Application-wide settings

**Schema:**
```javascript
{
  pricePolling: {
    enabled: Boolean (default: true),
    intervalMinutes: Number (default: 15)
  },
  marketHours: {
    mondayToThursday: {
      start: String (default: '09:15'),
      end: String (default: '15:30')
    },
    friday: [
      { start: '09:15', end: '12:00' },
      { start: '14:30', end: '16:30' }
    ]
  },
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Notes:**
- Singleton pattern (only one settings document)
- Loaded on server startup

---

## Data Flow Architecture

### Price Update Flow:
```
PSX Website (Scraper)
    ↓
centralizedPriceService
    ↓
Stock Model (Update prices)
    ↓
Event Emitted
    ↓
├─→ magicLineHandler (reads MagicLine + Stock)
└─→ tradePlanHandler (reads TradePlan + Stock)
```

### Magic Line Flow:
1. Admin uploads CSV with symbols and thresholds
2. Data stored in MagicLine model
3. centralizedPriceService fetches prices from PSX
4. Prices stored in Stock model
5. magicLineHandler checks if currentPrice >= magicLine
6. Updates MagicLine.status if threshold met

### Trade Plan Flow:
1. User creates trade plan with buy/target/stop levels
2. Data stored in TradePlan model
3. centralizedPriceService fetches prices from PSX
4. Prices stored in Stock model
5. tradePlanHandler checks if levels are met
6. Updates TradePlan.buyLevels/targetPrices/stopLoss

---

## Database Relationships

```
User ─┬─→ TradePlan (createdBy)
      └─→ MagicLine (admin uploads)

Stock ←─┬─ MagicLine (price lookup)
        └─ TradePlan (price lookup)
```

**Note:** No foreign key constraints (MongoDB NoSQL approach)

---

## Collection Naming Convention

- `users` - User accounts
- `magiclines` - Magic line thresholds
- `stocks` - Stock price data (centralized)
- `tradeplans` - Trading plans
- `settings` - Application settings

---

## Best Practices

1. **Single Source of Truth:** All prices in `Stock` model
2. **Upsert Operations:** Use for bulk symbol updates (merge behavior)
3. **Indexes:** Critical for performance on symbol/status queries
4. **Timestamps:** Auto-managed by Mongoose
5. **Normalization:** Symbol names always uppercase for consistency

---

## Migration Notes

### Recent Changes (Oct 2024):
- Renamed `Symbol` model → `MagicLine` model for clarity
- Added comprehensive fields to `Stock` model (high, low, volume, etc.)
- Removed price storage from `MagicLine` (moved to `Stock`)
- Added compound indexes for performance

---

## Connection String Format

```
mongodb://[username:password@]host[:port]/database[?options]
```

**Environment Variable:** `MONGODB_URI`

---

## Backup & Restore

```bash
# Backup
mongodump --uri="mongodb://..." --out=./backup

# Restore
mongorestore --uri="mongodb://..." ./backup
```

