import axios from 'axios';
import config from '../config/config.js';

class PythonStrategyService {
  constructor() {
    this.baseUrl = config.pythonCore.baseUrl;
    this.timeout = config.pythonCore.timeout;
    this.retryAttempts = config.pythonCore.retryAttempts;
    this.retryDelay = config.pythonCore.retryDelay;
    this.endpoints = config.pythonCore.endpoints;
    this.isHealthy = true;
    this.lastHealthCheck = null;
    this.healthTimer = null;
    this.loggedUnhealthy = false;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // The Python strategy engine is a separate service that is not always running.
    // Polling it unconditionally floods the logs, so monitoring is opt-in.
    if (config.pythonCore.healthCheckEnabled) {
      this.startHealthCheckMonitoring();
    }
  }

  /**
   * Health Check - Poll Python service status
   */
  async healthCheck() {
    try {
      const response = await this.client.get(this.endpoints.health);
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
    if (this.healthTimer) return;

    this.healthTimer = setInterval(async () => {
      try {
        await this.healthCheck();
        if (this.loggedUnhealthy) {
          console.log('[Python Service] Service is reachable again');
          this.loggedUnhealthy = false;
        }
      } catch (error) {
        // Log the first failure only, then stay quiet until it recovers.
        if (!this.loggedUnhealthy) {
          console.warn(`[Python Service] Unreachable at ${this.baseUrl}: ${error.message}`);
          console.warn('[Python Service] Suppressing further health-check warnings until it recovers.');
          this.loggedUnhealthy = true;
        }
      }
    }, 30000); // Check every 30 seconds

    this.healthTimer.unref?.();
  }

  stopHealthCheckMonitoring() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  /**
   * List Available Strategies
   */
  async listStrategies() {
    try {
      const response = await this.retryRequest(() =>
        this.client.get(this.endpoints.strategies)
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
        this.client.get(this.endpoints.strategyDetail(strategyName))
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
        this.client.post(this.endpoints.signals, params)
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
        this.client.post(this.endpoints.signalsBatch, params)
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to batch generate signals');
    }
  }


  /**
   * Get Available Symbols
   */
  async getAvailableSymbols() {
    try {
      const response = await this.retryRequest(() =>
        this.client.get(this.endpoints.symbols)
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
        this.client.get(this.endpoints.symbolInfo(symbol))
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to get symbol info: ${symbol}`);
    }
  }

  /**
   * Get Stop Loss Presets from Core
   */
  async getSlPresets() {
    try {
      const response = await this.retryRequest(() =>
        this.client.get(this.endpoints.slPresets)
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get SL presets');
    }
  }

  /**
   * Get Full SL Config for a specific preset and timeframe
   */
  async getSlConfig(preset, timeframe) {
    try {
      const response = await this.retryRequest(() =>
        this.client.get(this.endpoints.slConfig(preset), {
          params: { timeframe }
        })
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to get SL config for ${preset}`);
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
