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
import magicLineStatusService from './services/magicLineStatusService.js';
import tradePlanStatusService from './services/tradePlanStatusService.js';
import marketHoursService from './services/marketHoursService.js';
import db from './db/database.js';
import uploadRoutes from './routes/upload.js';
import symbolsRoutes from './routes/symbols.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import stocksRoutes from './routes/stocks.js';
import tradePlansRoutes from './routes/tradePlans.js';
import settingsRoutes from './routes/settings.js';

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

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const symbols = await db.getAllSymbols();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      mode: 'on-demand',
      symbolsCount: symbols.length,
      dataSource: 'PSX Official (dps.psx.com.pk) - Closing Prices'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/symbols', symbolsRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/trade-plans', tradePlansRoutes);
app.use('/api/settings', settingsRoutes);

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
      symbols: '/api/symbols (GET)',
      symbolDetail: '/api/symbols/:symbol (GET)',
      clearSymbols: '/api/symbols (DELETE) [Admin]',
      stats: '/api/symbols/stats/summary (GET)'
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
  console.log(`👤 Client connected: ${socket.id}`);

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
    console.log(`👤 Client disconnected: ${socket.id}`);
  });
});

// Setup centralized price service handler
centralizedPriceService.onUpdate(async (data) => {
  if (data.type === 'priceUpdate') {
    // Broadcast price update to all connected clients
    io.emit('priceUpdate', {
      checked: data.data.checked,
      updated: data.data.updated,
      timestamp: data.data.timestamp,
      errors: data.data.errors
    });
    
    console.log('📢 Broadcasting price updates to all clients');
  }
});

// Setup Magic Line status service handler
magicLineStatusService.onUpdate(async (data) => {
  if (data.type === 'statusUpdate') {
    // Broadcast status change to all connected clients
    io.emit('magicLineUpdate', {
      symbol: data.data.symbol,
      status: data.data.status,
      currentPrice: data.data.currentPrice,
      targetPrice: data.data.targetPrice,
      timestamp: new Date().toISOString()
    });
  }
});

// Setup Trade Plan status service handler
tradePlanStatusService.onUpdate(async (data) => {
  // Broadcast trade plan updates to all connected clients
  io.emit('tradePlanUpdate', {
    type: data.type,
    data: data.data,
    timestamp: new Date().toISOString()
  });
  
  console.log(`📢 Broadcasting ${data.type} to all clients`);
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
    
    console.log('\n⚙️  System Settings Loaded:');
    console.log(`   Polling Interval: ${pollingInterval} minutes`);
    console.log(`   Polling Enabled: ${settings.pricePolling.enabled}`);
    
    // Start Centralized Price Service & Status Checkers (only during market hours)
    console.log('\n📊 Starting Centralized Price & Status Services...');
    console.log('⏰ PSX Market Hours:');
    console.log('   • Monday-Thursday: 9:15 AM - 3:30 PM PKT');
    console.log('   • Friday: 9:15 AM - 12:00 PM & 2:30 PM - 4:30 PM PKT');
    console.log('   • Weekends: Closed\n');
    
    // Start Centralized Price Service (fetches prices from PSX and updates Stock model)
    centralizedPriceService.start(pollingInterval);
    console.log(`✅ Centralized Price Service started (${pollingInterval} min interval)`);
    console.log('   → Updates Stock model with live prices from PSX');
    
    // Start Magic Line Status Service (reads from Stock model)
    magicLineStatusService.start(pollingInterval);
    console.log(`✅ Magic Line Status Service started (${pollingInterval} min interval)`);
    console.log('   → Reads prices from Stock model (centralized)');
    
    // Start Trade Plan Status Service (reads from Stock model)
    tradePlanStatusService.start(pollingInterval);
    console.log(`✅ Trade Plan Status Service started (${pollingInterval} min interval)`);
    console.log('   → Reads prices from Stock model (centralized)');
    
    // Trigger initial price check if market is open
    setTimeout(async () => {
      try {
        const status = marketHoursService.isMarketOpen();
        if (status.isOpen) {
          console.log('\n🔄 Triggering initial price fetch (market is open)...');
          await centralizedPriceService.checkPrices();
          await magicLineStatusService.checkStatuses();
          await tradePlanStatusService.checkStatuses();
        } else {
          console.log('\n⏸️ Market is closed - services will activate during next market hours');
        }
      } catch (error) {
        console.log('ℹ️ Skipping initial fetch:', error.message);
      }
    }, 3000); // Wait 3 seconds after startup

    // Start HTTP server - ALWAYS listen on 0.0.0.0 for external access
    // Use 0.0.0.0 to accept connections from any IP (required for Fly.io and mobile)
    const host = '0.0.0.0';
    httpServer.listen(config.port, host, () => {
      console.log(`✅ Server running on http://${host}:${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`📡 Socket.IO available for real-time updates`);
      console.log(`🍃 MongoDB connected and ready`);
      console.log(`📌 Data Source: PSX Official (dps.psx.com.pk) - Closing Prices`);
      console.log(`\n📚 API Documentation:`);
      console.log(`   Health Check: GET http://localhost:${config.port}/health`);
      console.log(`   Upload File:  POST http://localhost:${config.port}/api/upload`);
      console.log(`   Get Symbols:  GET http://localhost:${config.port}/api/symbols`);
      console.log(`   Fetch Prices: POST http://localhost:${config.port}/api/symbols/fetch-prices`);
      console.log(`\n🎯 Ready to monitor PSX stocks!`);
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
