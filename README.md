# PSX Magic Line Monitor

Real-time stock price monitoring application for Pakistan Stock Exchange (PSX). Track multiple stocks and get visual alerts when prices meet or exceed your "Magic Line" thresholds.

![PSX Monitor](https://img.shields.io/badge/PSX-Monitor-blue)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green)
![React](https://img.shields.io/badge/React-18-blue)

## 🌟 Features

- **📊 Real-time Price Monitoring**: Live price updates via WebSocket connection to PSX Terminal
- **🎯 Magic Line Tracking**: Set threshold prices for each stock
- **✨ Visual Alerts**: Beautiful green highlighting and animations when thresholds are met
- **📤 Easy Data Upload**: Support for both CSV files and images (with OCR)
- **📈 Comprehensive Stats**: Track highs, lows, volume, trades, and more
- **🎨 Beautiful UI**: Modern, responsive design with Tailwind CSS
- **🔄 Auto-reconnect**: Resilient WebSocket connection with automatic reconnection

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│     PSX Terminal (psxterminal.com)      │
│  WebSocket API + REST API               │
└────────────────┬────────────────────────┘
                 │
                 │ Real-time price stream
                 │
┌────────────────▼────────────────────────┐
│       Backend (Node.js + Express)       │
│  ┌──────────────────────────────────┐   │
│  │  WebSocket Client                │   │
│  │  - Connects to PSX Terminal      │   │
│  │  - Subscribes to market data     │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Socket.IO Server                │   │
│  │  - Broadcasts to clients         │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  REST API                        │   │
│  │  - Upload CSV/Image              │   │
│  │  - Manage symbols                │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
                 │
                 │ Socket.IO + REST
                 │
┌────────────────▼────────────────────────┐
│      Frontend (React + Vite)            │
│  ┌──────────────────────────────────┐   │
│  │  Dashboard                       │   │
│  │  - Real-time price display       │   │
│  │  - Green highlighting            │   │
│  │  - Progress indicators           │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Upload Form                     │   │
│  │  - CSV upload                    │   │
│  │  - Image upload with OCR         │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
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

2. **Install Backend Dependencies**

```bash
cd backend
npm install
```

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

2. **Upload your Magic Line data** using one of these methods:
   - **CSV File**: Use the provided `sample-data.csv` or create your own
   - **Image**: Upload a screenshot of your stock table
   - **Manual**: Use the API to add symbols programmatically

3. **Watch the magic happen!** 🎉
   - Stocks will appear on the dashboard
   - Prices update in real-time
   - When a price meets or exceeds the Magic Line, it turns **GREEN** with animations!

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
│   │       ├── psxWebSocket.js   # PSX WebSocket client
│   │       ├── csvParser.js      # CSV parsing
│   │       └── ocrService.js     # Image OCR
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

#### Upload CSV/Image
```http
POST /api/upload
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

#### Clear All Symbols
```http
DELETE /api/symbols
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

### 1. Real-time Price Updates
- WebSocket connection to PSX Terminal
- Automatic reconnection on disconnect
- Live price updates every few seconds

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
PSX_WEBSOCKET_URL=wss://psxterminal.com/
PSX_API_URL=https://psxterminal.com/api
NODE_ENV=development
```

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
- Check backend logs for PSX WebSocket connection status
- Verify symbols are correctly loaded
- PSX market might be closed (check trading hours)

### OCR not working
- Ensure image quality is good
- Table should be clearly visible
- Try using CSV format instead

## 📝 License

MIT License - Feel free to use for personal or commercial projects

## 🙏 Credits

- **PSX Terminal**: Data provided by [psxterminal.com](https://psxterminal.com)
- **Icons**: [Lucide React](https://lucide.dev)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)

## 📧 Support

For issues or questions:
1. Check the troubleshooting section
2. Review backend logs: `cd backend && npm run dev`
3. Check browser console for frontend errors

---

**Built with ❤️ for PSX traders**

🚀 **Happy Trading!**

