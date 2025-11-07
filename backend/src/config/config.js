export default {
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/psx_monitor',

  // Smart cache configuration (prevent excessive scraping)
  cacheDuration: parseInt(process.env.CACHE_DURATION) || 30 * 60 * 1000, // 30 minutes in milliseconds

  // JWT Authentication
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Admin signup code (required to create admin accounts)
  adminSignupCode: process.env.ADMIN_SIGNUP_CODE || 'admin123',

  // Historical Data Sources Configuration
  dataSources: {
    // Primary source for OHLCV data (tradingview or stockanalysis)
    primary: process.env.PRIMARY_DATA_SOURCE || 'tradingview',

    // TradingView API configuration (adjusted data from core engine)
    tradingview: {
      enabled: process.env.TRADINGVIEW_ENABLED !== 'false', // enabled by default
      apiUrl: process.env.TRADINGVIEW_API_URL || 'http://localhost:5002/api/tradingview/populate',
      timeout: parseInt(process.env.TRADINGVIEW_TIMEOUT) || 300000 // 5 minutes (300 seconds)
    },

    // StockAnalysis.com scraper configuration
    stockanalysis: {
      enabled: process.env.STOCKANALYSIS_ENABLED !== 'false', // enabled by default
      range: process.env.STOCKANALYSIS_RANGE || '10Y'
    }
  }
};

