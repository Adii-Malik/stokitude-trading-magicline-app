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

- **🎯 Magic Line Analysis** - Smart price alerts with real-time monitoring
- **📊 Trade Plans & Signals** - Multi-level plans with target management
- **💼 User Management** - Role-based access with approval system
- **📈 Centralized Price Service** - Single source of truth for all stock data
- **🎨 Modern UI/UX** - Responsive design with dark mode
- **🔐 Security** - JWT authentication with bcrypt encryption

---

## 🏗️ Tech Stack

### Backend
- **Node.js + Express.js** - REST API server
- **MongoDB + Mongoose** - Database & ODM
- **Socket.IO** - Real-time updates
- **JWT + Bcrypt** - Authentication & security

### Frontend
- **React 18 + Vite** - Fast, modern UI
- **Tailwind CSS** - Utility-first styling
- **React Router v6** - Client-side routing
- **Socket.IO Client** - Real-time connection

### Architecture
- **Event-Driven** - Centralized price service with handlers
- **Single Source of Truth** - Stock model for all price data
- **Job Management System** - Scheduled tasks & automation
- **PWA Ready** - Progressive web app capabilities

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB v7.0+
- npm v9+

### Installation

```bash
# Clone repository
git clone <repository-url>
cd psx_terminal_app

# Backend setup
cd backend
npm install
cp .env.example .env  # Configure your environment variables

# Create super admin
npm run create-admin

# Start backend (Terminal 1)
npm run dev

# Frontend setup (Terminal 2)
cd ../frontend
npm install
npm run dev
```

**Access:** `http://localhost:3000`

**📖 For detailed setup instructions, see [GETTING_STARTED.md](docs/GETTING_STARTED.md)**

---

## 📁 Project Structure

```
psx_terminal_app/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── models/       # MongoDB models
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   ├── handlers/     # Event handlers
│   │   ├── jobs/         # Job management system
│   │   └── middleware/   # Auth & validation
│   └── package.json
├── frontend/             # React + Vite app
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # State management
│   │   └── services/     # API clients
│   └── package.json
└── docs/                 # Technical documentation
    ├── GETTING_STARTED.md
    ├── ARCHITECTURE.md
    ├── FRONTEND.md
    └── ...
```

---

## 📚 Documentation

### 🎯 Getting Started
- **[GETTING_STARTED.md](docs/GETTING_STARTED.md)** - Installation, database setup, deployment

### 🏗️ Technical Documentation
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Backend architecture, database schema, API endpoints
- **[FRONTEND.md](docs/FRONTEND.md)** - React components, state management, routing

### 🎨 Design & Features
- **[DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)** - UI/UX guidelines, color system, components
- **[JOBS.md](docs/JOBS.md)** - Job management system & scheduling
- **[TRADING_BOT.md](docs/TRADING_BOT.md)** - Trading bot integration & Python service
- **[PWA_NOTIFICATIONS.md](docs/PWA_NOTIFICATIONS.md)** - Progressive Web App & push notifications

---

## 🎯 Core Features

### Magic Line Analysis
Upload CSV files or manually enter stock symbols with price thresholds. System monitors in real-time and alerts when prices hit targets.

### Trade Plans
Create multi-level trade plans with buy levels, targets, and stop losses. Real-time status tracking for all levels.

### User Management
Role-based access control with approval workflow. Admins can manage users, approve registrations, and configure system settings.

### Automated Price Updates
Centralized service scrapes PSX website every 15 minutes (configurable) during market hours. All prices stored in single Stock model.

---

## 🔌 API Overview

```
Authentication    /api/auth/*          - Login, signup, JWT tokens
Magic Line       /api/magic-line/*    - Price alerts & thresholds
Trade Plans      /api/trade-plans/*   - Trading strategies
Admin            /api/admin/*         - User & system management
Historical Data  /api/historical/*    - OHLCV data scraping
Jobs             /api/jobs/*          - Job management
Settings         /api/settings/*      - System configuration
```

**📖 For complete API documentation, see [ARCHITECTURE.md](docs/ARCHITECTURE.md)**

---

## 🚀 Deployment

### Quick Deploy

**Fly.io:**
```bash
fly launch
fly secrets set JWT_SECRET=your-secret
fly deploy
```

**Railway:**
- Connect GitHub repository
- Set environment variables
- Deploy automatically

**📖 For detailed deployment guide, see [GETTING_STARTED.md](docs/GETTING_STARTED.md)**

---

## 🔐 Environment Variables

```env
# Required
MONGODB_URI=mongodb://localhost:27017/psx_smartdesk
JWT_SECRET=your-super-secret-jwt-key-here
FRONTEND_URL=http://localhost:3000

# Optional
PORT=5000
NODE_ENV=development
POLLING_INTERVAL=15
```

**📖 For complete configuration, see [GETTING_STARTED.md](docs/GETTING_STARTED.md)**

---

## 🐛 Troubleshooting

**MongoDB connection failed?**
- Check `MONGODB_URI` in `.env`
- Ensure MongoDB is running
- Verify network access (Atlas IP whitelist)

**Port already in use?**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

**JWT token invalid?**
- Clear browser localStorage
- Re-login with valid credentials

**📖 For detailed troubleshooting, see [GETTING_STARTED.md](docs/GETTING_STARTED.md)**

---

## 📖 Documentation Index

| Document | Description |
|----------|-------------|
| **[GETTING_STARTED.md](docs/GETTING_STARTED.md)** | Installation, setup, deployment |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | System architecture, API, database |
| **[FRONTEND.md](docs/FRONTEND.md)** | React components & state |
| **[DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)** | UI/UX guidelines |
| **[JOBS.md](docs/JOBS.md)** | Job management system |
| **[TRADING_BOT.md](docs/TRADING_BOT.md)** | Trading bot integration |
| **[PWA_NOTIFICATIONS.md](docs/PWA_NOTIFICATIONS.md)** | PWA & notifications |

---

## 🛣️ Roadmap

- [ ] Email & SMS notifications
- [ ] Advanced charting (TradingView)
- [ ] Portfolio management
- [ ] Historical data analysis
- [ ] Mobile app (React Native)
- [ ] Multi-language support

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🙏 Credits

**Data Source:** [Pakistan Stock Exchange (PSX)](https://dps.psx.com.pk)

**Built with:** Node.js • Express • MongoDB • React • Vite • Tailwind CSS • Socket.IO

---

**Built with ❤️ for PSX Traders**

🚀 **Start Trading Smarter Today!**
