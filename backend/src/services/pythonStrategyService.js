import axios from 'axios';

class PythonStrategyService {
  constructor() {
    this.baseUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5002';
    this.timeout = parseInt(process.env.PYTHON_SERVICE_TIMEOUT) || 30000;
    this.retryAttempts = parseInt(process.env.PYTHON_SERVICE_RETRY_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.PYTHON_SERVICE_RETRY_DELAY) || 1000;
    this.isHealthy = true;
    this.lastHealthCheck = null;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Start health check monitoring
    this.startHealthCheckMonitoring();
  }

  /**
   * Health Check - Poll Python service status
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      this.isHealthy = response.data.status === 'healthy';
      this.lastHealthCheck = new Date();
      return response.data;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();
      throw this.handleError(error, 'Health check failed');
    }
  }

  /**
   * Start periodic health check monitoring
   */
  startHealthCheckMonitoring() {
    setInterval(async () => {
      try {
        await this.healthCheck();
        if (!this.isHealthy) {
          console.warn('[Python Service] Service is unhealthy');
        }
      } catch (error) {
        console.error('[Python Service] Health check error:', error.message);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * List Available Strategies
   */
  async listStrategies() {
    try {
      const response = await this.retryRequest(() =>
        this.client.get('/api/strategies')
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to list strategies');
    }
  }

  /**
   * Get Strategy Details
   */
  async getStrategy(strategyName) {
    try {
      const response = await this.retryRequest(() =>
        this.client.get(`/api/strategies/${strategyName}`)
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to get strategy: ${strategyName}`);
    }
  }

  /**
   * Generate Signals for a Symbol
   */
  async generateSignals(params) {
    try {
      const response = await this.retryRequest(() =>
        this.client.post('/api/signals/generate', params)
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to generate signals');
    }
  }

  /**
   * Batch Generate Signals
   */
  async batchGenerateSignals(params) {
    try {
      const response = await this.retryRequest(() =>
        this.client.post('/api/signals/batch', params)
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to batch generate signals');
    }
  }

  /**
   * Run Backtest
   */
  async runBacktest(params) {
    try {
      // Increase timeout for backtests
      const response = await this.retryRequest(() =>
        this.client.post('/api/backtest/run', params, {
          timeout: 60000 // 60 seconds for backtests
        })
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to run backtest');
    }
  }

  /**
   * Get Available Symbols
   */
  async getAvailableSymbols() {
    try {
      const response = await this.retryRequest(() =>
        this.client.get('/api/symbols')
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get available symbols');
    }
  }

  /**
   * Get Symbol Info
   */
  async getSymbolInfo(symbol) {
    try {
      const response = await this.retryRequest(() =>
        this.client.get(`/api/symbols/${symbol}`)
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to get symbol info: ${symbol}`);
    }
  }

  /**
   * Retry request with exponential backoff
   */
  async retryRequest(requestFn, attempt = 1) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }

      // Only retry on network errors or 5xx errors
      const shouldRetry =
        !error.response ||
        (error.response.status >= 500 && error.response.status < 600);

      if (!shouldRetry) {
        throw error;
      }

      // Exponential backoff
      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      console.log(`[Python Service] Retrying request (attempt ${attempt + 1}/${this.retryAttempts}) after ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryRequest(requestFn, attempt + 1);
    }
  }

  /**
   * Handle and format errors
   */
  handleError(error, context) {
    const errorDetails = {
      context,
      timestamp: new Date().toISOString(),
      serviceUrl: this.baseUrl
    };

    if (error.code === 'ECONNREFUSED') {
      errorDetails.type = 'CONNECTION_REFUSED';
      errorDetails.message = 'Python service is not reachable';
      errorDetails.statusCode = 503;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorDetails.type = 'TIMEOUT';
      errorDetails.message = 'Request to Python service timed out';
      errorDetails.statusCode = 504;
    } else if (error.response) {
      errorDetails.type = 'API_ERROR';
      errorDetails.message = error.response.data?.error || error.response.data?.message || 'Python service returned an error';
      errorDetails.statusCode = error.response.status;
      errorDetails.errorCode = error.response.data?.error_code;
      errorDetails.details = error.response.data;
    } else {
      errorDetails.type = 'UNKNOWN_ERROR';
      errorDetails.message = error.message || 'Unknown error occurred';
      errorDetails.statusCode = 500;
    }

    console.error('[Python Service Error]', errorDetails);

    const customError = new Error(errorDetails.message);
    customError.details = errorDetails;
    customError.statusCode = errorDetails.statusCode;

    return customError;
  }

  /**
   * Check if service is healthy
   */
  isServiceHealthy() {
    return this.isHealthy;
  }

  /**
   * Get last health check timestamp
   */
  getLastHealthCheck() {
    return this.lastHealthCheck;
  }
}

// Export singleton instance
export default new PythonStrategyService();
