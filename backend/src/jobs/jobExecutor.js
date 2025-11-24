/**
 * Job Executor
 * 
 * Handles actual job execution with isolation, logging, and error handling
 */

import JobExecution from '../models/JobExecution.js';
import jobTypeRegistry from './jobTypeRegistry.js';

class JobExecutor {
  constructor() {
    this.runningExecutions = new Map();  // executionId -> { execution, timeout }
  }

  /**
   * Execute a job
   */
  async executeJob(job, options = {}) {
    const { trigger = 'scheduled', triggeredBy = null, attemptNumber = 1 } = options;

    // Create execution record
    const execution = await JobExecution.create({
      jobId: job.jobId || job._id,
      jobType: job.jobType,
      jobName: job.name,
      status: 'queued',
      trigger,
      triggeredBy,
      attemptNumber,
      config: job.config,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      }
    });

    const executionId = execution.executionId;

    // Add to running executions
    this.runningExecutions.set(executionId, { execution });

    // Start execution in background
    this.runExecution(execution, job).catch(error => {
      console.error(`❌ Fatal error in job execution ${executionId}:`, error);
    });

    return execution;
  }

  /**
   * Run execution (main logic)
   */
  async runExecution(execution, job) {
    const executionId = execution.executionId;

    try {
      // Get job type definition
      const jobTypeDef = jobTypeRegistry.getJobType(job.jobType);

      // Get handler
      const handler = jobTypeRegistry.getHandler(job.jobType);
      if (!handler) {
        throw new Error(`Handler not found for job type: ${job.jobType}`);
      }

      // Start execution
      execution.start();
      await execution.save();

      console.log(`\n🚀 [${new Date().toISOString()}] Executing job: ${job.name}`);
      execution.addLog('info', `Job execution started (${execution.trigger})`);

      // Set timeout
      const timeout = jobTypeDef.execution.timeout;
      const timeoutHandle = setTimeout(async () => {
        await this.timeoutExecution(executionId);
      }, timeout);

      this.runningExecutions.get(executionId).timeout = timeoutHandle;

      // Create execution context
      const context = this.createExecutionContext(execution, job);

      // Execute handler
      const result = await handler(context);

      // Clear timeout
      clearTimeout(timeoutHandle);

      // Reload execution to get latest state (with all logs)
      const currentExecution = await JobExecution.findOne({ executionId });
      if (currentExecution.status === 'timeout' || currentExecution.status === 'cancelled') {
        console.log(`⚠️  Job ${job.name} was ${currentExecution.status}`);
        return;
      }

      // Update with completion data
      currentExecution.complete(result.success, result.message, result.metadata);
      currentExecution.addLog(result.success ? 'info' : 'error', result.message, result.metadata);
      await currentExecution.save();

      console.log(`${result.success ? '✅' : '❌'} Job ${job.name} completed: ${result.message}`);
      console.log(`   Duration: ${(currentExecution.duration / 1000).toFixed(2)}s`);


      // Remove from running executions
      this.runningExecutions.delete(executionId);

      // Retry if failed and retry enabled
      if (!result.success && jobTypeDef.execution.retryEnabled && attemptNumber < jobTypeDef.execution.maxRetries) {
        await this.scheduleRetry(job, execution, jobTypeDef, attemptNumber);
      }

    } catch (error) {
      console.error(`❌ Job ${job.name} failed with error:`, error.message);

      // Reload execution to get latest state
      const currentExecution = await JobExecution.findOne({ executionId });

      // Fail execution
      currentExecution.fail(error);
      await currentExecution.save();

      // Remove from running executions
      this.runningExecutions.delete(executionId);

      // Retry if retry enabled
      const jobTypeDef = jobTypeRegistry.getJobType(job.jobType);
      if (jobTypeDef.execution.retryEnabled && currentExecution.attemptNumber < jobTypeDef.execution.maxRetries) {
        await this.scheduleRetry(job, currentExecution, jobTypeDef, currentExecution.attemptNumber);
      }
    }
  }

  /**
   * Create execution context for handler
   */
  createExecutionContext(execution, job) {
    return {
      // Execution metadata
      executionId: execution.executionId,
      jobId: job._id.toString(),
      jobType: job.jobType,
      jobName: job.name,
      attemptNumber: execution.attemptNumber,

      // Configuration
      config: job.config,

      // Logger
      logger: {
        debug: (message, metadata) => this.log(execution, 'debug', message, metadata),
        info: (message, metadata) => this.log(execution, 'info', message, metadata),
        warn: (message, metadata) => this.log(execution, 'warn', message, metadata),
        error: (message, metadata) => this.log(execution, 'error', message, metadata)
      },

      // Progress updater
      updateProgress: async (current, total, message) => {
        try {
          const currentExecution = await JobExecution.findOne({ executionId: execution.executionId });
          if (currentExecution) {
            currentExecution.updateProgress(current, total, message);
            await currentExecution.save();
          }
        } catch (err) {
          console.error('Error updating progress:', err.message);
        }
      },

      // Data access (can inject services here)
      services: {
        // Add service references if needed
      }
    };
  }

  /**
   * Log to execution
   */
  async log(execution, level, message, metadata = {}) {
    execution.addLog(level, message, metadata);

    // Don't save immediately - will be saved at checkpoints
    // This prevents parallel save errors

    // Also console log
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`   ${prefix} ${message}`);
  }

  /**
   * Timeout execution
   */
  async timeoutExecution(executionId) {
    const running = this.runningExecutions.get(executionId);
    if (!running) return;

    const execution = await JobExecution.findOne({ executionId });
    if (!execution || execution.status !== 'running') return;

    console.log(`⏱️  Job execution ${executionId} timed out`);

    execution.timeout();
    await execution.save();


    this.runningExecutions.delete(executionId);
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId, reason = 'Cancelled by user') {
    const running = this.runningExecutions.get(executionId);
    if (!running) {
      throw new Error('Execution not found or not running');
    }

    // Clear timeout
    if (running.timeout) {
      clearTimeout(running.timeout);
    }

    const execution = await JobExecution.findOne({ executionId });
    if (!execution) {
      throw new Error('Execution record not found');
    }

    execution.cancel(reason);
    await execution.save();

    console.log(`🛑 Job execution ${executionId} cancelled: ${reason}`);


    this.runningExecutions.delete(executionId);
  }

  /**
   * Schedule retry
   */
  async scheduleRetry(job, execution, jobTypeDef, previousAttempt) {
    const nextAttempt = previousAttempt + 1;
    const retryConfig = jobTypeDef.execution;

    let delayMs = retryConfig.retryDelayMinutes * 60 * 1000;

    // Apply retry strategy
    if (retryConfig.retryStrategy === 'exponential') {
      delayMs = delayMs * Math.pow(2, previousAttempt - 1);
    }

    console.log(`🔄 Scheduling retry ${nextAttempt}/${retryConfig.maxRetries} in ${delayMs / 1000}s...`);

    setTimeout(async () => {
      console.log(`🔄 Retrying job: ${job.name} (attempt ${nextAttempt})`);
      await this.executeJob(job, {
        trigger: 'retry',
        attemptNumber: nextAttempt
      });
    }, delayMs);
  }

  /**
   * Get running executions
   */
  getRunningExecutions() {
    return Array.from(this.runningExecutions.keys());
  }

  /**
   * Check if execution is running
   */
  isRunning(executionId) {
    return this.runningExecutions.has(executionId);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      runningExecutions: this.runningExecutions.size
    };
  }
}

export default new JobExecutor();

