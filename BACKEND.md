# PSX SmartDesk - Backend Technical Documentation

## Technology Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (JSON Web Tokens) with bcrypt
- **Real-time:** Socket.IO
- **Web Scraping:** Axios + Cheerio
- **File Upload:** Multer
- **CSV Parsing:** PapaParse
- **Environment:** dotenv

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── config.js          # Environment configuration
│   │   └── mongodb.js          # MongoDB connection
│   ├── db/
│   │   └── database.js         # Database helper functions
│   ├── handlers/
│   │   ├── magicLineHandler.js    # Magic line logic
│   │   └── tradePlanHandler.js    # Trade plan logic
│   ├── middleware/
│   │   └── auth.js             # Authentication middleware
│   ├── models/
│   │   ├── MagicLine.js        # Magic line model
│   │   ├── Stock.js            # Stock prices model
│   │   ├── TradePlan.js        # Trade plan model
│   │   ├── User.js             # User model
│   │   └── Settings.js         # Settings model
│   ├── routes/
│   │   ├── admin.js            # Admin user management
│   │   ├── auth.js             # Authentication routes
│   │   ├── magicLine.js        # Magic line API
│   │   ├── settings.js         # Settings API
│   │   ├── stocks.js           # Stock management API
│   │   ├── tradePlans.js       # Trade plans API
│   │   └── upload.js           # File upload API
│   ├── scripts/
│   │   └── createSuperAdmin.js # Create super admin user
│   ├── services/
│   │   ├── centralizedPriceService.js  # Price fetching (SINGLE SERVICE)
│   │   ├── csvParser.js        # CSV file parsing
│   │   ├── dataAggregationService.js   # Weekly/monthly aggregation
│   │   ├── dataSourceService.js        # Unified data source router
│   │   ├── historicalDataScheduler.js  # Scheduled data fetching
│   │   ├── historicalDataScraper.js    # KSE stocks scraper
│   │   ├── marketHoursService.js       # Market hours logic
│   │   ├── ocrService.js       # Image OCR processing
│   │   ├── psxScraper.js       # PSX website scraper
│   │   ├── stockAnalysisScraper.js     # StockAnalysis.com scraper
│   │   └── tradingViewScraper.js       # TradingView API client
│   └── index.js                # Main entry point
├── uploads/                    # File uploads directory
├── package.json
└── .env

```

---

## Core Architecture

### 1. Centralized Event-Driven Architecture

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

### 2. Authentication & Authorization

**JWT-based Authentication:**
```javascript
// Login flow
1. User sends credentials → /api/auth/login
2. Backend validates → bcrypt.compare()
3. Generate JWT token → jwt.sign()
4. Return token + user data
5. Client stores token → localStorage
6. Client sends token in headers → Authorization: Bearer <token>
```

**Middleware Chain:**
```javascript
authenticate → isAdmin → adminOnly
```

**Role Hierarchy:**
- `user` - Basic access (view only)
- `admin` - Can manage data, approve users
- `super_admin` - Full system access

**New User Flow:**
- Signup → `isActive: false` (pending approval)
- Admin approves → `isActive: true`
- User can login

---

### 3. API Routes

#### Authentication Routes (`/api/auth`)
```
POST   /signup          - Register new user (public)
POST   /login           - Login user (public)
POST   /logout          - Logout user (authenticated)
GET    /me              - Get current user (authenticated)
GET    /check           - Check auth status (authenticated)
```

#### Magic Line Routes (`/api/magic-line`)
```
GET    /                - Get all magic lines (authenticated)
GET    /:symbol         - Get specific symbol (authenticated)
POST   /upload          - Upload CSV file (authenticated)
DELETE /                - Clear all magic lines (authenticated)
GET    /stats/summary   - Get statistics (authenticated)
POST   /fetch-prices    - Fetch prices on-demand (authenticated)
```

#### Trade Plans Routes (`/api/trade-plans`)
```
GET    /                - Get all trade plans (authenticated)
GET    /:id             - Get specific trade plan (authenticated)
POST   /                - Create trade plan (authenticated)
PUT    /:id             - Update trade plan (authenticated)
DELETE /:id             - Delete trade plan (authenticated)
GET    /market-status   - Get market status (public)
```

#### Admin Routes (`/api/admin`)
```
GET    /users           - Get all users (admin)
GET    /users/pending   - Get pending users (admin)
PUT    /users/:id/activate    - Activate user (admin)
PUT    /users/:id/deactivate  - Deactivate user (admin)
PUT    /users/:id/toggle-role - Toggle admin role (admin)
DELETE /users/:id       - Delete user (admin)
GET    /stats           - Get admin stats (admin)
```

#### Upload Routes (`/api/upload`)
```
POST   /                - Upload CSV/Image file (admin)
POST   /manual          - Manual symbol entry (admin)
```

#### Settings Routes (`/api/settings`)
```
GET    /                - Get settings (admin)
PUT    /                - Update settings (admin)
```

#### Stocks Routes (`/api/stocks`)
```
GET    /                - Get all stocks (admin)
GET    /:symbol         - Get specific stock (admin)
POST   /fetch-all       - Fetch all prices (admin)
DELETE /                - Clear all stocks (admin)
```

#### Historical Data Routes (`/api/historical`)
```
POST   /scrape          - Start scraping historical data (admin)
GET    /:symbol         - Get historical data for symbol (admin)
```

---

### 4. PSX Scraper (`psxScraper.js`)

**Purpose:** Fetch stock prices from PSX website

**Methods:**
```javascript
getAllStockPrices()
// - Scrapes entire market-watch page in ONE HTTP call
// - Returns: { symbol, price, change, changePercent, high, low, volume }
// - Fast & efficient (bulk operation)

getStockPricesForSymbols(symbols[])
// - Fetches prices for specific symbols
// - Uses getAllStockPrices() internally
// - Filters results
```

**Data Source:** `https://dps.psx.com.pk/timeseries`

**Scraping Strategy:**
- Parse HTML table structure
- Extract data from specific columns
- Handle PSX-specific formatting
- Return normalized data

---

### 5. Centralized Price Service

**File:** `centralizedPriceService.js`

**Purpose:** SINGLE service responsible for fetching and updating ALL stock prices

**Flow:**
```
1. Timer triggers every N minutes
2. Check if market is open (marketHoursService)
3. Get active symbols (MagicLine + TradePlan)
4. Fetch prices from PSX (psxScraper)
5. Update Stock model (upsert)
6. Emit 'priceUpdate' event
7. Handlers react to event
```

**Smart Strategy:**
- Only fetches prices for symbols in use
- Skips updates when market is closed
- Logs every action for debugging

**Configuration:**
- Interval: From Settings model (default: 15 minutes)
- Market Hours: From Settings model

---

### 6. Socket.IO Real-time Updates

**Events Emitted to Frontend:**
```javascript
// On connection
'initialData' → { symbols, stats, lastUpdate }

// Price updates
'priceUpdate' → { checked, updated, timestamp }

// Magic line updates
'magicLineUpdate' → { symbol, status, currentPrice, magicLine }

// Trade plan updates
'tradePlanUpdate' → { planId, symbol, currentPrice, updates }
```

**Connection Flow:**
```
Client connects → Socket.IO
    ↓
Server sends initialData
    ↓
Client subscribes to events
    ↓
Backend emits events on changes
    ↓
Client updates UI in real-time
```

---

### 7. Market Hours Service

**File:** `marketHoursService.js`

**Purpose:** Determine if PSX market is currently open

**Market Schedule:**
```
Monday-Thursday: 09:15 - 15:30 PKT
Friday:
  - 09:15 - 12:00 PKT
  - 14:30 - 16:30 PKT
Saturday-Sunday: Closed
```

**Method:**
```javascript
isMarketOpen()
// Returns: { isOpen: boolean, reason: string }
```

---

### 8. File Upload & Processing

**Supported Formats:**
- CSV files (direct parsing)
- Images (JPG, PNG, GIF) - OCR processing

**Upload Flow:**
```
1. Multer receives file → uploads/ directory
2. Check file type (extension)
3. If CSV → parseCSV()
4. If Image → processImage() with OCR
5. Extract symbols & magic lines
6. Bulk insert/update database
7. Delete uploaded file
8. Return result to client
```

**CSV Format Expected:**
```csv
Scrip,Magic Line
ABL,205
Dyno,341
LCI,336
```

---

### 9. Database Helper (`database.js`)

**Key Methods:**
```javascript
normalizeSymbol(symbol)       // Uppercase, trim, remove spaces
setSymbol(symbol, magicLine)  // Add/update single symbol
bulkSetSymbols(array)         // Bulk upsert (merge behavior)
getAllSymbols()               // Get all magic lines
getSymbol(symbol)             // Get specific symbol
getFullData()                 // Get symbols with prices (joins Stock)
clearSymbols()                // Delete all magic lines
getStats()                    // Calculate statistics
```

**Merge Behavior:**
- Existing symbols → UPDATE magic line
- New symbols → INSERT
- Symbols not in file → KEEP unchanged

---

### 10. Historical Data Sources

**Architecture:** Unified data source system with primary/fallback strategy

**Available Sources:**

1. **TradingView API (Primary - Default)**
   - **Type:** REST API to core engine
   - **Endpoint:** `http://localhost:5002/api/tradingview/populate`
   - **Features:**
     - Adjusted OHLCV data (splits & dividends)
     - All timeframes in single request
     - Fast bulk population
   - **Usage:**
     ```javascript
     POST /api/tradingview/populate
     {
       "symbols": ["OGDC", "PPL"],
       "timeframes": ["daily", "weekly", "monthly"]
     }
     ```

2. **StockAnalysis.com (Fallback)**
   - **Type:** Web scraper
   - **URL:** `https://stockanalysis.com`
   - **Features:**
     - Historical data (configurable range)
     - Adjusted prices
     - Individual timeframe requests
   - **Limitations:**
     - Rate limiting required
     - Slower than TradingView

**Data Source Service (`dataSourceService.js`):**
```javascript
// Routes requests to appropriate source
// Automatic fallback on failure
// Configurable via environment or API
```

**Configuration:**
```env
# Primary data source (tradingview or stockanalysis)
PRIMARY_DATA_SOURCE=tradingview

# TradingView API (5 minutes timeout for large datasets)
TRADINGVIEW_ENABLED=true
TRADINGVIEW_API_URL=http://localhost:5002/api/tradingview/populate
TRADINGVIEW_TIMEOUT=300000

# StockAnalysis scraper
STOCKANALYSIS_ENABLED=true
STOCKANALYSIS_RANGE=10Y
```

**Flow:**
```
1. Admin triggers scrape for symbols
2. dataSourceService checks primary source (TradingView)
3. If primary fails → fallback to secondary (StockAnalysis)
4. Transform data to unified schema
5. Bulk insert into PsxDaily/PsxWeekly/PsxMonthly
6. Update Stock model with source used
```

**Configuration Control:**
- Primary source set via environment variable (PRIMARY_DATA_SOURCE)
- Automatic fallback to secondary source on failure
- Each stock tracks which source was used (dataSource field)

---

### 11. Environment Variables

**Required:**
```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/psx_smartdesk

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d

# CORS (optional)
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

### 12. Middleware

**Authentication Middleware (`auth.js`):**
```javascript
authenticate       // Verify JWT token
isAdmin()          // Check if user is admin/super_admin
adminOnly          // Middleware for admin-only routes
```

**Usage:**
```javascript
router.get('/protected', authenticate, handler);
router.post('/admin-only', adminOnly, handler);
```

---

### 13. Error Handling

**Strategy:**
- Try-catch blocks in all async functions
- Return consistent error responses
- Log errors with context
- Clean up resources on error (files, etc.)

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed explanation"
}
```

---

### 14. Logging

**Console Logging with Emojis:**
```
🚀 - Server startup
✅ - Success
❌ - Error
⚠️ - Warning
📊 - Data operation
🔌 - Connection
👤 - User action
📄 - File operation
```

---

### 15. Deployment (Fly.io)

**Configuration:** `fly.toml`

**Environment:**
- Node.js runtime
- MongoDB Atlas (cloud database)
- Environment variables in Fly.io secrets

**Commands:**
```bash
fly deploy          # Deploy application
fly logs            # View logs
fly secrets set KEY=value  # Set environment variables
```

---

### 16. Security Best Practices

1. **Password Hashing:** bcrypt with salt rounds
2. **JWT Expiration:** 7 days default
3. **CORS Configuration:** Whitelist frontend URL
4. **Input Validation:** Trim, sanitize user input
5. **File Upload Limits:** 10MB max file size
6. **SQL Injection:** N/A (MongoDB)
7. **XSS Protection:** No HTML rendering on backend
8. **Rate Limiting:** TODO (future enhancement)

---

### 17. Performance Optimizations

1. **Bulk Operations:** Use bulkWrite() for multiple updates
2. **Indexing:** Compound indexes on frequently queried fields
3. **Smart Fetching:** Only fetch prices for active symbols
4. **Caching:** Stock model acts as cache (updated periodically)
5. **Connection Pooling:** MongoDB default connection pool

---

### 18. Testing & Development

**Development Server:**
```bash
npm run dev   # Node with --watch flag (auto-restart)
```

**Create Super Admin:**
```bash
npm run create-admin
```

**Database Seed:**
Upload CSV file via `/api/upload` endpoint

---

### 19. Common Issues & Solutions

**Issue:** Port already in use
```bash
# Find process
netstat -ano | findstr :5000
# Kill process
taskkill /PID <PID> /F
```

**Issue:** MongoDB connection failed
- Check MONGODB_URI
- Ensure MongoDB is running
- Check network access (MongoDB Atlas IP whitelist)

**Issue:** JWT token invalid
- Token expired (7 days)
- JWT_SECRET changed
- Clear localStorage and re-login

---

### 20. API Response Standards

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

### 21. Future Enhancements (TODO)

- [ ] Rate limiting for API endpoints
- [ ] Redis caching for stock prices
- [ ] WebSocket authentication
- [ ] API versioning (/api/v1/...)
- [ ] Request logging middleware
- [ ] Automated tests (Jest/Mocha)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Data backup automation
- [ ] Performance monitoring
- [ ] Email notifications for magic line hits

