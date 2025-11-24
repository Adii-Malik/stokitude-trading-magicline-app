/**
 * Job Manager
 * 
 * Central orchestrator for all jobs
 * Manages lifecycle, scheduling, and execution
 * Uses Agenda as single source of truth (no separate Job model)
 */

import JobExecution from '../models/JobExecution.js';
import jobTypeRegistry from './jobTypeRegistry.js';
import agendaScheduler from './agendaScheduler.js';
import jobExecutor from './jobExecutor.js';

class JobManager {
  constructor() {
    this.initialized = false;
    this.instanceId = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.io = null; // Socket.IO instance for real-time updates
  }

  /**
   * Set Socket.IO instance for real-time updates
   */
  setSocketIO(io) {
    this.io = io;
    jobExecutor.setSocketIO(io);
  }

  /**
   * Initialize Job Manager
   * - Load job type registry
   * - Define job handlers in Agenda
   * - Agenda manages all job state
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️  Job Manager already initialized');
      return;
    }

    // Check if job scheduler is disabled (useful for local development)
    if (process.env.DISABLE_JOB_SCHEDULER === 'true') {
      console.log('✓ Job scheduler: Disabled (manual mode only)');
      this.initialized = true;
      return;
    }

    try {
      // Step 1: Clean up stale executions from server crash/restart
      const staleExecutions = await JobExecution.updateMany(
        { status: { $in: ['running', 'queued'] } },
        {
          status: 'failed',
          completedAt: new Date(),
          'result.message': 'Job interrupted by server restart',
          'result.error': 'Server stopped while job was running'
        }
      );
      if (staleExecutions.modifiedCount > 0) {
        console.log(`✓ Cleaned up ${staleExecutions.modifiedCount} stale execution(s)`);
      }

      // Step 2: Initialize Agenda
      await agendaScheduler.initialize();

      // Step 3: Initialize job type registry
      await jobTypeRegistry.initialize();

      // Step 4: Define Agenda handlers for all job types
      // This is CRITICAL - Agenda needs handlers defined before it can execute jobs
      await this.defineAgendaHandlers();

      // Step 5: Get stats from Agenda
      const stats = await agendaScheduler.getStats();
      console.log(`✓ Job scheduler: ${stats.enabled} job(s) active`);

      this.initialized = true;

    } catch (error) {
      console.error('✗ Job scheduler initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Define Agenda handlers for all registered job types
   * CRITICAL: Must be called during initialization
   */
  async defineAgendaHandlers() {
    const jobTypes = jobTypeRegistry.getAllJobTypes();

    for (const jobType of jobTypes) {
      // Define handler in Agenda for this job type
      // Agenda will call this when the job is triggered
      agendaScheduler.defineJob(jobType.type, async (jobData) => {
        // Find the job configuration
        const job = await agendaScheduler.getJob(jobData.jobId);
        if (!job) {
          console.error(`❌ Job not found: ${jobData.jobId}`);
          return;
        }

        // Check if job is enabled - if not, skip execution
        if (!job.enabled) {
          console.log(`⏸️  Job '${job.name}' is disabled, skipping execution`);
          return;
        }

        // Execute the job through jobExecutor
        await jobExecutor.executeJob(job, { trigger: 'scheduled' });
      });
    }

    console.log(`✓ Defined ${jobTypes.length} Agenda handler(s)`);
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
      const existingJobs = await agendaScheduler.getJobs({ jobType });
      if (existingJobs.length >= jobTypeDef.constraints.maxInstances) {
        throw new Error(`Maximum ${jobTypeDef.constraints.maxInstances} instance(s) of ${jobTypeDef.name} allowed`);
      }
    }

    // Validate configuration
    jobTypeRegistry.validateJobConfig(jobType, config);

    // Validate schedule
    this.validateSchedule(schedule, jobTypeDef);

    // Create job in Agenda
    const job = await agendaScheduler.createJob({
      jobType,
      name: name || jobTypeDef.name,
      description: description || jobTypeDef.description,
      config,
      schedule,
      enabled: enabled || false,
      createdBy,
      tags: tags || jobTypeDef.tags || []
    });

    console.log(`✓ Job created: ${job.name}`);

    return job;
  }

  /**
   * Update job configuration
   */
  async updateJob(jobId, updates) {
    const job = await agendaScheduler.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const { name, description, config, schedule, tags } = updates;

    // Prepare updates
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;

    // Update config (validate if provided)
    if (config !== undefined) {
      jobTypeRegistry.validateJobConfig(job.jobType, config);
      updateData.config = config;
    }

    // Update schedule
    if (schedule !== undefined) {
      const jobTypeDef = jobTypeRegistry.getJobType(job.jobType);
      this.validateSchedule(schedule, jobTypeDef);
      updateData.schedule = schedule;
    }

    // Update in Agenda
    const updatedJob = await agendaScheduler.updateJob(jobId, updateData);

    console.log(`✓ Job updated: ${updatedJob.name}`);

    return updatedJob;
  }

  /**
   * Delete job
   */
  async deleteJob(jobId) {
    const job = await agendaScheduler.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await agendaScheduler.deleteJob(jobId);

    console.log(`✓ Job deleted: ${job.name}`);
  }

  /**
   * Start job (enable + schedule)
   */
  async startJob(jobId) {
    const job = await agendaScheduler.startJob(jobId);
    console.log(`✓ Job started: ${job.name}`);
    return job;
  }

  /**
   * Stop job (disable + unschedule)
   */
  async stopJob(jobId) {
    const job = await agendaScheduler.stopJob(jobId);
    console.log(`✓ Job stopped: ${job.name}`);
    return job;
  }

  /**
   * Execute job immediately (manual trigger)
   */
  async executeJob(jobId, options = {}) {
    const job = await agendaScheduler.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    console.log(`🚀 Executing job: ${job.name}`);

    return await jobExecutor.executeJob(job, options);
  }

  /**
   * Get job by ID
   */
  async getJob(jobId) {
    return await agendaScheduler.getJob(jobId);
  }

  /**
   * Get job with status details
   */
  async getJobStatus(jobId) {
    const job = await agendaScheduler.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Get recent executions
    const recentExecutions = await JobExecution.find({ jobId })
      .sort({ startedAt: -1 })
      .limit(10)
      .lean();

    return {
      ...job,
      recentExecutions
    };
  }

  /**
   * Get all jobs (with optional filters)
   */
  async getJobs(filter = {}) {
    return await agendaScheduler.getJobs(filter);
  }

  /**
   * Get job statistics
   */
  async getStats() {
    return await agendaScheduler.getStats();
  }

  /**
   * Get recent job executions
   */
  async getRecentExecutions(jobId = null, limit = 10) {
    const query = jobId ? { jobId } : {};

    return await JobExecution.find(query)
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Pause job (keep schedule but mark as paused)
   */
  async pauseJob(jobId) {
    const job = await agendaScheduler.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const updatedJob = await agendaScheduler.updateJob(jobId, {
      enabled: false,
      paused: true
    });

    console.log(`✓ Job paused: ${updatedJob.name}`);
    return updatedJob;
  }

  /**
   * Resume paused job
   */
  async resumeJob(jobId) {
    const job = await agendaScheduler.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const updatedJob = await agendaScheduler.updateJob(jobId, {
      enabled: true,
      paused: false
    });

    console.log(`✓ Job resumed: ${updatedJob.name}`);
    return updatedJob;
  }

  /**
   * Cancel running execution
   */
  async cancelExecution(executionId, reason) {
    return await jobExecutor.cancelExecution(executionId, reason);
  }

  /**
   * Validate job schedule
   */
  validateSchedule(schedule, jobTypeDef) {
    // Validate schedule pattern
    if (schedule.recurring.enabled) {
      const { interval, amount } = schedule.recurring;

      const validIntervals = ['minutes', 'hours', 'days', 'weeks', 'months'];
      if (!validIntervals.includes(interval)) {
        throw new Error(`Invalid interval: ${interval}`);
      }

      if (!amount || amount < 1) {
        throw new Error('Amount must be greater than 0');
      }
    }

    // Check if job type allows recurring
    if (schedule.recurring.enabled && jobTypeDef.constraints?.recurring === false) {
      throw new Error(`Job type ${jobTypeDef.name} does not support recurring schedules`);
    }

    // Check if one-time execution is allowed
    if (!schedule.recurring.enabled && jobTypeDef.constraints?.recurring === 'required') {
      throw new Error(`Job type ${jobTypeDef.name} requires a recurring schedule`);
    }

    return true;
  }

  /**
   * Shutdown job manager gracefully
   */
  async shutdown() {
    console.log('⚠️  Shutting down Job Manager...');
    await agendaScheduler.shutdown();
    console.log('✓ Job Manager shut down');
  }
}

export default new JobManager();
