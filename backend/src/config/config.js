export default {
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/psx_monitor',
  
  // Smart cache configuration (prevent excessive scraping)
  cacheDuration: parseInt(process.env.CACHE_DURATION) || 30 * 60 * 1000, // 30 minutes in milliseconds
};

