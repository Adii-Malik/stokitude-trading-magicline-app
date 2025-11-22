# PSX SmartDesk - System Architecture

Complete technical documentation for backend architecture and database schema.

---

## Technology Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (JSON Web Tokens) with bcrypt
- **Real-time:** Socket.IO
- **Web Scraping:** Axios + Cheerio
- **File Upload:** Multer
- **CSV Parsing:** PapaParse

---

## Core Architecture

### Centralized Event-Driven System

```
┌─────────────────────────────────┐
│ centralizedPriceService (SINGLE)│
│ - Fetches prices from PSX       │
│ - Updates Stock model            │
│ - Emits 'priceUpdate' event     │
└──────────────┬──────────────────┘
               │
               ├─→ magicLineHandler
               │   - Listens to price updates
               │   - Checks magic line thresholds
               │   - Emits 'magicLineUpdate' event
               │
               └─→ tradePlanHandler
                   - Listens to price updates
                   - Checks buy/target/stop levels
                   - Emits 'tradePlanUpdate' event
```

**Key Principle:** ONE service fetches prices, MULTIPLE handlers react to updates

---

## Database Schema

### Collections Overview
- `users` - User accounts and authentication
- `magiclines` - Magic line thresholds
- `stocks` - Stock prices (SINGLE SOURCE OF TRUTH)
- `tradeplans` - Trading plans
- `settings` - Application settings
- `psxdailies` - Historical OHLCV data (daily)
- `psxweeklies` - Historical OHLCV data (weekly)
- `psxmonthlies` - Historical OHLCV data (monthly)
- `tradingstrategies` - Trading bot strategies
- `tradingsignals` - Trading bot signals
- `jobs` - Job configurations
- `jobexecutions` - Job execution history

### User Model

```javascript
{
  username: String (required, unique),
  email: String (required, unique),
  password: String (required, hashed with bcrypt),
  role: String (enum: ['user', 'admin', 'super_admin'], default: 'user'),
  isActive: Boolean (default: false, requires admin approval),
  createdAt: Date,
  updatedAt: Date
}
```

**Features:**
- Password hashing before save
- Role-based access control (RBAC)
- New users require admin approval

### MagicLine Model

```javascript
{
  symbol: String (required, unique, uppercase, indexed),
  originalSymbol: String (required),
  magicLine: Number (required, indexed),
  status: String (enum: ['pending', 'met'], default: 'pending', indexed),
  isActive: Boolean (default: true, indexed),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- Compound: `{ isActive: 1, status: 1 }`
- Compound: `{ symbol: 1, isActive: 1 }`

### Stock Model (Single Source of Truth)

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
  scrapeStatus: String (enum: ['pending', 'in_progress', 'completed', 'failed']),
  lastScrapeDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Key Features:**
- Single source of truth for ALL price data
- Updated by centralizedPriceService
- Used by both MagicLine and TradePlan features

### TradePlan Model

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
  createdAt: Date,
  updatedAt: Date
}
```

### Settings Model

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
  createdAt: Date,
  updatedAt: Date
}
```

---

## Data Flow Architecture

### Price Update Flow

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

### Magic Line Flow
1. Admin uploads CSV with symbols and thresholds
2. Data stored in MagicLine model
3. centralizedPriceService fetches prices from PSX
4. Prices stored in Stock model
5. magicLineHandler checks if currentPrice >= magicLine
6. Updates MagicLine.status if threshold met

### Trade Plan Flow
1. User creates trade plan with buy/target/stop levels
2. Data stored in TradePlan model
3. centralizedPriceService fetches prices from PSX
4. Prices stored in Stock model
5. tradePlanHandler checks if levels are met
6. Updates TradePlan.buyLevels/targetPrices/stopLoss

---

## API Endpoints

### Authentication (`/api/auth`)
```
POST   /signup          - Register new user
POST   /login           - Login user
POST   /logout          - Logout user
GET    /me              - Get current user
GET    /check           - Check auth status
```

### Magic Line (`/api/magic-line`)
```
GET    /                - Get all magic lines
GET    /:symbol         - Get specific symbol
POST   /upload          - Upload CSV file
DELETE /                - Clear all magic lines
GET    /stats/summary   - Get statistics
POST   /fetch-prices    - Fetch prices on-demand
```

### Trade Plans (`/api/trade-plans`)
```
GET    /                - Get all trade plans
GET    /:id             - Get specific trade plan
POST   /                - Create trade plan
PUT    /:id             - Update trade plan
DELETE /:id             - Delete trade plan
GET    /market-status   - Get market status
```

### Admin (`/api/admin`)
```
GET    /users           - Get all users
GET    /users/pending   - Get pending users
PUT    /users/:id/activate    - Activate user
PUT    /users/:id/deactivate  - Deactivate user
PUT    /users/:id/toggle-role - Toggle admin role
DELETE /users/:id       - Delete user
GET    /stats           - Get admin stats
```

### Historical Data (`/api/historical`)
```
POST   /scrape          - Start scraping historical data
GET    /status          - Check scraping progress
GET    /symbols         - Get symbols to scrape
GET    /:symbol         - Get historical data for symbol
```

---

## Services

### Centralized Price Service
**File:** `centralizedPriceService.js`

**Purpose:** SINGLE service responsible for fetching and updating ALL stock prices

**Flow:**
1. Timer triggers every N minutes
2. Check if market is open (marketHoursService)
3. Get active symbols (MagicLine + TradePlan)
4. Fetch prices from PSX (psxScraper)
5. Update Stock model (upsert)
6. Emit 'priceUpdate' event
7. Handlers react to event

**Configuration:**
- Interval: From Settings model (default: 15 minutes)
- Market Hours: From Settings model

### PSX Scraper
**File:** `psxScraper.js`

**Methods:**
- `getAllStockPrices()` - Scrapes entire market-watch page
- `getStockPricesForSymbols(symbols[])` - Fetches specific symbols

**Data Source:** `https://dps.psx.com.pk/timeseries`

### Market Hours Service
**File:** `marketHoursService.js`

**Market Schedule:**
```
Monday-Thursday: 09:15 - 15:30 PKT
Friday:
  - 09:15 - 12:00 PKT
  - 14:30 - 16:30 PKT
Saturday-Sunday: Closed
```

---

## Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/psx_smartdesk

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:3000

# Historical Data Sources
PRIMARY_DATA_SOURCE=tradingview
TRADINGVIEW_ENABLED=true
TRADINGVIEW_API_URL=http://localhost:5002/api/tradingview/populate
TRADINGVIEW_TIMEOUT=300000
STOCKANALYSIS_ENABLED=true
STOCKANALYSIS_RANGE=10Y
```

---

## Security Best Practices

1. **Password Hashing:** bcrypt with salt rounds
2. **JWT Expiration:** 7 days default
3. **CORS Configuration:** Whitelist frontend URL
4. **Input Validation:** Trim, sanitize user input
5. **File Upload Limits:** 10MB max file size

---

## Performance Optimizations

1. **Bulk Operations:** Use bulkWrite() for multiple updates
2. **Indexing:** Compound indexes on frequently queried fields
3. **Smart Fetching:** Only fetch prices for active symbols
4. **Caching:** Stock model acts as cache (updated periodically)
5. **Connection Pooling:** MongoDB default connection pool

---

## Best Practices

1. **Single Source of Truth:** All prices in `Stock` model
2. **Upsert Operations:** Use for bulk symbol updates (merge behavior)
3. **Indexes:** Critical for performance on symbol/status queries
4. **Timestamps:** Auto-managed by Mongoose
5. **Normalization:** Symbol names always uppercase for consistency

