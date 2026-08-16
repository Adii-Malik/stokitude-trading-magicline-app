# Financial Reading

**Intelligent Trading Platform for Pakistan Stock Exchange (PSX)**

Portfolio tracking with automated SIP recommendations, multi-level trade plans, and real-time price monitoring scraped from the PSX official website.

![Node.js](https://img.shields.io/badge/Node.js-v18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🌟 Key Features

- **💼 Portfolio & SIP** — Track holdings with live P/L, plus AI-scored monthly SIP allocation recommendations
- **📊 Trade Plans** — Multi-level buy zones, targets, and stop losses with live status tracking
- **📈 Centralized Price Service** — One scraper feeds every feature; `Stock` is the single source of truth
- **🔔 Notifications** — In-app, email, and real-time WebSocket alerts with per-user preferences
- **⚙️ Job Management** — All automation scheduled and monitored from one admin screen
- **🔐 Auth & Roles** — JWT + bcrypt with an admin approval workflow

---

## 🏗️ Tech Stack

**Backend** — Node.js, Express, MongoDB/Mongoose, Socket.IO, Agenda (job scheduling), JWT + bcrypt
**Frontend** — React 18, Vite, Tailwind CSS, React Router v7, Socket.IO client
**Architecture** — Event-driven: the centralized price service emits, feature handlers react

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB v7.0+ (local or Atlas)
- npm v9+

### Installation

```bash
git clone <repository-url>
cd stokitude-trading-magicline-app

# Backend
cd backend
npm install
cp .env.example .env        # then fill in MONGO_URI, JWT_SECRET, SUPER_ADMIN_*

npm run create-admin        # bootstraps the super admin from your .env
npm run dev                 # Terminal 1

# Frontend
cd ../frontend
npm install
npm run dev                 # Terminal 2
```

**Frontend:** `http://localhost:3000` · **API:** `http://localhost:5000`

**📖 Detailed setup: [GETTING_STARTED.md](docs/GETTING_STARTED.md)**

---

## 📁 Project Structure

```
stokitude-trading-magicline-app/
├── backend/                  # Node.js + Express API
│   └── src/
│       ├── models/           # Mongoose schemas
│       ├── routes/           # API endpoints
│       ├── services/         # Business logic (scrapers, portfolio, notifications)
│       ├── handlers/         # Event handlers reacting to price updates
│       ├── jobs/             # Agenda-based job management system
│       └── middleware/       # Auth
├── frontend/                 # React + Vite
│   └── src/
│       ├── components/       # UI, grouped by feature
│       ├── contexts/         # Auth + theme
│       ├── services/         # API clients
│       └── utils/            # Shared formatters
└── docs/                     # Technical documentation
```

---

## 🎯 Core Features

### Portfolio & SIP
Track multiple portfolios with per-position P/L (FIFO or average-cost). The allocation engine scores stocks on fundamentals and recommends how to split each month's SIP budget.

### Trade Plans
Multi-level trade plans with buy zones, targets, and stop losses. Levels update in real time as prices move, and fire notifications on hit.

### Automated Price Updates
The centralized price service scrapes PSX on a configurable schedule during market hours. It polls symbols that appear in **active trade plans** or **open portfolio positions**, then fans results out to every feature handler.

### Job Management
All automation (price polling, TradingView sync, signal generation, fundamentals refresh, log cleanup) runs as scheduled jobs configurable from Admin → Jobs.

---

## 🔌 API Overview

```
/api/auth            Login, signup, JWT
/api/portfolios      Portfolios, positions, transactions, SIP
/api/trade-plans     Trade plans & levels
/api/stocks          Stock master data
/api/historical      OHLCV data
/api/strategies      Trading strategies  (needs Python engine)
/api/signals         Generated signals   (needs Python engine)
/api/jobs            Job management      [Admin]
/api/notifications   Notifications & preferences
/api/settings        System configuration
/api/admin           User management     [Admin]
```

---

## 🔐 Environment Variables

```env
# Required
MONGO_URI=mongodb://localhost:27017/psx_smartdesk
JWT_SECRET=your-super-secret-jwt-key-here

# Super admin bootstrap (used by: npm run create-admin)
SUPER_ADMIN_EMAIL=you@example.com
SUPER_ADMIN_PASSWORD=change-this-strong-password

# Optional
PORT=5000
NODE_ENV=development
ADMIN_SIGNUP_CODE=admin123

# Python strategy engine (separate service - powers Trading Bot)
PYTHON_SERVICE_URL=http://localhost:5002
PYTHON_SERVICE_HEALTHCHECK=false
```

**📖 Full configuration: [GETTING_STARTED.md](docs/GETTING_STARTED.md)**

---

## ⚠️ Known Constraints

- **Trading Bot needs a separate service.** `/api/strategies` and `/api/signals` proxy to a Python strategy engine that is **not part of this repo**. Without it running at `PYTHON_SERVICE_URL`, those screens will not work. Keep `PYTHON_SERVICE_HEALTHCHECK=false` unless it is up.
- **No automated test suite.** `backend/src/test/` and `frontend/src/test/` are dev-only manual testing tools, not tests.

---

## 📚 Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | Installation, database, deployment | Implemented |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Backend architecture, schema, API | Implemented |
| [FRONTEND.md](docs/FRONTEND.md) | React components, state, routing | Implemented |
| [PORTFOLIO.md](docs/PORTFOLIO.md) | Portfolio & SIP system | Implemented |
| [JOBS.md](docs/JOBS.md) | Job management & scheduling | Implemented |
| [NOTIFICATIONS_GUIDE.md](docs/NOTIFICATIONS_GUIDE.md) | Notification system | Implemented |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | UI/UX guidelines, colors | Implemented |
| [DEVELOPMENT_FEATURES.md](docs/DEVELOPMENT_FEATURES.md) | Dev-mode testing tools | Implemented |
| [TRADING_BOT.md](docs/TRADING_BOT.md) | Trading bot & Python service | Partial — needs external service |
| [PWA_GUIDE.md](docs/PWA_GUIDE.md) | Progressive Web App | **Planned — not implemented** |
| [TRADING_JOURNAL_PLAN.md](docs/TRADING_JOURNAL_PLAN.md) | Journal, risk calculator, positions | **Planned — not implemented** |
| [TRADINGVIEW_COMPARISON.md](docs/TRADINGVIEW_COMPARISON.md) | Gap analysis vs TradingView | Archived — Jan 2026 snapshot |

> Docs still contain references to the removed Magic Line feature and have not
> all been re-verified against the current code. Treat the "Status" column as
> authoritative.

---

## 🛣️ Roadmap

- [ ] Trading journal, risk calculator & open positions ([plan](docs/TRADING_JOURNAL_PLAN.md))
- [ ] PWA / installable app ([plan](docs/PWA_GUIDE.md))
- [ ] Automated test suite
- [ ] Bundle code-splitting (single chunk is currently ~790 kB)

---

## 📝 License

MIT

---

## 🙏 Credits

**Data Source:** [Pakistan Stock Exchange (PSX)](https://dps.psx.com.pk)
