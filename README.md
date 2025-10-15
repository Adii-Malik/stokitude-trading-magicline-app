# PSX Magic Line Monitor

Real-time stock price monitoring application for Pakistan Stock Exchange (PSX). Track multiple stocks and get visual alerts when prices meet or exceed your "Magic Line" thresholds.

![PSX Monitor](https://img.shields.io/badge/PSX-Monitor-blue)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green)
![React](https://img.shields.io/badge/React-18-blue)

> **🎉 NEW**: Smart on-demand price fetching with intelligent caching to prevent excessive scraping!

## 🌟 Features

- **🔐 Admin Authentication**: JWT-based auth with role-based access control (NEW!)
- **👥 User Management**: Separate admin and regular user accounts (NEW!)
- **📊 On-Demand Price Fetching**: Smart price updates from PSX Official website
- **⚡ Intelligent Caching**: 30-minute cache prevents excessive scraping and server overload
- **🔒 Concurrency Protection**: Mutex lock ensures only one fetch at a time
- **🎯 Magic Line Tracking**: Set threshold prices for each stock
- **✨ Visual Alerts**: Beautiful green highlighting and animations when thresholds are met
- **🔄 Real-time Updates**: Live dashboard updates via Socket.IO as prices are fetched
- **📤 Easy Data Upload**: Support for both CSV files and images (with OCR) - Admin only
- **📈 Comprehensive Stats**: Track highs, lows, volume, change, and more
- **🎨 Beautiful UI**: Modern, responsive design with Tailwind CSS
- **🚀 Scalable**: Handles unlimited concurrent users efficiently

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         PSX Official Website        │
│        dps.psx.com.pk               │
│   (Closing Prices - On-Demand)      │
└──────────────┬──────────────────────┘
               │
               │ Web Scraping
               │ (HTML parsing with Cheerio)
               │
┌──────────────▼──────────────────────┐
│   Backend (Node.js + Express)       │
│  ┌──────────────────────────────┐   │
│  │  PSX Scraper Service         │   │
│  │  - Fetches closing prices    │   │
│  │  - Parses HTML with Cheerio  │   │
│  │  - Extracts price, OHLC, vol │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  Smart Polling Service       │   │
│  │  - 30-min intelligent cache  │   │
│  │  - Mutex lock (no overlaps)  │   │
│  │  - Real-time broadcasting    │   │
│  │  - Batch processing (5/time) │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  MongoDB Database            │   │
│  │  - Stores symbols & prices   │   │
│  │  - Persistent magic lines    │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  Socket.IO Server            │   │
│  │  - Live price updates        │   │
│  │  - Multi-user broadcasting   │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  REST API                    │   │
│  │  - Upload CSV/Image          │   │
│  │  - Manage symbols            │   │
│  │  - Trigger price fetch       │   │
│  └──────────────────────────────┘   │
└─────────────────┬───────────────────┘
                  │
                  │ Socket.IO + REST
                  │
┌─────────────────▼───────────────────┐
│    Frontend (React + Vite)          │
│  ┌──────────────────────────────┐   │
│  │  Dashboard                   │   │
│  │  - Real-time price cards     │   │
│  │  - Green alert animations    │   │
│  │  - Cache status messages     │   │
│  │  - Smart refresh button      │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  Upload Form                 │   │
│  │  - CSV upload                │   │
│  │  - Image upload with OCR     │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js v18 or higher
- npm or yarn

### Installation

1. **Clone or navigate to the project directory**

```bash
cd psx_terminal_app
```

2. **Setup Backend**

```bash
cd backend
npm install

# Create .env file from template
# Windows PowerShell:
copy .env.example .env
# Linux/Mac:
# cp .env.example .env

# Edit .env and set your JWT_SECRET and ADMIN_SIGNUP_CODE
```

**Important**: Edit the `.env` file and change these values:
- `JWT_SECRET`: A secure random string for JWT signing
- `ADMIN_SIGNUP_CODE`: A secret code required to create admin accounts

3. **Install Frontend Dependencies**

```bash
cd ../frontend
npm install
```

### Running the Application

#### Option 1: Run Both Services Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend will start on `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend will start on `http://localhost:3000`

#### Option 2: Production Build

**Build Frontend:**
```bash
cd frontend
npm run build
```

**Serve via Backend:**
```bash
cd backend
npm start
```

### First Time Setup

1. **Open your browser** and navigate to `http://localhost:3000`

2. **Create an Admin Account** (first-time only):
   - Click "Sign up" on the login page
   - Enter your username, email, and password
   - Click "Have an admin code?" and enter the `ADMIN_SIGNUP_CODE` from your `.env` file
   - Submit to create your admin account
   
   > 💡 **Tip**: The first user should always be an admin. Regular users can be created later without the admin code.

3. **Login** with your credentials

4. **Upload your Magic Line data** (Admin only):
   - **CSV File**: Use the provided `sample-data.csv` or create your own
   - **Image**: Upload a screenshot of your stock table
   - **Manual**: Use the API to add symbols programmatically

5. **Watch the magic happen!** 🎉
   - Stocks will appear on the dashboard
   - Prices update in real-time
   - When a price meets or exceeds the Magic Line, it turns **GREEN** with animations!

### 🔐 Authentication & User Roles

**Admin Users Can:**
- ✅ Upload CSV/image files
- ✅ Delete individual symbols
- ✅ Clear all symbols
- ✅ View dashboard and refresh prices

**Regular Users Can:**
- ✅ View dashboard
- ✅ Refresh prices
- ❌ Cannot upload files
- ❌ Cannot delete symbols

**For detailed authentication setup and security information**, see [AUTH_SETUP.md](AUTH_SETUP.md)

## 📁 Project Structure

```
psx_terminal_app/
├── backend/
│   ├── src/
│   │   ├── index.js              # Main Express app
│   │   ├── config/
│   │   │   └── config.js         # Configuration
│   │   ├── db/
│   │   │   └── database.js       # In-memory database
│   │   ├── routes/
│   │   │   ├── upload.js         # Upload endpoints
│   │   │   └── symbols.js        # Symbol management
│   │   └── services/
│   │       ├── psxScraper.js        # PSX web scraper
│   │       ├── pricePollingService.js  # Smart polling + caching
│   │       ├── csvParser.js        # CSV parsing
│   │       └── ocrService.js       # Image OCR
│   ├── package.json
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx     # Main dashboard
│   │   │   ├── Header.jsx        # Header with stats
│   │   │   └── UploadForm.jsx    # File upload form
│   │   ├── services/
│   │   │   ├── api.js            # REST API client
│   │   │   └── socket.js         # Socket.IO client
│   │   ├── App.jsx               # Main app component
│   │   ├── main.jsx              # Entry point
│   │   └── index.css             # Tailwind CSS
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── sample-data.csv               # Sample Magic Line data
└── README.md
```

## 📊 CSV Format

Your CSV file should have two columns:

```csv
Scrip,Magic Lin
ABL,205
Dyno,341
LCI,336
Spwl,11
...
```

**Column Names (flexible):**
- Symbol: `Scrip`, `Symbol`, `scrip`, or `symbol`
- Magic Line: `Magic Lin`, `Magic Line`, `MagicLine`, or `Threshold`

## 🔌 API Documentation

### Backend API Endpoints

#### Health Check
```http
GET /health
```

#### Authentication Endpoints
```http
POST /api/auth/signup
Content-Type: application/json
{ "username": "...", "email": "...", "password": "...", "adminCode": "..." }

POST /api/auth/login
Content-Type: application/json
{ "email": "...", "password": "..." }

POST /api/auth/logout

GET /api/auth/me
Authorization: Bearer <token>
```

#### Upload CSV/Image (Admin Only)
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <your-file>
```

#### Upload Manual Data
```http
POST /api/upload/manual
Content-Type: application/json

{
  "symbols": [
    { "symbol": "ABL", "magicLine": 205 },
    { "symbol": "Dyno", "magicLine": 341 }
  ]
}
```

#### Get All Symbols
```http
GET /api/symbols
```

#### Get Single Symbol
```http
GET /api/symbols/:symbol
```

#### Clear All Symbols (Admin Only)
```http
DELETE /api/symbols
Authorization: Bearer <token>
```

#### Fetch Latest Prices (Smart Cache)
```http
POST /api/symbols/fetch-prices
```
Returns cached data if fetched within last 30 minutes, otherwise scrapes PSX.

Response:
```json
{
  "success": true,
  "cached": true,
  "message": "Prices were fetched 5 minutes ago. Using cached data.",
  "data": {
    "total": 152,
    "success": 150,
    "failed": 2,
    "lastFetchTime": 1697401234567,
    "nextFetchIn": 1500,
    "symbols": [...]
  }
}
```

#### Get Statistics
```http
GET /api/symbols/stats/summary
```

### Socket.IO Events

**Client receives:**
- `initialData` - Initial symbol data and stats when connecting
- `priceUpdate` - Real-time price updates for tracked symbols

## 🎨 Features in Detail

### 1. Smart Price Fetching
- **On-Demand**: Click "Refresh Prices" to fetch latest closing prices
- **30-Min Cache**: Prevents excessive scraping if data is fresh
- **Mutex Lock**: Only one user can trigger scraping at a time
- **Live Updates**: Dashboard updates in real-time as each symbol is scraped
- **Batch Processing**: Fetches 5 symbols at a time to avoid overload

### 2. Visual Magic Line Alerts
When a stock price meets or exceeds its Magic Line:
- ✅ Background turns **green gradient**
- ✅ Border highlights with green ring
- ✅ "MET!" badge appears
- ✅ Pulse and bounce animations
- ✅ Progress bar turns green

### 3. Comprehensive Stock Info
Each card shows:
- Symbol name
- Magic Line (threshold)
- Current price
- Change amount and percentage
- High/Low for the day
- Volume and trades
- Progress bar to threshold

### 4. Upload Flexibility
- **CSV Files**: Standard format
- **Images**: Automatic OCR extraction (table detection)
- **Manual API**: Programmatic symbol addition

## 🚀 Deployment to Fly.io

### Prerequisites
- Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
- Sign up: `fly auth signup`

### Deploy Backend

1. **Create Dockerfile** (backend/Dockerfile):
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["node", "src/index.js"]
```

2. **Initialize Fly app**:
```bash
cd backend
fly launch
```

3. **Deploy**:
```bash
fly deploy
```

### Deploy Frontend

1. **Build frontend**:
```bash
cd frontend
npm run build
```

2. **Update backend to serve static files** (add to backend/src/index.js):
```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
```

3. **Redeploy backend**:
```bash
cd backend
fly deploy
```

## 🔧 Configuration

### Backend (.env)
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/psx_monitor

# JWT Authentication (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
ADMIN_SIGNUP_CODE=admin123

# Smart Cache Configuration (optional)
CACHE_DURATION=1800000  # 30 minutes in milliseconds (default)
```

**⚠️ Security Warning**: Always change `JWT_SECRET` and `ADMIN_SIGNUP_CODE` in production!

**Adjusting Cache Duration:**
- 15 minutes: `CACHE_DURATION=900000`
- 30 minutes: `CACHE_DURATION=1800000` (default)
- 1 hour: `CACHE_DURATION=3600000`

### Frontend
Update `vite.config.js` for production:
```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': 'https://your-app.fly.dev'
    }
  }
})
```

## 🐛 Troubleshooting

### Backend won't start
- Check Node.js version: `node --version` (should be v18+)
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check if port 5000 is available

### Frontend won't connect
- Ensure backend is running on port 5000
- Check browser console for errors
- Verify WebSocket connection in Network tab

### No price updates
- Click "Refresh Prices" button to manually trigger fetch
- Check backend logs for scraping status
- Verify symbols are correctly loaded
- PSX market might be closed (check trading hours)
- Check if PSX website (dps.psx.com.pk) is accessible
- If using cache, wait for cache expiry or restart backend

### OCR not working
- Ensure image quality is good
- Table should be clearly visible
- Try using CSV format instead

## 📝 License

MIT License - Feel free to use for personal or commercial projects

## 🙏 Credits

- **Data Source**: PSX Official ([dps.psx.com.pk](https://dps.psx.com.pk))
- **Icons**: [Lucide React](https://lucide.dev)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Scraping**: [Axios](https://axios-http.com) + [Cheerio](https://cheerio.js.org)
- **Database**: [MongoDB](https://www.mongodb.com)

## 📧 Support

For issues or questions:
1. Check the troubleshooting section
2. Review backend logs: `cd backend && npm run dev`
3. Check browser console for frontend errors

---

## 📋 What's New in v2.1

### ✨ Major Changes
- 🔐 **JWT Authentication** - Secure login/signup with JWT tokens (NEW!)
- 👥 **Role-Based Access Control** - Admin and regular user roles (NEW!)
- 🛡️ **Protected Routes** - Upload and delete operations require admin access (NEW!)
- 🔄 **On-Demand Price Fetching** - No continuous polling, fetch only when needed
- ⚡ **Smart 30-Min Cache** - Prevents server overload with intelligent caching
- 🔒 **Concurrency Protection** - Mutex lock ensures single fetch operation
- 📊 **PSX Official Scraping** - Direct scraping from PSX website for closing prices
- 🚀 **Real-Time Dashboard Updates** - Live updates via Socket.IO as prices come in
- 💾 **MongoDB Integration** - Persistent storage for symbols, prices, and users

### 🆕 Dependencies
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `cookie-parser` - Cookie parsing middleware
- `axios` - HTTP client for scraping
- `cheerio` - HTML parsing library
- `mongoose` - MongoDB ODM
- `socket.io` - Real-time bidirectional communication

---

**Built with ❤️ for PSX traders**

🚀 **Happy Trading!**

