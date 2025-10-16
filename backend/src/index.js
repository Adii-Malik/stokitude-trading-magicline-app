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
import pricePollingService from './services/pricePollingService.js';
import tradePlanPollingService from './services/tradePlanPollingService.js';
import db from './db/database.js';
import uploadRoutes from './routes/upload.js';
import symbolsRoutes from './routes/symbols.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import stocksRoutes from './routes/stocks.js';
import tradePlansRoutes from './routes/tradePlans.js';

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
    socket.emit('initialData', { symbols: initialData, stats });
  } catch (error) {
    console.error('Error sending initial data:', error);
  }

  socket.on('disconnect', () => {
    console.log(`👤 Client disconnected: ${socket.id}`);
  });
});

// Setup price polling message handler
pricePollingService.onMessage(async (message) => {
  if (message.type === 'priceUpdate' && message.data && message.data.symbol) {
    const symbol = message.data.symbol;
    
    try {
      const symbolInfo = await db.getSymbol(symbol);
      
      // Only emit if we're tracking this symbol
      if (symbolInfo) {
        const currentPrice = message.data.price;
        const isMet = currentPrice >= symbolInfo.magicLine;
        
        // Broadcast price update to all connected clients
        io.emit('priceUpdate', {
          symbol: symbol,
          magicLine: symbolInfo.magicLine,
          currentPrice: currentPrice,
          priceData: message.data,
          isMet: isMet,
          timestamp: new Date().toISOString(),
          source: message.data.source
        });
      }
    } catch (error) {
      console.error(`Error processing price update for ${symbol}:`, error);
    }
  }
});

// Setup trade plan polling message handler
tradePlanPollingService.onMessage(async (message) => {
  if (message.type === 'tradePlanUpdate' && message.data) {
    // Broadcast trade plan updates to all connected clients
    io.emit('tradePlanUpdate', {
      checked: message.data.checked,
      updated: message.data.updated,
      updates: message.data.updates,
      notifications: message.data.notifications,
      timestamp: new Date().toISOString()
    });
    
    console.log('📢 Broadcasting trade plan updates to all clients');
  }
});

// Start application
async function startServer() {
  try {
    // Connect to MongoDB
    console.log('🚀 Starting PSX Monitor Backend...');
    await connectDB(config.mongoUri);
    
    // Start Auto-Checkers (only during market hours)
    console.log('\n📊 Starting Market-Hours-Aware Auto-Checkers...');
    console.log('⏰ PSX Market Hours:');
    console.log('   • Monday-Thursday: 9:15 AM - 3:30 PM PKT');
    console.log('   • Friday: 9:15 AM - 12:00 PM & 2:30 PM - 4:30 PM PKT');
    console.log('   • Weekends: Closed\n');
    
    // Start Magic Line Price Checker (every 15 minutes during market hours)
    pricePollingService.start(15 * 60 * 1000); // 15 minutes
    console.log('✅ Magic Line Auto-Checker started (15 min interval)');
    
    // Start Trade Plan Auto-Checker (every 15 minutes during market hours)
    tradePlanPollingService.start(15 * 60 * 1000); // 15 minutes
    console.log('✅ Trade Plan Auto-Checker started (15 min interval)');

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
