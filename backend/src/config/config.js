export default {
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/psx_monitor',
  
  // Polling configuration
  pollingInterval: parseInt(process.env.POLLING_INTERVAL) || 60000, // 60 seconds
  
  // Smart cache configuration (prevent excessive scraping)
  cacheDuration: parseInt(process.env.CACHE_DURATION) || 30 * 60 * 1000, // 30 minutes in milliseconds
  
  // Data source URLs (kept for reference, not used anymore)
  psxWebSocketUrl: process.env.PSX_WEBSOCKET_URL || 'wss://psxterminal.com/',
  psxApiUrl: process.env.PSX_API_URL || 'https://psxterminal.com/api',
};

