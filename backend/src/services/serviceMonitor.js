import ServiceLog from '../models/ServiceLog.js';
import centralizedPriceService from './centralizedPriceService.js';
import tradingViewScheduler from './tradingViewScheduler.js';
import historicalDataScheduler from './historicalDataScheduler.js';
import signalGenerationScheduler from './signalGenerationScheduler.js';
import marketHoursService from './marketHoursService.js';
import Stock from '../models/Stock.js';
import Settings from '../models/Settings.js';

/**
 * Service Monitor
 * Tracks and diagnoses all background services
 */
class ServiceMonitor {
  constructor() {
    this.services = {
      pricePolling: {
        name: 'Price Polling Service',
        description: 'Fetches real-time stock prices from PSX',
        instance: centralizedPriceService,
        checkMethod: 'getStatus'
      },
      tradingViewScheduler: {
        name: 'TradingView Scheduler',
        description: 'Updates OHLCV data daily/weekly/monthly',
        instance: tradingViewScheduler,
        checkMethod: 'getStatus'
      },
      signalGenerationScheduler: {
        name: 'Signal Generation Scheduler',
        description: 'Automated signal generation after market hours',
        instance: signalGenerationScheduler,
        checkMethod: 'getStatus'
      },
      historicalDataScheduler: {
        name: 'Historical Data Scheduler',
        description: 'Daily historical data updates (deprecated)',
        instance: historicalDataScheduler,
        checkMethod: null
      },
      marketHours: {
        name: 'Market Hours Service',
        description: 'Tracks PSX market open/close times',
        instance: marketHoursService,
        checkMethod: 'getMarketStatus'
      }
    };
  }

  /**
   * Log service activity
   */
  async log(serviceName, status, message, metadata = {}, duration = null) {
    try {
      await ServiceLog.create({
        serviceName,
        status,
        message,
        metadata,
        duration,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('❌ Failed to log service activity:', error.message);
    }
  }

  /**
   * Get comprehensive status of all services
   */
  async getSystemStatus() {
    const now = new Date();
    const status = {
      timestamp: now.toISOString(),
      services: {},
      database: {},
      lastActivities: {}
    };

    // Check each service
    for (const [key, service] of Object.entries(this.services)) {
      try {
        let serviceStatus = {
          name: service.name,
          description: service.description,
          status: 'unknown'
        };

        if (service.checkMethod && service.instance) {
          const result = service.instance[service.checkMethod]();
          serviceStatus = { ...serviceStatus, ...result };

          // Add human-readable status
          if (key === 'pricePolling') {
            serviceStatus.status = result.isRunning ? 'running' : 'stopped';
            serviceStatus.currentlyFetching = result.isFetching || false;
            if (result.lastCheckTime) {
              const minutesAgo = Math.floor((Date.now() - result.lastCheckTime) / 60000);
              serviceStatus.lastCheckAgo = `${minutesAgo} minutes ago`;
            }
          } else if (key === 'tradingViewScheduler') {
            serviceStatus.status = result.isRunning ? 'running' : 'stopped';
            serviceStatus.dailyJob = result.dailyJob;
            serviceStatus.weeklyJob = result.weeklyJob;
          } else if (key === 'signalGenerationScheduler') {
            serviceStatus.status = result.isRunning ? 'running' : 'stopped';
            serviceStatus.job = result.job;
            serviceStatus.isGenerating = result.isGenerating || false;
            serviceStatus.schedule = result.schedule;
          } else if (key === 'marketHours') {
            serviceStatus.status = result.isOpen ? 'open' : 'closed';
            serviceStatus.marketStatus = result.status;
            serviceStatus.currentTime = result.currentTime;
            serviceStatus.nextOpen = result.nextOpen;
          }
        } else if (key === 'historicalDataScheduler') {
          serviceStatus.status = service.instance.isRunning ? 'running' : 'stopped';
          serviceStatus.note = 'Deprecated - use TradingView Scheduler';
        }

        status.services[key] = serviceStatus;
      } catch (error) {
        status.services[key] = {
          name: service.name,
          status: 'error',
          error: error.message
        };
      }
    }

    // Check database health
    try {
      const mongoose = (await import('mongoose')).default;
      status.database.connected = mongoose.connection.readyState === 1;

      if (status.database.connected) {
        // Get last price update
        const lastStock = await Stock.findOne({ currentPrice: { $ne: null } })
          .sort({ lastUpdated: -1 })
          .select('lastUpdated symbol currentPrice')
          .lean();

        if (lastStock) {
          status.database.lastPriceUpdate = {
            timestamp: lastStock.lastUpdated,
            symbol: lastStock.symbol,
            price: lastStock.currentPrice,
            ago: `${Math.floor((Date.now() - new Date(lastStock.lastUpdated).getTime()) / 60000)} minutes ago`
          };
        }

        // Get system settings
        const settings = await Settings.getSettings();
        status.database.settings = {
          pollingEnabled: settings.pricePolling.enabled,
          pollingInterval: settings.pricePolling.intervalMinutes,
          lastPriceUpdate: settings.pricePolling.lastPriceUpdate
        };
      }
    } catch (error) {
      status.database.error = error.message;
      status.database.connected = false;
    }

    // Get recent activity from logs (last 7 days, only success/error/warning)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentLogs = await ServiceLog.find({
        timestamp: { $gte: sevenDaysAgo },
        status: { $in: ['success', 'error', 'warning'] } // Skip 'info', 'started', 'stopped', 'skipped'
      })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      // Group by service (max 10 per service)
      const activityByService = {};
      for (const log of recentLogs) {
        if (!activityByService[log.serviceName]) {
          activityByService[log.serviceName] = [];
        }
        if (activityByService[log.serviceName].length < 10) {
          activityByService[log.serviceName].push({
            status: log.status,
            message: log.message,
            timestamp: log.timestamp,
            duration: log.duration
          });
        }
      }

      status.lastActivities = activityByService;
    } catch (error) {
      status.lastActivities.error = error.message;
    }

    return status;
  }

  /**
   * Get service health summary
   */
  async getHealthSummary() {
    const systemStatus = await this.getSystemStatus();

    let healthy = 0;
    let unhealthy = 0;
    let warnings = 0;

    for (const [key, service] of Object.entries(systemStatus.services)) {
      if (service.status === 'running' || service.status === 'open') {
        healthy++;
      } else if (service.status === 'error') {
        unhealthy++;
      } else if (service.status === 'stopped' || service.status === 'closed') {
        warnings++;
      }
    }

    return {
      overall: unhealthy > 0 ? 'unhealthy' : (warnings > 0 ? 'degraded' : 'healthy'),
      healthy,
      unhealthy,
      warnings,
      timestamp: systemStatus.timestamp
    };
  }

  /**
   * Get service logs with filters
   */
  async getLogs(options = {}) {
    const {
      serviceName,
      status,
      limit = 100,
      startDate,
      endDate
    } = options;

    const query = {};

    if (serviceName) query.serviceName = serviceName;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    return await ServiceLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get service statistics
   */
  async getStatistics(serviceName, hours = 24) {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const logs = await ServiceLog.find({
      serviceName,
      timestamp: { $gte: startTime }
    }).lean();

    const stats = {
      serviceName,
      period: `Last ${hours} hours`,
      total: logs.length,
      success: logs.filter(l => l.status === 'success').length,
      errors: logs.filter(l => l.status === 'error').length,
      warnings: logs.filter(l => l.status === 'warning').length,
      averageDuration: null,
      lastExecution: null
    };

    // Calculate average duration
    const durationsLogs = logs.filter(l => l.duration);
    if (durationsLogs.length > 0) {
      const avgMs = durationsLogs.reduce((sum, l) => sum + l.duration, 0) / durationsLogs.length;
      stats.averageDuration = `${(avgMs / 1000).toFixed(2)}s`;
    }

    // Get last execution
    if (logs.length > 0) {
      const lastLog = logs[0];
      stats.lastExecution = {
        timestamp: lastLog.timestamp,
        status: lastLog.status,
        message: lastLog.message,
        duration: lastLog.duration
      };
    }

    return stats;
  }

  /**
   * Diagnose issues
   */
  async diagnose() {
    const issues = [];
    const systemStatus = await this.getSystemStatus();

    // Check if price polling is running when it should be
    if (systemStatus.database.settings?.pollingEnabled) {
      if (systemStatus.services.pricePolling?.status !== 'running') {
        issues.push({
          severity: 'critical',
          service: 'pricePolling',
          issue: 'Price polling is enabled but not running',
          solution: 'Restart the backend server or check logs for errors'
        });
      }

      // Check if last update is too old (during market hours)
      if (systemStatus.services.marketHours?.status === 'open') {
        const lastUpdate = systemStatus.database.lastPriceUpdate;
        if (lastUpdate) {
          const minutesSinceUpdate = Math.floor((Date.now() - new Date(lastUpdate.timestamp).getTime()) / 60000);
          const expectedInterval = systemStatus.database.settings.pollingInterval || 15;

          if (minutesSinceUpdate > expectedInterval * 2) {
            issues.push({
              severity: 'warning',
              service: 'pricePolling',
              issue: `Last price update was ${minutesSinceUpdate} minutes ago (expected: ${expectedInterval} min)`,
              solution: 'Check if PSX website is accessible or check service logs'
            });
          }
        } else {
          issues.push({
            severity: 'warning',
            service: 'pricePolling',
            issue: 'No price data available yet',
            solution: 'Wait for first price fetch or trigger manual refresh'
          });
        }
      }
    }

    // Check TradingView scheduler
    if (systemStatus.services.tradingViewScheduler?.status !== 'running') {
      issues.push({
        severity: 'warning',
        service: 'tradingViewScheduler',
        issue: 'TradingView scheduler is not running',
        solution: 'Daily/weekly OHLCV updates will not occur automatically'
      });
    }

    // Check Signal Generation scheduler
    if (systemStatus.services.signalGenerationScheduler?.status !== 'running') {
      issues.push({
        severity: 'warning',
        service: 'signalGenerationScheduler',
        issue: 'Signal Generation Scheduler is not running',
        solution: 'Automated signals will not be generated after market hours'
      });
    }

    // Check database connection
    if (!systemStatus.database.connected) {
      issues.push({
        severity: 'critical',
        service: 'database',
        issue: 'Database is not connected',
        solution: 'Check MongoDB connection and credentials'
      });
    }

    // Check for recent errors in logs
    const recentErrors = await ServiceLog.find({
      status: 'error',
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    }).limit(10).lean();

    if (recentErrors.length > 0) {
      issues.push({
        severity: 'warning',
        service: 'system',
        issue: `${recentErrors.length} errors in the last hour`,
        solution: 'Check service logs for details',
        recentErrors: recentErrors.map(e => ({
          service: e.serviceName,
          message: e.message,
          timestamp: e.timestamp
        }))
      });
    }

    return {
      timestamp: new Date().toISOString(),
      issuesFound: issues.length,
      issues,
      recommendation: issues.length === 0
        ? 'All services are operating normally'
        : 'Review and address the issues listed above'
    };
  }
}

export default new ServiceMonitor();

