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

  // Email Configuration - Multi-Provider Support
  email: {
    // Resend (Recommended - 3000/month free)
    resendApiKey: process.env.RESEND_API_KEY || '',

    // SendGrid (100/day free - requires: npm install @sendgrid/mail)
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',

    // Brevo/SendInBlue (300/day free - requires: npm install @sendinblue/client)
    brevoApiKey: process.env.BREVO_API_KEY || '',

    // SMTP/Gmail (500/day free - may be blocked on Railway Free/Hobby)
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',

    // Common settings
    fromName: process.env.EMAIL_FROM_NAME || 'PSX SmartDesk',
    fromEmail: process.env.EMAIL_FROM_EMAIL || 'noreply@psxsmartdesk.com',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
  },

  // Python Core System (Trading Strategy Engine)
  pythonCore: {
    baseUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:5002',
    // Off by default: the Python strategy engine is a separate service and is
    // usually not running. Set PYTHON_SERVICE_HEALTHCHECK=true when it is.
    healthCheckEnabled: process.env.PYTHON_SERVICE_HEALTHCHECK === 'true',
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
      timeout: parseInt(process.env.TRADINGVIEW_TIMEOUT) || 300000 // 5 minutes
    },

    // StockAnalysis.com scraper configuration
    stockanalysis: {
      enabled: process.env.STOCKANALYSIS_ENABLED !== 'false',
      range: process.env.STOCKANALYSIS_RANGE || '10Y'
    }
  }
};

