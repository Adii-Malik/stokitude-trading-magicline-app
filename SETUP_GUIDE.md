# 🚀 Quick Setup Guide

## Step-by-Step Installation

### 1️⃣ Install Dependencies

**Root directory:**
```bash
npm install
```

**Or install separately:**
```bash
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd frontend
npm install
```

### 2️⃣ Start the Application

**Option A: Start both services at once (recommended)**
```bash
npm run dev
```

**Option B: Start separately**

Terminal 1 (Backend):
```bash
npm run dev:backend
# or
cd backend && npm run dev
```

Terminal 2 (Frontend):
```bash
npm run dev:frontend
# or
cd frontend && npm run dev
```

### 3️⃣ Open the App

Open your browser and navigate to:
```
http://localhost:3000
```

The backend API will be running on:
```
http://localhost:5000
```

### 4️⃣ Upload Your Data

1. Click on the upload area
2. Select `sample-data.csv` or your own CSV file
3. Watch as your stocks appear on the dashboard!

---

## 🎯 What Happens Next?

✅ **Backend** connects to PSX Terminal WebSocket  
✅ **Frontend** connects to backend via Socket.IO  
✅ **Real-time prices** start flowing  
✅ **Green alerts** appear when Magic Lines are met!

---

## 🔍 Verify Everything is Working

### Check Backend Health
```bash
curl http://localhost:5000/health
```

Should return:
```json
{
  "status": "ok",
  "psxWebSocket": "connected",
  "symbolsCount": 0
}
```

### Check WebSocket Connection
Open browser console (F12) and look for:
```
✅ Connected to server via Socket.IO
```

---

## 📊 Using the Sample Data

The `sample-data.csv` includes 150+ PSX symbols with their Magic Line thresholds.

To test immediately:
1. Upload `sample-data.csv`
2. Watch the dashboard populate
3. Wait for real-time price updates
4. See green highlights when prices meet thresholds!

---

## 🐛 Common Issues

### Port Already in Use

**Backend (port 5000):**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill -9
```

**Frontend (port 3000):**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### WebSocket Not Connecting

1. Check backend logs - should see: `✅ Connected to PSX Terminal WebSocket`
2. Check browser console for errors
3. Ensure backend is running before frontend
4. Try refreshing the page

### No Price Updates

- PSX market might be closed (trading hours: 9:15 AM - 3:30 PM PKT)
- Check if symbols are loaded: `curl http://localhost:5000/api/symbols`
- Verify WebSocket connection in backend logs

---

## 🎨 What You'll See

### Dashboard Features:
- 📊 Symbol cards with real-time prices
- 🎯 Magic Line thresholds
- 📈 Price change indicators
- 📊 Progress bars
- ✨ **GREEN HIGHLIGHTING** when targets are met!
- 🔄 Auto-refresh with live updates

### Upload Features:
- 📤 Drag & drop interface
- 📁 CSV support
- 🖼️ Image support (with OCR)
- ✅ Success/error notifications
- 📊 Upload statistics

---

## 🚀 Ready to Trade!

Once everything is running:
1. Monitor your favorite stocks
2. Set Magic Line thresholds
3. Get instant visual alerts
4. Make informed trading decisions!

**Happy Trading! 📈**

