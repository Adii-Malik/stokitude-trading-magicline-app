export default {
  port: parseInt(process.env.PORT) || 5000,
  psxWebSocketUrl: process.env.PSX_WEBSOCKET_URL || 'wss://psxterminal.com/',
  psxApiUrl: process.env.PSX_API_URL || 'https://psxterminal.com/api',
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/psx_monitor',
};

