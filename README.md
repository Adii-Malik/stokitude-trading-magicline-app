# PSX SmartDesk

**Intelligent Trading Platform for Pakistan Stock Exchange (PSX)**

Real-time stock monitoring and trade management platform featuring Magic Line price alerts, comprehensive trade plan tracking, and automated price updates from PSX official website.

![PSX SmartDesk](https://img.shields.io/badge/PSX-SmartDesk-cyan)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🌟 Key Features

### 🎯 Magic Line Analysis
- **Smart Price Alerts**: Set custom price thresholds for any PSX stock
- **Real-Time Monitoring**: Automatic status updates when prices hit targets
- **Visual Indicators**: Color-coded status (Green=Met, Orange=Pending)
- **Bulk Upload**: CSV file import or manual entry
- **Live Statistics**: Track total, met, and pending magic lines

### 📊 Trade Plans & Signals
- **Multi-Level Plans**: Define multiple buy levels with quantities
- **Target Management**: Set multiple price targets
- **Stop Loss Protection**: Automatic stop loss monitoring
- **Status Tracking**: Real-time updates on met/pending levels
- **Trade Notes**: Add notes and strategies for each plan

### 💼 User Management
- **Role-Based Access**: Super Admin, Admin, and User roles
- **Approval System**: New user registrations require admin approval
- **Secure Authentication**: JWT-based authentication with bcrypt encryption
- **User Dashboard**: Complete user management interface for admins

### 📈 Centralized Price Service
- **Single Source of Truth**: All prices stored in centralized Stock model
- **Smart Polling**: Configurable intervals (default: 15 minutes)
- **Market Hours Aware**: Only fetches during PSX trading hours
- **Bulk Scraping**: Fetches all market data in one call for efficiency
- **Socket.IO Updates**: Real-time price updates to all connected clients

### 🎨 Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Mode**: Built-in dark/light theme with persistence
- **Beautiful Gradients**: Modern cyan-based color scheme
- **Smooth Animations**: Polished transitions and hover effects
- **Intuitive Navigation**: Clean header with role-based menu items

### 🔐 Security & Authentication
- **JWT Tokens**: Secure authentication with 7-day expiration
- **Protected Routes**: Frontend and backend route protection
- **Password Hashing**: Bcrypt with salt rounds
- **Role-Based Access Control**: Fine-grained permissions

---

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────┐
│          PSX Official Website               │
│         https://dps.psx.com.pk              │
└──────────────────┬──────────────────────────┘
                   │ (Web Scraping)
                   ▼
         ┌─────────────────────┐
         │  PSX Scraper        │
         │  (Bulk Fetch)       │
         └──────────┬──────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Centralized Price Service│
         │ - Market hours check     │
         │ - Smart polling (15 min) │
         │ - Bulk price updates     │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   Stock Model       │  ◄─── SINGLE SOURCE OF TRUTH
         │ (All Price Data)    │
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
┌────────────────┐    ┌────────────────┐
│ MagicLine      │    │ TradePlan      │
│ Handler        │    │ Handler        │
│ (Status Check) │    │ (Level Check)  │
└────────┬───────┘    └────────┬───────┘
         │                     │
         ▼                     ▼
┌────────────────┐    ┌────────────────┐
│ MagicLine Model│    │ TradePlan Model│
│ (Thresholds)   │    │ (Buy/Target/SL)│
└────────────────┘    └────────────────┘
         │                     │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   Socket.IO Server  │
         │ (Real-time Events)  │
         └──────────┬──────────┘
                    │
                    ▼
┌────────────────────────────────────────────┐
│        React Frontend (Vite)               │
│  ┌──────────────────────────────────────┐ │
│  │  React Router (URL-based navigation) │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  Public Routes:                            │
│  • / (Landing Page)                        │
│  • /login                                  │
│  • /signup                                 │
│                                            │
│  Protected Routes:                         │
│  • /dashboard (Overview)                   │
│  • /magic-line (Magic Line Feature)        │
│  • /trade-signals (Trade Plans)            │
│                                            │
│  Admin Only Routes:                        │
│  • /stocks (Stock Management)              │
│  • /admin (User Management)                │
│  • /settings (System Settings)             │
└────────────────────────────────────────────┘
```

### Data Flow

1. **Price Fetching**: Centralized service scrapes PSX website every 15 minutes (configurable)
2. **Data Storage**: Prices stored in Stock model (single source of truth)
3. **Event Emission**: Price updates trigger handlers
4. **Status Updates**: Handlers check MagicLine and TradePlan conditions
5. **Real-time Push**: Socket.IO broadcasts updates to all connected clients
6. **UI Refresh**: Frontend updates in real-time without page reload

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v18 or higher
- **MongoDB**: v7.0+ (local or cloud)
- **npm**: v9+ or yarn

### Installation

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd psx_terminal_app
```

#### 2. Setup Backend

```bash
cd backend
npm install
```

**Create `.env` file:**
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/psx_smartdesk

# JWT Authentication (REQUIRED - Change in production!)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Price Polling (Optional)
POLLING_INTERVAL=15  # minutes
```

**⚠️ IMPORTANT**: Change `JWT_SECRET` to a strong, random string in production!

#### 3. Create Super Admin

```bash
cd backend
npm run create-admin
```

Follow the prompts to create your first super admin account.

#### 4. Setup Frontend

```bash
cd frontend
npm install
```

**Create `.env` file (optional):**
```env
VITE_API_URL=http://localhost:5000/api
```

### Running the Application

#### Development Mode (Recommended)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend starts on `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend starts on `http://localhost:3000`

#### Production Mode

**Build frontend:**
```bash
cd frontend
npm run build
```

**Start backend (serves frontend):**
```bash
cd backend
npm start
```

Application available at `http://localhost:5000`

---

## 📱 Using the Application

### First Login

1. Open browser: `http://localhost:3000`
2. Login with super admin credentials (created earlier)
3. You'll land on the **Dashboard** (overview page)

### Dashboard (Home)

The main dashboard provides quick access to all features:
- **Magic Line Analysis** - Monitor price thresholds
- **Trade Calls & Plans** - Manage trading strategies
- **Stock Management** (Admin) - View all stocks
- **User Management** (Admin) - Manage users
- **Application Settings** (Admin) - Configure system

### Magic Line Feature

**Upload Magic Line Data (Admin only):**
1. Navigate to **Magic Line** from header
2. Click **Upload CSV**
3. Select your CSV file (format: Symbol, Magic Line)
4. Data is processed and displayed

**Monitor Status:**
- **Green cards** = Price has met or exceeded magic line
- **Orange cards** = Price is pending (below magic line)
- Real-time updates via Socket.IO

**CSV Format:**
```csv
Scrip,Magic Line
ABL,205
OGDC,140
PPL,95
```

### Trade Plans Feature

**Create a Trade Plan:**
1. Navigate to **Trade Calls** from header
2. Click **Create New Trade Plan**
3. Enter:
   - Symbol name
   - Buy levels (with quantities)
   - Target prices
   - Stop loss price
   - Notes (optional)
4. Save

**Monitor Trade Plans:**
- View all active trade plans
- Real-time price updates
- Status indicators for met/pending levels
- Edit or delete plans as needed

### User Management (Admin)

**Approve New Users:**
1. Navigate to **Users** (admin menu)
2. View pending users
3. Click **Activate** to approve
4. User can now login

**Manage Existing Users:**
- Deactivate/reactivate users
- Promote users to admin (super admin only)
- Delete users (cannot delete super admin)

### Settings (Admin)

Configure system parameters:
- **Polling Interval**: How often to fetch prices (minutes)
- **Enable/Disable Polling**: Turn automatic updates on/off
- **Market Hours**: Configure PSX trading hours
- **Market Status**: View current market status

---

## 📁 Project Structure

```
psx_terminal_app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── config.js          # Environment configuration
│   │   │   └── mongodb.js          # MongoDB connection
│   │   ├── db/
│   │   │   └── database.js         # Database helper functions
│   │   ├── handlers/
│   │   │   ├── magicLineHandler.js    # Magic line status logic
│   │   │   └── tradePlanHandler.js    # Trade plan level checks
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT authentication
│   │   ├── models/
│   │   │   ├── MagicLine.js        # Magic line thresholds
│   │   │   ├── Stock.js            # Stock prices (single source)
│   │   │   ├── TradePlan.js        # Trade plans
│   │   │   ├── User.js             # User accounts
│   │   │   └── Settings.js         # System settings
│   │   ├── routes/
│   │   │   ├── admin.js            # User management
│   │   │   ├── auth.js             # Authentication
│   │   │   ├── magicLine.js        # Magic line API
│   │   │   ├── settings.js         # Settings API
│   │   │   ├── stocks.js           # Stock data API
│   │   │   ├── tradePlans.js       # Trade plans API
│   │   │   └── upload.js           # File uploads
│   │   ├── scripts/
│   │   │   └── createSuperAdmin.js # Create super admin
│   │   ├── services/
│   │   │   ├── centralizedPriceService.js  # Main price service
│   │   │   ├── csvParser.js        # CSV parsing
│   │   │   ├── marketHoursService.js       # Market hours logic
│   │   │   ├── ocrService.js       # OCR processing
│   │   │   └── psxScraper.js       # PSX web scraper
│   │   └── index.js                # Express app entry
│   ├── uploads/                    # Uploaded files
│   ├── Dockerfile                  # Docker configuration
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminDashboard.jsx     # User management UI
│   │   │   ├── Dashboard.jsx          # Main overview page
│   │   │   ├── Header.jsx             # Navigation header
│   │   │   ├── Landing.jsx            # Public landing page
│   │   │   ├── Login.jsx              # Login form
│   │   │   ├── MagicLine.jsx          # Magic line feature
│   │   │   ├── Settings.jsx           # Settings UI
│   │   │   ├── Signup.jsx             # Signup form
│   │   │   ├── StockManagement.jsx    # Stock management
│   │   │   ├── TradePlans.jsx         # Trade plans UI
│   │   │   └── UploadForm.jsx         # File upload component
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx        # Auth state management
│   │   │   └── ThemeContext.jsx       # Theme (dark/light)
│   │   ├── services/
│   │   │   ├── admin.js               # Admin API calls
│   │   │   ├── api.js                 # Main API client
│   │   │   ├── auth.js                # Auth API calls
│   │   │   ├── settings.js            # Settings API
│   │   │   ├── socket.js              # Socket.IO client
│   │   │   ├── stocks.js              # Stocks API
│   │   │   └── tradePlans.js          # Trade plans API
│   │   ├── App.jsx                    # Main app with routing
│   │   ├── main.jsx                   # Entry point
│   │   └── index.css                  # Global styles
│   ├── dist/                          # Build output
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── postcss.config.js
├── BACKEND.md                     # Backend technical docs
├── FRONTEND.md                    # Frontend technical docs
├── SCHEMA.md                      # Database schema docs
├── DESIGN_SYSTEM.md               # UI/UX design guide
├── README.md                      # This file
├── fly.toml                       # Fly.io deployment config
├── sample-data-corrected.csv      # Sample data
├── stocks-template.csv            # Stock template
└── trade-plans-template.csv       # Trade plan template
```

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/signup          - Register new user
POST   /api/auth/login           - User login
POST   /api/auth/logout          - User logout
GET    /api/auth/me              - Get current user
GET    /api/auth/check           - Check auth status
```

### Magic Line
```
GET    /api/magic-line           - Get all magic lines
GET    /api/magic-line/:symbol   - Get specific symbol
POST   /api/magic-line/upload    - Upload CSV (admin)
POST   /api/magic-line/manual    - Manual entry (admin)
DELETE /api/magic-line           - Clear all (admin)
GET    /api/magic-line/stats/summary  - Get statistics
POST   /api/magic-line/fetch-prices   - Trigger price fetch
```

### Trade Plans
```
GET    /api/trade-plans          - Get all trade plans
GET    /api/trade-plans/:id      - Get specific plan
POST   /api/trade-plans          - Create trade plan
PUT    /api/trade-plans/:id      - Update trade plan
DELETE /api/trade-plans/:id      - Delete trade plan
GET    /api/trade-plans/market-status  - Market status
```

### Admin
```
GET    /api/admin/users                    - Get all users
GET    /api/admin/users/pending            - Get pending users
PUT    /api/admin/users/:id/activate       - Activate user
PUT    /api/admin/users/:id/deactivate     - Deactivate user
PUT    /api/admin/users/:id/toggle-role    - Toggle admin role
DELETE /api/admin/users/:id                - Delete user
GET    /api/admin/stats                    - Get system stats
```

### Settings
```
GET    /api/settings             - Get settings (admin)
PUT    /api/settings             - Update settings (admin)
```

### Stocks
```
GET    /api/stocks               - Get all stocks (admin)
GET    /api/stocks/:symbol       - Get specific stock (admin)
POST   /api/stocks/fetch-all     - Fetch all prices (admin)
DELETE /api/stocks               - Clear all stocks (admin)
```

---

## 📊 Database Schema

### Collections

- **users** - User accounts and roles
- **magiclines** - Magic line thresholds
- **stocks** - Stock prices (centralized)
- **tradeplans** - Trade plans with levels
- **settings** - System configuration

**See [SCHEMA.md](SCHEMA.md) for detailed schema documentation.**

---

## 🎨 Design System

**Color Scheme:**
- Primary: Cyan-500 (#06B6D4)
- Success: Green-500 (#22C55E)
- Warning: Orange-500 (#F97316)
- Error: Red-500 (#EF4444)

**Dark Mode:**
- Fully supported with persistent theme storage
- Tailwind CSS class-based implementation

**See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for complete design guidelines.**

---

## 🚀 Deployment

### Fly.io Deployment

**Prerequisites:**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login
```

**Deploy:**
```bash
# Launch app (first time)
fly launch

# Set secrets
fly secrets set JWT_SECRET=your-secret-here
fly secrets set MONGODB_URI=your-mongo-connection-string

# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs
```

**Important:**
- Use MongoDB Atlas for cloud database
- Set all environment variables as Fly secrets
- Frontend is served from backend's `frontend/dist/` directory

---

## 🔧 Configuration

### Backend Environment Variables

```env
# Server
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/psx_smartdesk

# Authentication (CRITICAL - Use strong secret!)
JWT_SECRET=use-a-strong-random-string-at-least-32-chars-long
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=https://your-domain.com

# Price Polling
POLLING_INTERVAL=15  # minutes (default: 15)
```

### Market Hours Configuration

**Default PSX Hours:**
- **Monday-Thursday**: 9:15 AM - 3:30 PM PKT
- **Friday**: 
  - 9:15 AM - 12:00 PM PKT
  - 2:30 PM - 4:30 PM PKT
- **Saturday-Sunday**: Closed

Configure via Settings UI or Settings model in database.

---

## 🐛 Troubleshooting

### Backend Issues

**MongoDB Connection Failed:**
```bash
# Check MongoDB is running
mongod --version

# Verify connection string in .env
MONGODB_URI=mongodb://localhost:27017/psx_smartdesk
```

**Port Already in Use:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

**JWT Token Invalid:**
- Ensure JWT_SECRET is set in .env
- Token expires after 7 days (re-login)
- Clear browser localStorage and re-login

### Frontend Issues

**Cannot Connect to Backend:**
- Ensure backend is running on port 5000
- Check VITE_API_URL in .env
- Verify CORS settings in backend

**Dark Mode Not Persisting:**
- Check browser localStorage
- Clear cache and cookies
- Verify ThemeContext initialization

**Socket.IO Not Connecting:**
- Check backend Socket.IO server is running
- Verify WebSocket support in browser
- Check network tab for WebSocket connection

### Price Fetching Issues

**No Price Updates:**
- Check if market is open (PSX trading hours)
- Verify PSX website is accessible (https://dps.psx.com.pk)
- Check backend logs for scraping errors
- Ensure polling is enabled in Settings

**Slow Price Updates:**
- PSX website may be slow
- Increase polling interval in Settings
- Check network connection

---

## 📚 Documentation

- **[BACKEND.md](BACKEND.md)** - Backend technical documentation
- **[FRONTEND.md](FRONTEND.md)** - Frontend technical documentation
- **[SCHEMA.md](SCHEMA.md)** - Database schema and relationships
- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** - UI/UX design guidelines

---

## 🔒 Security Best Practices

1. **Change JWT_SECRET** in production (use strong random string)
2. **Use HTTPS** in production (Fly.io provides free SSL)
3. **Secure MongoDB** with authentication and network restrictions
4. **Rate Limiting** on API endpoints (TODO)
5. **Input Validation** on all user inputs
6. **XSS Protection** via React's built-in escaping
7. **CSRF Protection** via JWT tokens (no cookies)

---

## 🛣️ Roadmap

### Planned Features
- [ ] Email notifications for magic line hits
- [ ] SMS alerts for trade plan levels
- [ ] Advanced charting (TradingView integration)
- [ ] Portfolio management
- [ ] Profit/loss tracking
- [ ] Historical data analysis
- [ ] Mobile app (React Native)
- [ ] Export to PDF/Excel
- [ ] Multi-language support
- [ ] API rate limiting
- [ ] Redis caching layer
- [ ] Automated testing suite

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🙏 Credits & Acknowledgments

**Data Source:** [Pakistan Stock Exchange (PSX)](https://dps.psx.com.pk)

**Technologies:**
- [Node.js](https://nodejs.org/) - Backend runtime
- [Express.js](https://expressjs.com/) - Web framework
- [MongoDB](https://www.mongodb.com/) - Database
- [React](https://react.dev/) - Frontend library
- [Vite](https://vitejs.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [Axios](https://axios-http.com/) - HTTP client
- [Cheerio](https://cheerio.js.org/) - Web scraping
- [Lucide React](https://lucide.dev/) - Icons
- [React Router](https://reactrouter.com/) - Routing

---

## 📧 Support

For technical support:
1. Check [Troubleshooting](#-troubleshooting) section
2. Review backend logs: `cd backend && npm run dev`
3. Check browser console for frontend errors
4. Read documentation files in repository

---

## 🎉 What's New in Version 3.0

### Major Features
- ✅ **Complete Routing System** - React Router for bookmarkable URLs
- ✅ **Landing Page** - Professional public homepage
- ✅ **Dashboard Overview** - Central hub for quick feature access
- ✅ **Magic Line Refactor** - Renamed from "Symbols" for clarity
- ✅ **Centralized Architecture** - Single source of truth for prices
- ✅ **Smart Price Polling** - Market-hours-aware automatic updates
- ✅ **Bulk Scraping** - Fetch all prices in one HTTP call
- ✅ **Real-time Socket.IO** - Live updates without page refresh
- ✅ **User Approval System** - Admin approval for new signups
- ✅ **Protected Routes** - Frontend and backend route protection
- ✅ **Dark Mode** - Persistent theme with smooth transitions

### Recent Improvements
- Fixed Magic Line upload merge behavior (update existing, add new)
- Added comprehensive trading data (high, low, volume, change %)
- Removed outdated system status sections
- Improved error handling and debugging
- Enhanced UI with gradient cards and animations
- Updated documentation structure

---

**Built with ❤️ for PSX Traders**

🚀 **Start Trading Smarter Today!**
