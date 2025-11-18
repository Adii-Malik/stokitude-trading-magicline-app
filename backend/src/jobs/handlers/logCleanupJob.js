/**
 * Log Cleanup Job Handler
 * 
 * Removes old logs to optimize database storage
 */

import ServiceLog from '../../models/ServiceLog.js';
import JobExecution from '../../models/JobExecution.js';
import Job from '../../models/Job.js';

export default async function logCleanupJob(context) {
  const { logger, config } = context;
  
  const retentionDays = config.retentionDays || 30;
  const batchSize = config.batchSize || 1000;
  const cleanServiceLogs = config.cleanServiceLogs !== false;
  const cleanJobExecutions = config.cleanJobExecutions !== false;

  logger.info('Starting log cleanup...', { 
    retentionDays,
    batchSize,
    cleanServiceLogs,
    cleanJobExecutions
  });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let totalDeleted = 0;
  const summary = {
    serviceLogs: 0,
    jobExecutions: 0,
    errors: []
  };

  try {
    // Clean ServiceLog entries
    if (cleanServiceLogs) {
      logger.info('Cleaning ServiceLog entries...', { cutoffDate });
      
      try {
        const serviceLogResult = await ServiceLog.deleteMany({
          timestamp: { $lt: cutoffDate }
        });
        
        summary.serviceLogs = serviceLogResult.deletedCount || 0;
        totalDeleted += summary.serviceLogs;
        
        logger.info('ServiceLog cleanup completed', { 
          deleted: summary.serviceLogs 
        });
      } catch (error) {
        summary.errors.push(`ServiceLog cleanup failed: ${error.message}`);
        logger.error('ServiceLog cleanup failed', { error: error.message });
      }
    }

    // Clean JobExecution entries (keep last 100 per job)
    if (cleanJobExecutions) {
      logger.info('Cleaning JobExecution entries...', { cutoffDate });
      
      try {
        const jobs = await Job.find({}).select('_id');
        let jobExecutionsDeleted = 0;

        for (const job of jobs) {
          // Get all executions for this job, sorted by newest first
          const executions = await JobExecution.find({ jobId: job._id })
            .sort({ createdAt: -1 })
            .select('_id createdAt');

          // Keep the 100 most recent, delete the rest that are older than retention
          const executionsToDelete = executions.slice(100).filter(exec => 
            exec.createdAt < cutoffDate
          );

          if (executionsToDelete.length > 0) {
            const idsToDelete = executionsToDelete.map(e => e._id);
            const deleteResult = await JobExecution.deleteMany({
              _id: { $in: idsToDelete }
            });
            
            jobExecutionsDeleted += deleteResult.deletedCount || 0;
          }
        }

        summary.jobExecutions = jobExecutionsDeleted;
        totalDeleted += jobExecutionsDeleted;
        
        logger.info('JobExecution cleanup completed', { 
          deleted: summary.jobExecutions 
        });
      } catch (error) {
        summary.errors.push(`JobExecution cleanup failed: ${error.message}`);
        logger.error('JobExecution cleanup failed', { error: error.message });
      }
    }

    const success = summary.errors.length === 0;
    const message = success 
      ? `Cleaned up ${totalDeleted} log entries`
      : `Cleaned up ${totalDeleted} entries with ${summary.errors.length} errors`;

    logger.info('Log cleanup completed', { 
      totalDeleted,
      summary
    });

    return {
      success,
      message,
      metadata: {
        totalDeleted,
        retentionDays,
        cutoffDate,
        ...summary
      }
    };

  } catch (error) {
    logger.error('Log cleanup failed', { 
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      message: `Log cleanup failed: ${error.message}`,
      metadata: {
        error: error.message,
        summary
      }
    };
  }
}

