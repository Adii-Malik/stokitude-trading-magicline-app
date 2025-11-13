import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/config.js';
import { connectDB } from './config/mongodb.js';
import centralizedPriceService from './services/centralizedPriceService.js';
import historicalDataScheduler from './services/historicalDataScheduler.js';
import tradingViewScheduler from './services/tradingViewScheduler.js';
import signalGenerationScheduler from './services/signalGenerationScheduler.js';
import magicLineHandler from './handlers/magicLineHandler.js';
import tradePlanHandler from './handlers/tradePlanHandler.js';
import marketHoursService from './services/marketHoursService.js';
import db from './db/database.js';
import uploadRoutes from './routes/upload.js';
import magicLineRoutes from './routes/magicLine.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import stocksRoutes from './routes/stocks.js';
import tradePlansRoutes from './routes/tradePlans.js';
import settingsRoutes from './routes/settings.js';
import historicalRoutes from './routes/historical.js';
import strategiesRoutes from './routes/strategies.js';
import backtestRoutes from './routes/backtest.js';
import signalsRoutes from './routes/signals.js';
import serviceMonitorRoutes from './routes/serviceMonitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve static files from React build (production)
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Health check endpoint - monitor automated services
app.get('/health', async (req, res) => {
  const fs = await import('fs');
  const frontendBuilt = fs.existsSync(path.join(frontendDistPath, 'index.html'));

  const isDev = config.nodeEnv === 'development';
  const backendUrl = isDev
    ? `http://localhost:${config.port}`
    : `${req.protocol}://${req.get('host')}`;
  const frontendUrl = isDev
    ? `http://localhost:${process.env.VITE_PORT || 3000}`
    : backendUrl;

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    backend: {
      environment: config.nodeEnv,
      url: backendUrl,
      port: config.port,
      uptime: `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`
    },
    frontend: {
      status: isDev
        ? 'dev mode (separate server)'
        : (frontendBuilt ? 'available' : 'missing'),
      url: frontendUrl,
      port: isDev ? (parseInt(process.env.VITE_PORT) || 3000) : config.port,
      servedBy: isDev ? 'vite dev server' : 'backend'
    },
    database: {
      status: 'disconnected'
    },
    services: {
      pricePolling: centralizedPriceService.isRunning ? 'running' : 'stopped',
      historicalDataScheduler: historicalDataScheduler.isRunning ? 'running' : 'stopped',
      socketIO: io.engine.clientsCount > 0 ? `active (${io.engine.clientsCount} clients)` : 'idle',
      marketStatus: marketHoursService.getMarketStatus().isOpen ? 'open' : 'closed'
    }
  };

  try {
    // Check DB connection
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState === 1) {
      health.database.status = 'connected';
    } else {
      health.status = 'degraded';
      health.database.status = 'disconnected';
    }
  } catch (error) {
    health.status = 'degraded';
    health.database.status = 'error';
    health.database.error = error.message;
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/historical', historicalRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/magic-line', magicLineRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/trade-plans', tradePlansRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/backtest', backtestRoutes);
app.use('/api/signals', signalsRoutes);
app.use('/api/service-monitor', serviceMonitorRoutes);

// Root API endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'PSX Magic Line Monitor API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      auth: {
        signup: '/api/auth/signup (POST)',
        login: '/api/auth/login (POST)',
        logout: '/api/auth/logout (POST)',
        me: '/api/auth/me (GET)',
        check: '/api/auth/check (GET)'
      },
      admin: {
        users: '/api/admin/users (GET) [Admin]',
        pendingUsers: '/api/admin/users/pending (GET) [Admin]',
        activateUser: '/api/admin/users/:userId/activate (PUT) [Admin]',
        deactivateUser: '/api/admin/users/:userId/deactivate (PUT) [Admin]',
        toggleRole: '/api/admin/users/:userId/toggle-role (PUT) [Admin]',
        deleteUser: '/api/admin/users/:userId (DELETE) [Admin]',
        stats: '/api/admin/stats (GET) [Admin]'
      },
      upload: '/api/upload (POST) [Admin]',
      uploadManual: '/api/upload/manual (POST) [Admin]',
      magicLine: '/api/magic-line (GET)',
      magicLineDetail: '/api/magic-line/:symbol (GET)',
      clearMagicLine: '/api/magic-line (DELETE) [Admin]',
      stats: '/api/magic-line/stats/summary (GET)'
    },
    websocket: 'Socket.IO available for real-time updates',
    note: '[Admin] routes require authentication with admin role'
  });
});

// Serve React app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  // Client connected

  // Send initial data
  try {
    const initialData = await db.getFullData();
    const stats = await db.getStats();

    // Get last price update time from Stock model (centralized)
    let lastUpdate = null;

    // Check Stock model for most recent price update
    const Stock = (await import('./models/Stock.js')).default;
    const mostRecentStock = await Stock.findOne({ currentPrice: { $ne: null } })
      .sort({ lastUpdated: -1 })
      .select('lastUpdated')
      .lean();

    if (mostRecentStock && mostRecentStock.lastUpdated) {
      lastUpdate = new Date(mostRecentStock.lastUpdated).toISOString();
    }

    socket.emit('initialData', {
      symbols: initialData,
      stats,
      lastUpdate
    });

    if (lastUpdate) {
      console.log(`   📊 Last price update: ${new Date(lastUpdate).toLocaleString('en-US', { timeZone: 'Asia/Karachi' })} PKT`);
    } else {
      console.log(`   ⚠️ No price data available yet - waiting for first fetch`);
    }
  } catch (error) {
    console.error('Error sending initial data:', error);
  }

  socket.on('disconnect', () => {
    // Client disconnected
  });
});

// ===== CENTRALIZED EVENT ARCHITECTURE =====
// 1. Centralized Price Service fetches prices and emits event
// 2. Handlers listen to price updates and execute their logic
// 3. Handlers emit their own events for Socket.IO broadcasting

// Setup centralized price service handler - When prices update, notify all listeners
centralizedPriceService.onUpdate(async (data) => {
  if (data.type === 'priceUpdate') {
    console.log('📢 Price update received - notifying all feature handlers');

    // Broadcast to frontend
    io.emit('priceUpdate', {
      checked: data.data.checked,
      updated: data.data.updated,
      timestamp: data.data.timestamp,
      errors: data.data.errors
    });

    // Trigger feature handlers to check their logic
    await magicLineHandler.checkMagicLines();
    await tradePlanHandler.checkTradePlans();
  }
});

// Setup Magic Line handler - Broadcasts when magic line status changes
magicLineHandler.onUpdate(async (data) => {
  if (data.type === 'magicLineUpdate') {
    io.emit('magicLineUpdate', {
      symbol: data.data.symbol,
      status: data.data.status,
      currentPrice: data.data.currentPrice,
      magicLine: data.data.magicLine,
      timestamp: data.data.timestamp
    });
  }
});

// Setup Trade Plan handler - Broadcasts when trade plan updates
tradePlanHandler.onUpdate(async (data) => {
  if (data.type === 'tradePlanUpdate') {
    io.emit('tradePlanUpdate', {
      planId: data.data.planId,
      symbol: data.data.symbol,
      currentPrice: data.data.currentPrice,
      updates: data.data.updates,
      buyLevels: data.data.buyLevels,
      targetPrices: data.data.targetPrices,
      stopLoss: data.data.stopLoss,
      isActive: data.data.isActive,
      timestamp: data.data.timestamp
    });
  }
});

// Start application
async function startServer() {
  try {
    // Connect to MongoDB
    console.log('🚀 Starting PSX Monitor Backend...');
    await connectDB(config.mongoUri);

    // Initialize System Settings
    const Settings = (await import('./models/Settings.js')).default;
    const settings = await Settings.getSettings();
    const pollingInterval = settings.pricePolling.intervalMinutes;
    const pollingEnabled = settings.pricePolling.enabled;

    console.log('\n⚙️  System Settings Loaded:');
    console.log(`   Polling Interval: ${pollingInterval} minutes`);
    console.log(`   Polling Enabled: ${pollingEnabled}`);

    // Load market hours from settings into marketHoursService
    console.log('🕒 Loading market hours from settings...');
    marketHoursService.updateConfig(settings.marketHours);
    console.log('   ✅ Market hours configured from database');

    // Start Centralized Price Service (ONLY ONE SERVICE!) - only if enabled
    console.log('\n📊 Centralized Price Service:');
    console.log('⏰ PSX Market Hours (from settings):');
    const { marketHours } = settings;
    console.log(`   • Monday-Thursday: ${marketHours.regularMarketOpen.hour}:${String(marketHours.regularMarketOpen.minute).padStart(2, '0')} - ${marketHours.regularMarketClose.hour}:${String(marketHours.regularMarketClose.minute).padStart(2, '0')} PKT`);
    console.log(`   • Friday Morning: ${marketHours.fridayMorningOpen.hour}:${String(marketHours.fridayMorningOpen.minute).padStart(2, '0')} - ${marketHours.fridayMorningClose.hour}:${String(marketHours.fridayMorningClose.minute).padStart(2, '0')} PKT`);
    console.log(`   • Friday Afternoon: ${marketHours.fridayAfternoonOpen.hour}:${String(marketHours.fridayAfternoonOpen.minute).padStart(2, '0')} - ${marketHours.fridayAfternoonClose.hour}:${String(marketHours.fridayAfternoonClose.minute).padStart(2, '0')} PKT`);
    console.log(`   • Weekends: Closed${marketHours.publicHolidays && marketHours.publicHolidays.length > 0 ? ` | Public Holidays: ${marketHours.publicHolidays.length}` : ''}\n`);

    if (pollingEnabled) {
      centralizedPriceService.start(pollingInterval);
      console.log(`✅ Price polling started (${pollingInterval} min interval)`);

      // Trigger initial price check if market is open
      setTimeout(async () => {
        try {
          const status = marketHoursService.getMarketStatus();
          if (status.isOpen) {
            await centralizedPriceService.checkPrices();
          } else {
            console.log('⏸️ Market is closed - waiting for trading hours');
          }
        } catch (error) {
          console.error('Initial fetch error:', error.message);
        }
      }, 3000);
    } else {
      console.log('⏸️ Price polling is disabled (enable in Settings)');
    }

    // Start TradingView Scheduler (cron-based, triggers TradingView Core Engine)
    console.log('\n📅 TradingView Update Scheduler:');
    tradingViewScheduler.start();

    // Start Signal Generation Scheduler (cron-based, automated signal generation)
    console.log('\n🤖 Signal Generation Scheduler:');
    signalGenerationScheduler.start();

    // Note: historicalDataScheduler is deprecated in favor of tradingViewScheduler
    // Keeping it available for manual triggers if needed

    // Start HTTP server - ALWAYS listen on 0.0.0.0 for external access
    // Use 0.0.0.0 to accept connections from any IP (required for Fly.io and mobile)
    const host = '0.0.0.0';
    httpServer.listen(config.port, host, () => {
      console.log(`\n✅ Server running on http://${host}:${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`🎯 PSX SmartDesk is ready!\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});
