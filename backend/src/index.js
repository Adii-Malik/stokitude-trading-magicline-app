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
import tradePlanHandler from './handlers/tradePlanHandler.js';
import portfolioHandler from './handlers/portfolioHandler.js';
import marketHoursService from './services/marketHoursService.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import stocksRoutes from './routes/stocks.js';
import tradePlansRoutes from './routes/tradePlans.js';
import settingsRoutes from './routes/settings.js';
import historicalRoutes from './routes/historical.js';
import strategiesRoutes from './routes/strategies.js';
import signalsRoutes from './routes/signals.js';
import jobsRoutes from './routes/jobs.js';
import notificationsRoutes from './routes/notifications.js';
import systemRoutes from './routes/system.js';
import portfoliosRoutes from './routes/portfolios.js';
import journalRoutes from './routes/journal.js';

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
app.use('/api/stocks', stocksRoutes);
app.use('/api/trade-plans', tradePlansRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/signals', signalsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/portfolios', portfoliosRoutes);
app.use('/api/journal', journalRoutes);

// Mount test routes only in development
if (process.env.NODE_ENV === 'development') {
  const notificationTestRoutes = (await import('./test/routes/notificationTests.js')).default;
  app.use('/api/notifications', notificationTestRoutes);
}

// Root API endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'PSX SmartDesk API',
    version: '3.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      admin: '/api/admin  [Admin]',
      portfolios: '/api/portfolios',
      tradePlans: '/api/trade-plans',
      stocks: '/api/stocks',
      historical: '/api/historical',
      strategies: '/api/strategies',
      signals: '/api/signals',
      jobs: '/api/jobs  [Admin]',
      notifications: '/api/notifications',
      settings: '/api/settings',
      system: '/api/system'
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
    // Report when prices were last refreshed (Stock model is the source of truth)
    let lastUpdate = null;

    const Stock = (await import('./models/Stock.js')).default;
    const mostRecentStock = await Stock.findOne({ currentPrice: { $ne: null } })
      .sort({ lastUpdated: -1 })
      .select('lastUpdated')
      .lean();

    if (mostRecentStock && mostRecentStock.lastUpdated) {
      lastUpdate = new Date(mostRecentStock.lastUpdated).toISOString();
    }

    socket.emit('initialData', { lastUpdate });

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
    await tradePlanHandler.checkTradePlans();

    // Update portfolio positions with new prices
    if (data.data.updatedSymbols && data.data.updatedSymbols.length > 0) {
      await portfolioHandler.handlePriceUpdate(data.data.updatedSymbols);
    }
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

// Setup Portfolio handler - Broadcasts when portfolio positions update
portfolioHandler.onUpdate(async (data) => {
  if (data.type === 'portfolioUpdate') {
    io.emit('portfolioUpdate', {
      affectedPortfolios: data.data.affectedPortfolios,
      updatedSymbols: data.data.updatedSymbols,
      positionsUpdated: data.data.positionsUpdated,
      timestamp: data.data.timestamp
    });
  }
});

// Start application
async function startServer() {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 PSX SmartDesk Backend');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Connect to MongoDB
    await connectDB(config.mongoUri);

    // Initialize Email Service
    const emailService = (await import('./services/emailService.js')).default;
    await emailService.initialize();

    // Initialize Job Management System
    const jobManager = (await import('./jobs/jobManager.js')).default;
    await jobManager.initialize();

    // Initialize System Settings
    const Settings = (await import('./models/Settings.js')).default;
    const settings = await Settings.getSettings();

    // Load market hours from settings into marketHoursService
    marketHoursService.updateConfig(settings.marketHours);

    // Note: All automated services (Price Polling, TradingView Updates, Signal Generation)
    // are now managed by the Job Management System. Check Admin > Jobs to configure.

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
process.on('SIGTERM', async () => {
  console.log('⚠️ SIGTERM received, shutting down gracefully...');

  // Shutdown job manager
  const jobManager = (await import('./jobs/jobManager.js')).default;
  await jobManager.shutdown();

  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n⚠️ SIGINT received, shutting down gracefully...');

  // Shutdown job manager
  const jobManager = (await import('./jobs/jobManager.js')).default;
  await jobManager.shutdown();

  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});
