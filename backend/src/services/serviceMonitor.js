import ServiceLog from '../models/ServiceLog.js';

/**
 * Service Monitor
 *
 * Thin wrapper over the ServiceLog model used by background services to record
 * what they did and how it went (visible in Admin > System).
 *
 * Logging is best-effort by design: a monitoring failure must never break the
 * service being monitored, so every method swallows its own errors.
 */
class ServiceMonitor {
  /**
   * Record a service event.
   * @param {string} serviceName - Must match the ServiceLog enum
   * @param {string} status - success | error | warning | info | started | stopped | skipped
   * @param {string} message - Human-readable summary
   * @param {object} [metadata] - Arbitrary structured detail
   * @param {number} [duration] - Elapsed time in ms
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
      // Never let logging break the caller.
      console.error(`⚠️ ServiceMonitor could not log ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Most recent log entries, newest first.
   */
  async getRecentLogs(serviceName = null, limit = 50) {
    try {
      const query = serviceName ? { serviceName } : {};
      return await ServiceLog.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error(`⚠️ ServiceMonitor could not read logs: ${error.message}`);
      return [];
    }
  }

  /**
   * Latest entry for a single service, or null.
   */
  async getLastRun(serviceName) {
    try {
      return await ServiceLog.findOne({ serviceName })
        .sort({ timestamp: -1 })
        .lean();
    } catch (error) {
      console.error(`⚠️ ServiceMonitor could not read last run: ${error.message}`);
      return null;
    }
  }
}

export default new ServiceMonitor();
