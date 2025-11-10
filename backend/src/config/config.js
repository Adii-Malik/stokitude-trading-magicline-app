// Centralized Configuration - Only base URLs in .env
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

  // Python Core System (Trading Strategy Engine)
  pythonCore: {
    baseUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:5002',
    timeout: parseInt(process.env.PYTHON_SERVICE_TIMEOUT) || 60000, // 1 minute
    retryAttempts: parseInt(process.env.PYTHON_SERVICE_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.PYTHON_SERVICE_RETRY_DELAY) || 1000,
    // All endpoints defined here (not in .env)
    endpoints: {
      health: '/health',
      strategies: '/api/strategies',
      strategyDetail: (name) => `/api/strategies/${name}`,
      signals: '/api/signals/generate',
      signalsBatch: '/api/signals/batch',
      backtest: '/api/backtest/run',
      symbols: '/api/symbols',
      symbolInfo: (symbol) => `/api/symbols/${symbol}`,
      slPresets: '/api/config/sl-presets',
      slConfig: (preset) => `/api/config/sl-config/${preset}`,
      tradingviewPopulate: '/api/tradingview/populate',
      tradingviewUpdate: '/api/tradingview/update'
    }
  },

  // Historical Data Sources Configuration
  dataSources: {
    // Primary source for OHLCV data (tradingview or stockanalysis)
    primary: process.env.PRIMARY_DATA_SOURCE || 'tradingview',

    // TradingView - Uses Python Core endpoints
    tradingview: {
      enabled: process.env.TRADINGVIEW_ENABLED !== 'false',
      // Uses pythonCore.baseUrl + pythonCore.endpoints.tradingviewPopulate
      timeout: parseInt(process.env.TRADINGVIEW_TIMEOUT) || 300000 // 5 minutes
    },

    // StockAnalysis.com scraper configuration
    stockanalysis: {
      enabled: process.env.STOCKANALYSIS_ENABLED !== 'false',
      range: process.env.STOCKANALYSIS_RANGE || '10Y'
    }
  }
};

