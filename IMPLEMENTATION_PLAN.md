# PSX SmartDesk - Implementation Plan

## Overview
This document outlines the implementation plan for three major features:
1. **Admin User Management System** - User approval and access control
2. **Stock Symbol Management** - Company database with symbol, name, and sector
3. **Trade Plan Management System** - Admin's trading signals tracking with manual updates

**Key Decisions:**
- ✅ Only admins can create/manage trade plans
- ✅ All registered (active) users can view trade plans
- ✅ Manual refresh approach (no auto 10-sec polling)
- ✅ Quick-add form + Bulk CSV upload for trade plans
- ✅ Separate Active Calls and Historical Calls sections
- ✅ Stock symbol database with autocomplete in trade plan forms

---

## 1. Admin User Management System

### 1.1 Problem Statement
Currently, anyone can register and immediately access all features. We need:
- Admin approval for new users before they can use the system
- Admin dashboard to manage all registered users
- Ability to activate/deactivate user accounts

### 1.2 System Architecture

#### Database Changes
**User Model Updates:**
```
User {
  username: String
  email: String
  password: String (hashed)
  role: 'admin' | 'user'
  isActive: Boolean [NEW] - default: false for new users, true for admins
  createdAt: Date
}
```

#### Backend Components

**1. Updated Auth Middleware:**
- Current: Only checks if JWT token is valid
- New: Also checks if `user.isActive === true`
- Inactive users get 403 Forbidden response

**2. Admin Routes (`/api/admin/*`):**
```
GET    /api/admin/users              - List all users (admin only)
PUT    /api/admin/users/:id/activate - Activate a user (admin only)
PUT    /api/admin/users/:id/deactivate - Deactivate a user (admin only)
PUT    /api/admin/users/:id/toggle-role - Make user admin/regular (admin only)
DELETE /api/admin/users/:id          - Delete user (admin only)
```

**3. Auth Route Updates:**
- Registration: User created with `isActive: false`
- Login: Check both credentials AND `isActive` status
- Response: Include user status in login response

#### Frontend Components

**1. Admin Dashboard Page (`/admin`):**
- Protected route (admin only)
- Table showing all users:
  ```
  | Username | Email | Role | Status | Registered | Actions |
  |----------|-------|------|--------|------------|---------|
  | john     | j@... | user | Active | 2 days ago | [Deactivate] [Delete] |
  | jane     | j@... | user | Pending| 1 hour ago | [Activate] [Delete] |
  | mentor   | m@... | admin| Active | 1 week ago | [View] |
  ```

**2. Header Updates:**
- Show "Admin Panel" link only if user.role === 'admin'

**3. Auth Context Updates:**
- Store user's role and isActive status
- Provide helper: `isAdmin()` function

### 1.3 User Flow

#### New User Registration Flow:
```
1. User fills signup form
2. Account created with isActive: false
3. User sees message: "Account created! Waiting for admin approval."
4. User cannot login yet (gets "Account not activated" message)

Admin Side:
5. Admin logs in and sees notification badge (X pending users)
6. Admin opens Admin Dashboard
7. Admin reviews new user and clicks [Activate]
8. User's isActive changed to true

9. User can now login and access features
```

#### Existing User Deactivation Flow:
```
1. Admin clicks [Deactivate] on active user
2. User's isActive changed to false
3. If user is currently logged in:
   - Next API request fails with 403
   - Frontend shows "Account deactivated" and logs out
4. User cannot login anymore
```

### 1.4 Security Considerations
- Admins cannot deactivate or delete themselves
- Admins cannot change their own role to prevent lockout
- First user created should be manually set as admin (or via seed script)
- All admin routes require authentication + admin role check

---

## 2. Stock Symbol Management System

### 2.1 Problem Statement
Currently, the Symbol model only tracks magic line data. We need:
- Company full names for display and search
- Sector information for categorization
- Easy way to add/update stock information
- Autocomplete in trade plan forms (no manual typing of company names)

### 2.2 System Architecture

#### Database Changes
**Symbol Model Updates:**
```javascript
Symbol {
  symbol: String (e.g., "JDMT") - existing, unique, uppercase
  originalSymbol: String - existing
  companyName: String [NEW] - full company name
  sector: String [NEW] - sector/industry
  magicLine: Number - existing
  currentPrice: Number - existing
  priceData: Object - existing
  lastUpdated: Date - existing
  createdAt: Date - existing
}
```

#### Backend Components

**1. Stock Symbol Routes (`/api/stocks/*`):**
```
POST   /api/stocks/bulk          - Bulk upload stocks from CSV (admin only)
GET    /api/stocks               - List all stocks (with search/filter)
GET    /api/stocks/search?q=     - Search stocks by symbol or name
GET    /api/stocks/:symbol       - Get single stock details
POST   /api/stocks               - Add single stock (admin only)
PUT    /api/stocks/:symbol       - Update stock (admin only)
DELETE /api/stocks/:symbol       - Delete stock (admin only)
GET    /api/stocks/sectors       - Get list of all sectors
```

**2. CSV Upload Format for Stocks:**
```csv
Symbol,CompanyName,Sector,MagicLine
JDMT,Janana De Malucho Textile Mills Limited,Textile,100
ASL,Aisha Steel Mills Ltd.,Steel & Engineering,12
FDPL,First Dawood Properties Limited,Real Estate,7
ANTM,AN Textile Mills Limited,Textile,25
AGIC,Askari General Insurance Co. Ltd.,Insurance,40
ENGRO,Engro Corporation Limited,Chemicals,280
```

**3. Stock CSV Parser Service:**
```javascript
// backend/src/services/stockCsvParser.js
// Parses stock CSV file
// Validates: symbol format, required fields
// Auto-uppercase symbols
// Skips duplicates or updates existing
// Returns: { success: count, errors: [] }
```

#### Frontend Components

**1. Stock Management Page (`/admin/stocks`):**

**Admin View:**
```
┌─────────────────────────────────────────────────────────────┐
│  📊 Stock Symbol Management (Admin)                         │
├─────────────────────────────────────────────────────────────┤
│  [+ Add Stock] [📤 Bulk Upload] [🔄 Refresh Prices]        │
│                                                             │
│  Search: [________] Filter Sector: [All ▼]  Total: 550     │
├─────────────────────────────────────────────────────────────┤
│  Symbol | Company Name              | Sector    | Actions  │
│  --------|---------------------------|-----------|----------│
│  JDMT   | Janana De Malucho Textile | Textile   | [Edit] [Delete] │
│  ASL    | Aisha Steel Mills Ltd.    | Steel     | [Edit] [Delete] │
│  FDPL   | First Dawood Properties   | Real Est. | [Edit] [Delete] │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

**2. Add/Edit Stock Modal:**
```
┌─────────────────────────────────────────────────┐
│  Add Stock                               [X]    │
├─────────────────────────────────────────────────┤
│  Symbol*:        [JDMT____]                    │
│  Company Name*:  [Janana De Malucho...]        │
│  Sector:         [Textile__] or [Select ▼]    │
│  Magic Line:     [100_____] (optional)         │
│                                                 │
│  [Cancel]                    [Save]            │
└─────────────────────────────────────────────────┘
```

**3. Bulk Upload Stocks Modal:**
```
┌─────────────────────────────────────────────────┐
│  📤 Bulk Upload Stocks               [X]        │
├─────────────────────────────────────────────────┤
│  Step 1: Download Template                      │
│  [📥 Download CSV Template]                     │
│                                                 │
│  Template Format:                               │
│  Symbol,CompanyName,Sector,MagicLine           │
│  JDMT,Janana De Malucho...,Textile,100         │
│                                                 │
│  Step 2: Upload Your File                      │
│  ┌─────────────────────────────────┐          │
│  │  Drag & drop CSV here           │          │
│  │  or [Browse Files]              │          │
│  └─────────────────────────────────┘          │
│                                                 │
│  ✓ stocks.csv (550 stocks)                    │
│                                                 │
│  [Cancel]              [Upload]                │
└─────────────────────────────────────────────────┘
```

### 2.3 Integration with Trade Plans

#### Autocomplete in Trade Plan Form:
```
┌─────────────────────────────────────────────────┐
│  🚀 Quick Add Trade Plan                        │
├─────────────────────────────────────────────────┤
│  Symbol*:   [JDM________________]              │
│             ┌──────────────────────────────┐   │
│             │ JDMT - Janana De Malucho... │   │
│             │ JDW - JDW Sugar Mills Ltd.  │   │
│             └──────────────────────────────┘   │
│                                                 │
│  (After selecting JDMT)                        │
│  Company:   Janana De Malucho Textile Mills    │
│             Limited (auto-filled, read-only)   │
│  Sector:    Textile (auto-filled, display)     │
│                                                 │
│  Buy Levels: ...                               │
└─────────────────────────────────────────────────┘
```

**How it works:**
1. User types "JDM" in symbol field
2. Dropdown shows matching stocks from database
3. User clicks or arrow-keys to select
4. Company name auto-fills (no manual typing)
5. Form validates that symbol exists before saving

### 2.4 User Flow

#### Initial Setup - Bulk Upload Stocks:
```
Admin receives stocks CSV file →
1. Goes to Admin Panel → Stocks
2. Clicks [Bulk Upload]
3. Downloads template (if needed)
4. Uploads CSV with 550 stocks
5. System validates and imports
6. Success: "550 stocks imported successfully"
7. Now available for trade plan autocomplete
```

#### Adding Individual Stock:
```
Admin needs to add new IPO stock →
1. Clicks [+ Add Stock]
2. Enters:
   - Symbol: ABC
   - Company: ABC Company Limited
   - Sector: Cement
   - Magic Line: 50 (optional)
3. Clicks [Save]
4. Immediately available in trade plan autocomplete
```

#### Updating Stock Info:
```
Company name spelling error →
1. Search for stock in list
2. Clicks [Edit]
3. Updates company name
4. Clicks [Save]
5. All existing trade plans still reference correct symbol
```

---

## 3. Trade Plan Management System

### 3.1 Problem Statement
Your mentor sends trading signals via messages with:
- Multiple buy levels with price ranges
- Multiple target prices (TP1, TP2, TP3)
- Stop loss levels
- Technical analysis notes

**Current Issues:**
- Hard to track which calls are active
- Manual tracking of which TPs hit
- Difficult to see overall performance
- Time-consuming to add multiple calls one by one
- No historical record of closed trades

**Solution:**
Create a user-friendly system with:
1. Quick-add form for fast single entry
2. Bulk CSV upload for adding 20+ calls at once
3. Manual refresh to check TP/SL hits (keeping system lightweight)
4. Separate views for Active and Historical calls
5. Integration with existing price scraping (on-demand refresh)

### 3.2 System Architecture

#### Database Schema

**TradePlan Model:**
```javascript
TradePlan {
  // Basic Info
  symbol: String (e.g., "JDMT")
  companyName: String (e.g., "Janana De Malucho Textile Mills Limited")
  
  // Buy Levels (Array)
  buyLevels: [
    {
      level: 1,
      priceFrom: 109.50,
      priceTo: 111.30,
      isHit: false,
      hitDate: null
    },
    {
      level: 2,
      priceFrom: 101.00,
      priceTo: 104.00,
      isHit: false,
      hitDate: null
    },
    {
      level: 3,
      priceFrom: 91.00,
      priceTo: 94.00,
      isHit: false,
      hitDate: null
    }
  ],
  
  // Target Prices (Array)
  targetPrices: [
    {
      level: 1,
      price: 120.00,
      isHit: false,
      hitDate: null
    },
    {
      level: 2,
      price: 125.00,
      isHit: false,
      hitDate: null
    },
    {
      level: 3,
      price: 128.00,
      isHit: false,
      hitDate: null
    }
  ],
  
  // Short-term TP Range
  shortTermTPRange: {
    from: 120.00,
    to: 128.00
  },
  
  // Stop Loss
  stopLoss: {
    price: 89.00,
    isHit: false,
    hitDate: null
  },
  
  // Analysis/Notes
  analysis: String (the technical analysis text)
  
  // Status Tracking
  status: 'active' | 'tp_hit' | 'sl_hit' | 'closed' | 'cancelled'
  
  // Meta
  createdBy: ObjectId (ref: User) - which admin/mentor created it
  entryDate: Date
  exitDate: Date (when closed)
  
  // Performance (optional, for later)
  performance: {
    entryPrice: Number,
    exitPrice: Number,
    profitLossPercent: Number
  }
}
```

#### Backend Components

**1. Trade Plan Routes (`/api/trade-plans/*`):**
```
POST   /api/trade-plans              - Create new trade plan (admin only)
POST   /api/trade-plans/bulk         - Bulk create from CSV (admin only)
GET    /api/trade-plans              - Get all trade plans (with filters: active/closed)
GET    /api/trade-plans/active       - Get only active trade plans (all users)
GET    /api/trade-plans/historical   - Get closed/hit trade plans (all users)
GET    /api/trade-plans/:id          - Get specific trade plan (all users)
PUT    /api/trade-plans/:id          - Update trade plan (admin only)
DELETE /api/trade-plans/:id          - Delete trade plan (admin only)

POST   /api/trade-plans/check-prices - Manually check all active plans against current prices (admin only)
POST   /api/trade-plans/:id/close    - Manually close a trade plan (admin only)
PUT    /api/trade-plans/:id/status   - Update status (admin only)
```

**2. Manual Price Check Service:**
```javascript
// Triggered by admin clicking [Check Prices] button
checkTradePlanPrices() {
  1. Fetch all active trade plans (status: 'active')
  2. Get current prices for all those symbols (using existing scraper)
  3. For each trade plan:
     - Check if current price is in any buy level range → mark isHit
     - Check if current price >= any target price → mark isHit
     - Check if current price <= stop loss → mark isHit, change status to 'sl_hit'
     - If SL hit or all TPs hit → move to historical
  4. Save updated trade plans
  5. Return summary: { checked: 10, updated: 3, slHits: 1, tpHits: 2 }
}
```

**3. Bulk CSV Upload Format:**
```csv
Symbol,CompanyName,Buy1From,Buy1To,Buy2From,Buy2To,Buy3From,Buy3To,TP1,TP2,TP3,StopLoss,Analysis
JDMT,Janana De Malucho Textile Mills Limited,109.5,111.3,101,104,91,94,120,125,128,89,"Bullish engulfing breakout..."
ASL,Aisha Steel Mills Ltd.,14.5,14.8,13.9,14.2,12.6,13,15.6,16.2,16.5,12.3,"Strong reaction candle..."
FDPL,First Dawood Properties Limited,8.4,8.6,7.8,8.1,7.2,7.5,9.5,10,10.5,6.9,"Explosive bullish candle..."
```

**Notes:**
- CSV parser validates all symbols exist in database
- Auto-fills company name if blank
- Skips invalid rows with error report
- Can upload 20-50 trade plans at once

#### Frontend Components

**1. Trade Signals Page (`/trade-signals` or `/signals`):**

**Admin View (Top Section - Admin Only):**
```
┌─────────────────────────────────────────────────────────────┐
│  🎯 Trade Signals Management (Admin Only)                   │
├─────────────────────────────────────────────────────────────┤
│  [+ Quick Add] [📤 Bulk Upload] [🔄 Check Prices]          │
└─────────────────────────────────────────────────────────────┘
```

**Quick-Add Form Modal** (Admin - Fast Entry):
```
┌─────────────────────────────────────────────────┐
│  🚀 Quick Add Trade Plan                [X]     │
├─────────────────────────────────────────────────┤
│  Symbol*:   [JDMT____] (auto-uppercase)        │
│  Company:   [Auto-filled from database]        │
│                                                 │
│  Buy Levels (Tab to next field):               │
│  1:  [109.5] - [111.3]  (Enter to confirm)    │
│  2:  [101__] - [104__]                         │
│  3:  [91___] - [94___]                         │
│                                                 │
│  Targets:   TP1:[120] TP2:[125] TP3:[128]      │
│  Stop Loss: [89___]                            │
│                                                 │
│  Analysis (optional):                          │
│  [Bullish engulfing...]                        │
│                                                 │
│  [Save & Add Another]  [Save & Close]          │
└─────────────────────────────────────────────────┘
```

**Smart Features:**
- Tab navigation between fields
- Enter key moves to next input
- Auto-uppercase symbol
- Validate symbol exists
- Auto-fill company name
- Save & Add Another → clears form, keeps modal open
- Keyboard shortcuts: Ctrl+S to save

**Bulk Upload Modal** (Admin - Mass Entry):
```
┌─────────────────────────────────────────────────┐
│  📤 Bulk Upload Trade Plans          [X]        │
├─────────────────────────────────────────────────┤
│  Step 1: Download Template                      │
│  [📥 Download CSV Template]                     │
│                                                 │
│  Template includes headers and sample row.     │
│  Edit in Excel/Google Sheets for easy entry.  │
│                                                 │
│  Step 2: Upload Your File                      │
│  ┌─────────────────────────────────┐          │
│  │  Drag & drop CSV here           │          │
│  │  or                              │          │
│  │  [Browse Files]                  │          │
│  └─────────────────────────────────┘          │
│                                                 │
│  ✓ trades.csv (20 trade plans)                │
│                                                 │
│  [Cancel]              [Upload]                │
└─────────────────────────────────────────────────┘
```

**CSV Template (Easy to Fill):**
```csv
Symbol,CompanyName,Buy1_From,Buy1_To,Buy2_From,Buy2_To,Buy3_From,Buy3_To,TP1,TP2,TP3,StopLoss,Analysis
JDMT,Janana De Malucho,109.5,111.3,101,104,91,94,120,125,128,89,Bullish breakout
ASL,Aisha Steel Mills,14.5,14.8,13.9,14.2,12.6,13,15.6,16.2,16.5,12.3,Strong reversal
```

**2. Active Trade Plans View (All Users):**
```
┌──────────────────────────────────────────────────────────────┐
│  🟢 Active Trade Signals (5)          Last Updated: 2m ago   │
│  [🔄 Refresh Prices]                                         │
├──────────────────────────────────────────────────────────────┤
│  JDMT - Janana De Malucho Textile Mills    Current: 112.50  │
│  Entry: 2 days ago | Status: 🟢 Active                      │
│                                                              │
│  Buy Levels:    ✓ 109.50-111.30  ⚪ 101-104  ⚪ 91-94      │
│  Targets:       ⚪ 120.00  ⚪ 125.00  ⚪ 128.00             │
│  Stop Loss:     89.00 (20.9% away)                          │
│                                                              │
│  📝 Bullish engulfing breakout after demand zone retest...  │
│                                                              │
│  [View Details]  [Add to Watchlist]  <Admin: [Edit] [Close]>│
├──────────────────────────────────────────────────────────────┤
│  ASL - Aisha Steel Mills Ltd.              Current: 15.60   │
│  Entry: 1 day ago | Status: 🎯 TP1 Hit!                     │
│  ... similar layout ...                                      │
└──────────────────────────────────────────────────────────────┘
```

**3. Historical Trade Plans View (All Users):**
```
┌──────────────────────────────────────────────────────────────┐
│  📚 Historical Trade Signals (23)                            │
│  Filter: [All] [TP Hit] [SL Hit] [Closed]  Sort: [Recent▼]  │
├──────────────────────────────────────────────────────────────┤
│  FDPL - First Dawood Properties     Closed: 3 days ago      │
│  Status: 🎯 All TPs Hit | Entry: 112.50 → Exit: 128.00     │
│  Performance: +13.8% ✅                                      │
│                                                              │
│  Buy Hit: ✓ Level 1                                         │
│  Targets: ✓ TP1: 120  ✓ TP2: 125  ✓ TP3: 128              │
│  Stop Loss: Not hit                                          │
│                                                              │
│  [View Details]                                              │
├──────────────────────────────────────────────────────────────┤
│  ANTM - AN Textile Mills            Closed: 1 week ago      │
│  Status: 🔴 Stop Loss Hit | Entry: 30.50 → Exit: 24.90     │
│  Performance: -18.4% ❌                                      │
│  ... similar layout ...                                      │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Users: View-only access to all trade signals
- Admin: Full CRUD + price checking
- Manual refresh button (no auto-polling)
- Separate tabs: Active (5) | Historical (23)
- Color coding: 🟢 Active, 🎯 TP Hit, 🔴 SL Hit
- Performance tracking in historical view

**3. Trade Plan Detail View (Modal/Page):**
```
┌──────────────────────────────────────────────────────────────┐
│  JDMT - Janana De Malucho Textile Mills Limited              │
│  Current Price: 112.50 (+2.5%)                      [Close]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 Price Chart (mini chart showing entry, TPs, SL)         │
│                                                              │
│  Entry Points:                                               │
│  ✓ Buy 1: Rs. 109.50 - 111.30  Hit on: Oct 15, 2025        │
│  ⚪ Buy 2: Rs. 101.00 - 104.00                              │
│  ⚪ Buy 3: Rs. 91.00 - 94.00                                │
│                                                              │
│  Target Prices:                                              │
│  ⚪ TP1: Rs. 120.00 (6.7% away)                             │
│  ⚪ TP2: Rs. 125.00 (11.1% away)                            │
│  ⚪ TP3: Rs. 128.00 (13.8% away)                            │
│                                                              │
│  Stop Loss: Rs. 89.00 (20.9% below)                         │
│                                                              │
│  📝 Analysis:                                                │
│  Bullish engulfing breakout after demand zone retest        │
│  around 90s. Strong volume surge shows fresh absorption     │
│  and reaccumulation underway. Trend likely to revisit       │
│  upper weak highs near Rs. 129.                             │
│                                                              │
│  Created by: @mentor | 2 days ago                           │
│                                                              │
│  [Edit Plan] [Close Trade] [Mark as Cancelled]              │
└──────────────────────────────────────────────────────────────┘
```

**4. Notifications System:**
```
When TP/SL hits:
- Browser notification (if enabled)
- Toast notification on screen
- Play sound alert (optional)
- Add to notification center
```

### 3.3 User Flow

#### Creating a Single Trade Plan (Quick Add):
```
Admin receives WhatsApp message from main mentor →

Option A - Quick Add (for 1-3 calls):
1. Opens Trade Signals page
2. Clicks [+ Quick Add] button
3. Modal opens with form:
   - Types "JDMT" → auto-uppercase, auto-fills company name
   - Tabs through buy levels: 109.5, 111.3, 101, 104, etc.
   - Enters TPs: 120, 125, 128
   - Enters SL: 89
   - Pastes analysis (optional)
4. Clicks [Save & Add Another] (form clears, modal stays open)
5. Adds next call (ASL, FDPL, etc.)
6. Clicks [Save & Close] after last one
7. All users immediately see new plans in Active Signals section
```

#### Bulk Adding Trade Plans (CSV Upload):
```
Admin receives 20 calls via WhatsApp →

Option B - Bulk Upload (for 10+ calls):
1. Clicks [📤 Bulk Upload] button
2. Clicks [Download Template] → gets CSV with headers
3. Opens CSV in Excel/Google Sheets
4. Copy-pastes data from WhatsApp into organized columns:
   
   Symbol | Company         | B1_From | B1_To | ... | TP1 | TP2 | TP3 | SL
   JDMT   | Janana De...    | 109.5   | 111.3 | ... | 120 | 125 | 128 | 89
   ASL    | Aisha Steel...  | 14.5    | 14.8  | ... | 15.6| 16.2| 16.5| 12.3
   ... 18 more rows ...

5. Saves CSV file
6. Drag & drops file into upload modal OR clicks [Browse]
7. System validates:
   ✓ All symbols exist in database
   ✓ All price fields are numbers
   ✓ Auto-fills missing company names
8. Shows preview: "20 trade plans ready to import"
9. Clicks [Upload]
10. Success: "20 trade plans added successfully"
11. All users see them in Active Signals

**Time Saved:**
- Manual entry: ~2 min per call × 20 = 40 minutes
- CSV upload: ~10 minutes total (including Excel entry)
```

#### Manual Price Checking & Updates:
```
Admin or any user wants to check if TPs/SLs hit:

1. Opens Active Trade Signals page
2. Clicks [🔄 Refresh Prices] button
3. System:
   - Fetches current prices for all active symbols (uses existing scraper)
   - Compares each trade plan with current price:
     
     JDMT current: 122.50
     - Buy 1 (109.50-111.30): Already hit ✓
     - TP1 (120.00): 122.50 >= 120 → Mark HIT! ✓
     - TP2 (125.00): Not yet
     - SL (89.00): Not hit
     
   - Saves updates
   - Returns summary: "Checked 5 plans, 2 targets hit!"
   
4. UI shows toast: "🎯 TP1 Hit on JDMT!"
5. JDMT card updates with ✓ on TP1
6. If all TPs hit or SL hit → automatically moves to Historical

**Note:** No automatic polling! User clicks refresh when they want to check.
This keeps the app lightweight and doesn't overload the scraper.
```

#### Viewing Trade Signals (Regular Users):
```
Regular user logs in:

1. Navigates to Trade Signals page
2. Sees two tabs:
   - Active (5 plans)
   - Historical (23 plans)
   
3. In Active tab:
   - Views all current trade calls
   - Sees which buy levels/TPs hit
   - Reads analysis
   - Can add symbol to personal watchlist
   - Clicks [Refresh Prices] to check updates
   
4. In Historical tab:
   - Reviews past calls
   - Sees performance (+13.8%, -5.2%, etc.)
   - Filters by: TP Hit, SL Hit, All
   - Learns from mentor's track record

5. No editing/deleting (view-only for regular users)
```

#### Closing a Trade Plan:
```
Manual Close (Admin only):
1. Admin clicks [Close Trade] button on a plan
2. Modal appears:
   "Why are you closing this trade?"
   ( ) All targets hit
   ( ) Stop loss hit
   ( ) Manual close (market conditions changed)
   ( ) Cancelled (invalid call)
   
   Exit Price: [128.50] (optional)
   Notes: [Closed at TP3...]
   
3. Clicks [Close]
4. Status changes to 'closed'
5. Plan immediately moves to Historical section
6. All users see the update

Automatic Move to Historical:
- When [Check Prices] is clicked:
  - If SL hits → status: 'sl_hit' → moves to Historical
  - If TP3 hits → status: 'tp_hit' → stays active (can still go higher)
  - Admin can manually close anytime
```

### 3.4 Integration with Existing Features

#### With Price Scraper (On-Demand):
```javascript
// backend/src/routes/tradePlans.js

// New endpoint: Manual price check
router.post('/check-prices', authenticateToken, async (req, res) => {
  // 1. Get all active trade plans
  const activePlans = await TradePlan.find({ status: 'active' });
  
  // 2. Get unique symbols
  const symbols = [...new Set(activePlans.map(p => p.symbol))];
  
  // 3. Use existing scraper to fetch prices
  const prices = await psxScraper.getPrices(symbols);
  
  // 4. Check each plan
  let tpHits = 0, slHits = 0, buyHits = 0;
  for (const plan of activePlans) {
    const currentPrice = prices[plan.symbol];
    const updated = plan.checkPriceTargets(currentPrice);
    if (updated) {
      await plan.save();
      // Count hits...
    }
  }
  
  // 5. Return summary
  res.json({ 
    success: true, 
    checked: activePlans.length,
    updates: { tpHits, slHits, buyHits }
  });
});
```

#### With Symbol Database:
```javascript
// When creating trade plan:
// 1. Validate that symbol exists in Symbol collection
// 2. Auto-fill company name from Symbol.companyName

// frontend/src/components/TradeSignals/QuickAddForm.jsx
const handleSymbolChange = async (symbol) => {
  const response = await api.get(`/symbols/${symbol}`);
  if (response.data) {
    setCompanyName(response.data.companyName);
  } else {
    setError('Symbol not found in database');
  }
};
```

#### With CSV Upload Feature:
```javascript
// Reuse existing CSV parser logic from symbols upload
// backend/src/services/tradePlanCsvParser.js

// Similar to csvParser.js but for trade plans
// Validates: symbols exist, prices are numbers, required fields present
```

#### Optional Future Enhancement:
```javascript
// When trade plan created for symbol X
// All users who have X in watchlist get notification
// "🎯 New trade signal available for JDMT"
```

### 3.5 Dashboard Layout Update

**New Navigation:**
```
Header:
[PSX Terminal] [Dashboard] [Trade Signals] [Watchlist] [Admin Panel*]
                              ^^^^ NEW
```

**Or as Tabs within Dashboard:**
```
Dashboard Page:
[Price Monitor] [Trade Signals] [My Portfolio*] [Alerts*]
                 ^^^^ NEW
```

---

## 3. Technical Implementation Details

### 3.1 Backend API Endpoints Summary

```
Auth & Users:
POST   /api/auth/register                    - Create account (isActive: false)
POST   /api/auth/login                       - Login (check isActive)
GET    /api/auth/me                          - Get current user info

Admin - User Management:
GET    /api/admin/users                      - List all users (admin only)
PUT    /api/admin/users/:id/activate         - Activate user (admin only)
PUT    /api/admin/users/:id/deactivate       - Deactivate user (admin only)
PUT    /api/admin/users/:id/toggle-role      - Toggle admin role (admin only)
DELETE /api/admin/users/:id                  - Delete user (admin only)

Stock Symbol Management:
POST   /api/stocks/bulk                      - Bulk upload stocks CSV (admin only)
GET    /api/stocks                           - List all stocks (with pagination)
GET    /api/stocks/search                    - Search stocks by symbol/name (all users)
GET    /api/stocks/sectors                   - Get list of sectors (all users)
GET    /api/stocks/:symbol                   - Get single stock (all users)
POST   /api/stocks                           - Add single stock (admin only)
PUT    /api/stocks/:symbol                   - Update stock (admin only)
DELETE /api/stocks/:symbol                   - Delete stock (admin only)

Trade Plans:
POST   /api/trade-plans                      - Create single plan (admin only)
POST   /api/trade-plans/bulk                 - Bulk upload from CSV (admin only)
GET    /api/trade-plans                      - List all with filters (all users)
GET    /api/trade-plans/active               - Get active plans only (all users)
GET    /api/trade-plans/historical           - Get closed plans (all users)
GET    /api/trade-plans/:id                  - Get single plan (all users)
PUT    /api/trade-plans/:id                  - Update plan (admin only)
DELETE /api/trade-plans/:id                  - Delete plan (admin only)
POST   /api/trade-plans/check-prices         - Manual price check (all users)
POST   /api/trade-plans/:id/close            - Close trade manually (admin only)

Utilities:
GET    /api/stocks/csv-template              - Download stocks CSV template (admin only)
GET    /api/trade-plans/csv-template         - Download trade plans CSV template (admin only)
```

### 3.2 WebSocket Events (Optional - Phase 2)

```
Existing:
- 'priceUpdate': { symbol, price, change, ... }

Future Enhancements:
- 'trade-plan-created': { tradePlan } - When admin adds new plan
- 'target-hit': { tradePlanId, symbol, level, type, price } - When TP/SL hits
- 'trade-plan-closed': { tradePlanId, reason } - When trade closes

Note: Phase 1 will work without WebSocket updates.
Users can refresh manually to see changes.
```

### 3.3 Database Indexes

```javascript
// User collection
User.index({ email: 1 }, { unique: true })
User.index({ isActive: 1, role: 1 })

// TradePlan collection
TradePlan.index({ symbol: 1, status: 1 })
TradePlan.index({ status: 1, entryDate: -1 })
TradePlan.index({ createdBy: 1 })
```

---

## 4. Implementation Phases

### Phase 1: User Management (3-4 hours)
1. Update User model with isActive field
2. Update auth middleware to check isActive
3. Create admin routes for user management
4. Build Admin Dashboard UI
5. Update login/signup flow
6. Test user activation flow

### Phase 2: Stock Symbol Management (3-4 hours)
1. Update Symbol model (add companyName, sector)
2. Create stock management routes
3. Create stock CSV parser service
4. Build Stock Management UI (list, add, edit, delete)
5. Build bulk upload modal
6. Test CRUD and bulk operations

### Phase 3: Trade Plan CRUD (4-5 hours)
1. Create TradePlan model
2. Create trade plan routes
3. Build Quick-Add form with stock autocomplete
4. Build Active Trade Plans view
5. Build Historical Trade Plans view
6. Test CRUD operations

### Phase 4: Bulk Upload & Price Check (3-4 hours)
1. Create trade plan CSV parser
2. Implement bulk upload route
3. Build bulk upload UI component
4. Implement manual price checking logic
5. Build refresh button and notifications
6. Test price checking with multiple plans

### Phase 5: Polish & Testing (2-3 hours)
1. Add trade plan detail view modal
2. Add filters and search functionality
3. Add performance calculations for historical
4. UI/UX improvements (loading states, error handling)
5. End-to-end testing
6. Documentation updates

---

## 5. Future Enhancements

### Short-term:
- SMS/Email notifications for TP/SL hits
- Mobile app (React Native)
- Trade plan statistics and analytics
- Export trade history to CSV

### Long-term:
- AI-powered trade plan parsing (paste message, auto-extract)
- Portfolio tracking (how much invested at each buy level)
- Risk calculator (position sizing)
- Community features (share trade plans with specific users)

---

## 6. Security & Permissions Matrix

```
Feature                        | Regular User (Active) | Admin
-------------------------------|----------------------|--------
View Trade Plans (Active)      |          ✓           |   ✓
View Trade Plans (Historical)  |          ✓           |   ✓
Create Trade Plans             |          ✗           |   ✓
Edit Trade Plans               |          ✗           |   ✓
Delete Trade Plans             |          ✗           |   ✓
Close Trade Plans              |          ✗           |   ✓
Check Prices (Refresh)         |          ✓           |   ✓
Bulk Upload CSV                |          ✗           |   ✓
View User List                 |          ✗           |   ✓
Activate/Deactivate Users      |          ✗           |   ✓
Delete Users                   |          ✗           |   ✓
Access App Features            |  Only if isActive    | Always
Add to Personal Watchlist      |          ✓           |   ✓
```

**Notes:**
- Inactive users (isActive: false) cannot login at all
- First admin account must be created manually or via seed script
- Admins cannot deactivate or delete themselves

---

## 7. Final Decisions & Design Choices

### ✅ Confirmed Decisions:

1. **Admin Setup**: 
   - First admin will be created via seed script or manual database entry
   - Only admins have role: 'admin', all others are 'user'
   - No separate "mentor" role (admins handle trade signals)

2. **Trade Plan Visibility**: 
   - ✅ All registered active users can VIEW trade plans
   - ✅ Only admins can CREATE/EDIT/DELETE trade plans
   - This allows everyone to benefit from signals while keeping control centralized

3. **Price Checking Approach**:
   - ✅ Manual refresh button (no automatic 10-second polling)
   - Keeps app lightweight and performant
   - Users click "Check Prices" when they want updates
   - Future: Will integrate with paid API for real-time data

4. **Entry Methods**:
   - ✅ Quick-add form for single/few calls (fast keyboard navigation)
   - ✅ Bulk CSV upload for 10+ calls (Excel-friendly format)
   - Goal: Add 20 calls in ~10 minutes instead of 40 minutes

5. **Historical Tracking**:
   - ✅ Separate "Active" and "Historical" views
   - Plans move to Historical when: SL hits, admin closes manually
   - Plans stay Active even if TP3 hits (can go higher)
   - Historical data kept forever for performance analysis

6. **Notifications**:
   - Phase 1: Toast notifications in-app only
   - Phase 2: Browser push notifications (future)
   - Phase 3: Email/SMS (future with paid service)

7. **Auto-close Behavior**:
   - SL hit → Auto-move to Historical (status: 'sl_hit')
   - TP hits → Stay active, admin decides when to close
   - Admin can manually close anytime with reason/notes

8. **Stock Symbol Database**:
   - Admin can upload bulk CSV with symbol, company name, sector
   - CRUD operations for individual stock management
   - Trade plan form uses autocomplete from this database
   - No manual company name typing (auto-filled from database)

---

## 8. Ready to Implement!

**Implementation Order:**
1. **Phase 1**: User Management (Admin Dashboard, user activation)
2. **Phase 2**: Stock Symbol Management (Company database, CRUD, bulk upload)
3. **Phase 3**: Trade Plan CRUD (Models, routes, UI with stock autocomplete)
4. **Phase 4**: Bulk Upload & Price Checking (Trade plans bulk, manual refresh)
5. **Phase 5**: Polish (Historical view, performance tracking, UX improvements)

**Estimated Timeline:**
- Phase 1: User Management - 3-4 hours
- Phase 2: Stock Management - 3-4 hours
- Phase 3: Trade Plan CRUD - 4-5 hours  
- Phase 4: Bulk Upload & Price Check - 3-4 hours
- Phase 5: Polish & Testing - 2-3 hours
- **Total: 15-20 hours of development**

---

## 9. CSV Template Examples

### A. Stocks Database Template

Save this as `stocks-template.csv`:

```csv
Symbol,CompanyName,Sector,MagicLine
JDMT,Janana De Malucho Textile Mills Limited,Textile,100
ASL,Aisha Steel Mills Ltd.,Steel & Engineering,12
FDPL,First Dawood Properties Limited,Real Estate,7
ANTM,AN Textile Mills Limited,Textile,25
AGIC,Askari General Insurance Co. Ltd.,Insurance,40
ENGRO,Engro Corporation Limited,Chemicals,280
LUCK,Lucky Cement Limited,Cement,650
OGDC,Oil & Gas Development Company Limited,Oil & Gas,95
PPL,Pakistan Petroleum Limited,Oil & Gas,75
PSO,Pakistan State Oil Company Limited,Oil & Gas,180
```

**Notes:**
- Symbol: Stock ticker (will be auto-uppercased)
- CompanyName: Full company name
- Sector: Industry/sector classification
- MagicLine: Optional, your target price for magic line feature

---

### B. Trade Plans Template

Save this as `trade-plans-template.csv`:

```csv
Symbol,CompanyName,Buy1_From,Buy1_To,Buy2_From,Buy2_To,Buy3_From,Buy3_To,TP1,TP2,TP3,StopLoss,Analysis
JDMT,Janana De Malucho Textile Mills Limited,109.5,111.3,101,104,91,94,120,125,128,89,"Bullish engulfing breakout after demand zone retest around 90s"
ASL,Aisha Steel Mills Ltd.,14.5,14.8,13.9,14.2,12.6,13,15.6,16.2,16.5,12.3,"Strong reaction candle with bullish reversal from prior CHoCH zone"
FDPL,First Dawood Properties Limited,8.4,8.6,7.8,8.1,7.2,7.5,9.5,10,10.5,6.9,"Explosive bullish candle with highest volume on the chart"
ANTM,AN Textile Mills Limited,30.5,31.5,28.2,29,25.8,26.5,35,37,39,24.9,"Price has reacted off demand zone and moved sharply toward resistance"
AGIC,Askari General Insurance Co. Ltd.,48.8,50,45.8,47,42,43.5,52,54,56,41,"Massive volume breakout from compression zone and prior BOS level"
```

**Pro Tip**: You can leave CompanyName blank and it will auto-fill from your stocks database!

---

**Next Step**: Get your approval on this plan, then we'll start implementing! 🚀

