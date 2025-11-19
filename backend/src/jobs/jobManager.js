/**
 * Job Manager
 * 
 * Central orchestrator for all jobs
 * Manages lifecycle, scheduling, and execution
 */

import Job from '../models/Job.js';
import JobExecution from '../models/JobExecution.js';
import jobTypeRegistry from './jobTypeRegistry.js';
import jobScheduler from './jobScheduler.js';
import jobExecutor from './jobExecutor.js';

class JobManager {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize Job Manager
   * - Load job type registry
   * - Load jobs from database
   * - Start enabled jobs
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️  Job Manager already initialized');
      return;
    }

    console.log('\n🚀 Initializing Job Management System...\n');

    try {
      // Step 1: Initialize job type registry
      await jobTypeRegistry.initialize();

      // Step 2: Load jobs from database
      const jobs = await Job.find({ enabled: true });
      console.log(`\n📋 Found ${jobs.length} enabled job(s) in database`);

      // Step 3: Start each enabled job
      for (const job of jobs) {
        try {
          await this.startJob(job._id.toString(), false); // false = don't save (already enabled)
        } catch (error) {
          console.error(`   ✗ Failed to start job ${job.name}:`, error.message);
        }
      }

      this.initialized = true;
      console.log('\n✅ Job Management System initialized successfully\n');
      
      // Log stats
      this.logStats();

    } catch (error) {
      console.error('❌ Failed to initialize Job Manager:', error);
      throw error;
    }
  }

  /**
   * Register a new job type (for dynamic registration)
   */
  registerJobType(jobTypeDefinition) {
    jobTypeRegistry.register(jobTypeDefinition);
  }

  /**
   * Create a new job instance from job type
   */
  async createJob(data) {
    const { jobType, name, description, config, schedule, enabled, createdBy, tags } = data;

    // Validate job type exists
    if (!jobTypeRegistry.hasJobType(jobType)) {
      throw new Error(`Job type not found: ${jobType}`);
    }

    const jobTypeDef = jobTypeRegistry.getJobType(jobType);

    // Check constraints (e.g., maxInstances)
    if (jobTypeDef.constraints?.maxInstances) {
      const existingCount = await Job.countDocuments({ jobType });
      if (existingCount >= jobTypeDef.constraints.maxInstances) {
        throw new Error(`Maximum ${jobTypeDef.constraints.maxInstances} instance(s) of ${jobTypeDef.name} allowed`);
      }
    }

    // Validate configuration
    jobTypeRegistry.validateJobConfig(jobType, config);

    // Validate schedule
    this.validateSchedule(schedule, jobTypeDef);

    // Calculate next run
    const job = new Job({
      jobType,
      name: name || jobTypeDef.name,
      description: description || jobTypeDef.description,
      config,
      schedule,
      enabled: enabled || false,
      status: 'stopped',
      createdBy,
      tags: tags || jobTypeDef.tags || []
    });

    job.nextScheduledRun = jobScheduler.calculateNextRun(job);

    await job.save();

    console.log(`✅ Created job: ${job.name} (${job.jobType})`);

    // Start if enabled
    if (job.enabled) {
      await this.startJob(job._id.toString(), false);
    }

    return job;
  }

  /**
   * Update job configuration
   */
  async updateJob(jobId, updates) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const { config, schedule, name, description, tags } = updates;

    // Validate new config if provided
    if (config) {
      jobTypeRegistry.validateJobConfig(job.jobType, config);
      job.config = config;
    }

    // Validate new schedule if provided
    if (schedule) {
      const jobTypeDef = jobTypeRegistry.getJobType(job.jobType);
      this.validateSchedule(schedule, jobTypeDef);
      job.schedule = schedule;
      job.nextScheduledRun = jobScheduler.calculateNextRun(job);
    }

    if (name) job.name = name;
    if (description) job.description = description;
    if (tags) job.tags = tags;

    await job.save();

    // Reschedule if running
    if (job.status === 'running') {
      jobScheduler.rescheduleJob(job, (j) => this.executeJob(j._id.toString(), { trigger: 'scheduled' }));
    }

    console.log(`✅ Updated job: ${job.name}`);

    return job;
  }

  /**
   * Delete job
   */
  async deleteJob(jobId) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Stop if running
    if (job.status === 'running') {
      await this.stopJob(jobId);
    }

    await Job.findByIdAndDelete(jobId);

    console.log(`✅ Deleted job: ${job.name}`);
  }

  /**
   * Start job (begin scheduling)
   */
  async startJob(jobId, save = true) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status === 'running') {
      throw new Error('Job is already running');
    }

    // Update status
    job.status = 'running';
    job.enabled = true;
    job.nextScheduledRun = jobScheduler.calculateNextRun(job);
    
    if (save) {
      await job.save();
    }

    // Schedule job
    jobScheduler.scheduleJob(job, (j) => this.executeJob(j._id.toString(), { trigger: 'scheduled' }));

    console.log(`✅ Started job: ${job.name}`);
    if (job.nextScheduledRun) {
      console.log(`   Next run: ${job.nextScheduledRun.toLocaleString('en-US', { timeZone: job.schedule.timezone || 'Asia/Karachi' })}`);
    }

    return job;
  }

  /**
   * Stop job (stop scheduling)
   */
  async stopJob(jobId) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status === 'stopped') {
      throw new Error('Job is already stopped');
    }

    // Unschedule
    jobScheduler.unscheduleJob(jobId);

    // Update status
    job.status = 'stopped';
    job.enabled = false;
    job.nextScheduledRun = null;
    await job.save();

    console.log(`✅ Stopped job: ${job.name}`);

    return job;
  }

  /**
   * Pause job (keep schedule but skip execution)
   */
  async pauseJob(jobId) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    job.status = 'paused';
    await job.save();

    console.log(`⏸️  Paused job: ${job.name}`);

    return job;
  }

  /**
   * Resume job (from paused state)
   */
  async resumeJob(jobId) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'paused') {
      throw new Error('Job is not paused');
    }

    job.status = 'running';
    await job.save();

    console.log(`▶️  Resumed job: ${job.name}`);

    return job;
  }

  /**
   * Execute job manually (immediate execution)
   */
  async executeJob(jobId, options = {}) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Check if paused
    if (job.status === 'paused') {
      console.log(`⏸️  Job ${job.name} is paused, skipping execution`);
      return null;
    }

    // Execute
    const execution = await jobExecutor.executeJob(job, options);

    // Update next run time
    job.nextScheduledRun = jobScheduler.calculateNextRun(job);
    await job.save();

    return execution;
  }

  /**
   * Execute job now (force manual execution)
   */
  async executeJobNow(jobId, triggeredBy = null) {
    return await this.executeJob(jobId, {
      trigger: 'manual',
      triggeredBy
    });
  }

  /**
   * Cancel running execution
   */
  async cancelExecution(executionId, reason) {
    await jobExecutor.cancelExecution(executionId, reason);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const jobTypeDef = jobTypeRegistry.getJobType(job.jobType);

    return {
      job: {
        id: job._id,
        name: job.name,
        type: job.jobType,
        typeName: jobTypeDef.name,
        status: job.status,
        enabled: job.enabled,
        schedule: job.schedule,
        config: job.config,
        nextRun: job.nextScheduledRun,
        lastRun: job.lastExecutionTime,
        lastStatus: job.lastExecutionStatus
      },
      isScheduled: jobScheduler.isScheduled(job._id.toString()),
      stats: {
        total: job.totalExecutions,
        success: job.successCount,
        failed: job.failureCount,
        successRate: job.totalExecutions > 0 
          ? Math.round((job.successCount / job.totalExecutions) * 100) 
          : 0,
        avgDuration: job.averageDuration
      }
    };
  }

  /**
   * Get all jobs
   */
  async getAllJobs() {
    const jobs = await Job.find().sort({ createdAt: -1 });
    
    return jobs.map(job => {
      const jobTypeDef = jobTypeRegistry.getJobType(job.jobType);
      
      return {
        id: job._id,
        name: job.name,
        type: job.jobType,
        typeName: jobTypeDef.name,
        category: jobTypeDef.category,
        icon: jobTypeDef.icon,
        status: job.status,
        enabled: job.enabled,
        config: job.config,
        schedule: job.schedule,
        nextRun: job.nextScheduledRun,
        lastRun: job.lastExecutionTime,
        lastStatus: job.lastExecutionStatus,
        stats: {
          total: job.totalExecutions,
          success: job.successCount,
          failed: job.failureCount
        }
      };
    });
  }

  /**
   * Get job execution history
   */
  async getJobHistory(jobId, limit = 50) {
    const executions = await JobExecution.find({ jobId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return executions;
  }

  /**
   * Get specific execution details
   */
  async getExecution(executionId) {
    const execution = await JobExecution.findOne({ executionId }).lean();
    if (!execution) {
      throw new Error('Execution not found');
    }
    return execution;
  }

  /**
   * Validate schedule against job type
   */
  validateSchedule(schedule, jobTypeDef) {
    // Validate universal schedule pattern
    if (schedule.recurring) {
      const { amount, interval } = schedule.recurring;
      
      if (schedule.recurring.enabled) {
        if (!amount || amount < 1) {
          throw new Error('Recurring amount must be >= 1');
        }
        
        const validIntervals = ['minutes', 'hours', 'days', 'weeks', 'months'];
        if (!validIntervals.includes(interval)) {
          throw new Error(`Invalid interval: ${interval}. Must be one of: ${validIntervals.join(', ')}`);
        }
        
        // Validate days of week if provided
        if (schedule.recurring.daysOfWeek && schedule.recurring.daysOfWeek.length > 0) {
          const invalidDays = schedule.recurring.daysOfWeek.filter(d => d < 0 || d > 6);
          if (invalidDays.length > 0) {
            throw new Error('Days of week must be 0-6 (0=Sunday, 6=Saturday)');
          }
        }
        
        // Validate time format if provided
        if (schedule.recurring.time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.recurring.time)) {
          throw new Error('Time must be in HH:MM format (24-hour)');
        }
      }
    }
  }

  /**
   * Shutdown - stop all jobs
   */
  async shutdown() {
    console.log('\n🛑 Shutting down Job Manager...');
    
    jobScheduler.unscheduleAll();
    
    // Cancel running executions
    const runningExecutions = jobExecutor.getRunningExecutions();
    for (const executionId of runningExecutions) {
      try {
        await jobExecutor.cancelExecution(executionId, 'System shutdown');
      } catch (error) {
        console.error(`Failed to cancel execution ${executionId}:`, error.message);
      }
    }

    this.initialized = false;
    console.log('✅ Job Manager shut down\n');
  }

  /**
   * Log statistics
   */
  logStats() {
    const registryStats = jobTypeRegistry.getStats();
    const schedulerStats = jobScheduler.getStats();
    const executorStats = jobExecutor.getStats();

    console.log('📊 Job Management System Statistics:');
    console.log(`   • Job Types: ${registryStats.totalJobTypes}`);
    console.log(`   • Loaded Handlers: ${registryStats.loadedHandlers}`);
    console.log(`   • Scheduled Jobs: ${schedulerStats.totalScheduled} (${schedulerStats.byType.interval} interval, ${schedulerStats.byType.cron} cron)`);
    console.log(`   • Running Executions: ${executorStats.runningExecutions}`);
    console.log('');
  }

  /**
   * Get system statistics
   */
  async getSystemStats() {
    const totalJobs = await Job.countDocuments();
    const enabledJobs = await Job.countDocuments({ enabled: true });
    const runningJobs = await Job.countDocuments({ status: 'running' });
    
    const totalExecutions = await JobExecution.countDocuments();
    const recentExecutions = await JobExecution.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    return {
      jobs: {
        total: totalJobs,
        enabled: enabledJobs,
        running: runningJobs,
        stopped: totalJobs - runningJobs
      },
      executions: {
        total: totalExecutions,
        last24h: recentExecutions,
        running: jobExecutor.getRunningExecutions().length
      },
      registry: jobTypeRegistry.getStats(),
      scheduler: jobScheduler.getStats()
    };
  }
}

export default new JobManager();

