import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/config.js';
import { connectDB } from './config/mongodb.js';
import psxWebSocket from './services/psxWebSocket.js';
import db from './db/database.js';
import uploadRoutes from './routes/upload.js';
import symbolsRoutes from './routes/symbols.js';

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
app.use(cors());
app.use(express.json());

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
      psxWebSocket: psxWebSocket.isConnected() ? 'connected' : 'disconnected',
      symbolsCount: symbols.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// API Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/symbols', symbolsRoutes);

// Root API endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'PSX Magic Line Monitor API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      upload: '/api/upload (POST)',
      uploadManual: '/api/upload/manual (POST)',
      symbols: '/api/symbols (GET)',
      symbolDetail: '/api/symbols/:symbol (GET)',
      clearSymbols: '/api/symbols (DELETE)',
      stats: '/api/symbols/stats/summary (GET)'
    },
    websocket: 'Socket.IO available for real-time updates'
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

// Setup PSX WebSocket message handler
psxWebSocket.onMessage(async (message) => {
  if (message.data && message.data.symbol) {
    const symbol = message.data.symbol;
    
    try {
      const symbolInfo = await db.getSymbol(symbol);
      
      // Only emit if we're tracking this symbol
      if (symbolInfo) {
        const currentPrice = message.data.price;
        const isMet = currentPrice >= symbolInfo.magicLine;
        
        // Update price in database
        await db.updatePrice(symbol, message.data);
        
        // Broadcast price update to all connected clients
        io.emit('priceUpdate', {
          symbol: symbol,
          magicLine: symbolInfo.magicLine,
          currentPrice: currentPrice,
          priceData: message.data,
          isMet: isMet,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`Error processing price update for ${symbol}:`, error);
    }
  }
});

// Start application
async function startServer() {
  try {
    // Connect to MongoDB
    console.log('🚀 Starting PSX Monitor Backend...');
    await connectDB(config.mongoUri);
    
    // Start PSX WebSocket connection
    psxWebSocket.connect();

    // Start HTTP server
    httpServer.listen(config.port, () => {
      console.log(`✅ Server running on http://localhost:${config.port}`);
      console.log(`📡 Socket.IO available for real-time updates`);
      console.log(`🍃 MongoDB connected and ready`);
      console.log(`\n📚 API Documentation:`);
      console.log(`   Health Check: GET http://localhost:${config.port}/health`);
      console.log(`   Upload File:  POST http://localhost:${config.port}/api/upload`);
      console.log(`   Get Symbols:  GET http://localhost:${config.port}/api/symbols`);
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
  psxWebSocket.disconnect();
  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down gracefully...');
  psxWebSocket.disconnect();
  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});
