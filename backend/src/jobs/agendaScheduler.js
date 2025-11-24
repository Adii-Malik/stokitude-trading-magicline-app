/**
 * Agenda-based Job Scheduler
 * 
 * Replaces node-cron with Agenda for persistent, crash-resistant job scheduling
 */

import Agenda from 'agenda';
import config from '../config/config.js';

class AgendaScheduler {
  constructor() {
    this.agenda = null;
    this.initialized = false;
  }

  /**
   * Initialize Agenda with MongoDB connection
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    this.agenda = new Agenda({
      db: {
        address: config.mongoUri,
        collection: 'agendaJobs',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true
        }
      },
      processEvery: '30 seconds', // How often to check for jobs to run
      maxConcurrency: 5, // Max jobs running at once
      defaultConcurrency: 1, // Default concurrency per job type
      lockLimit: 0, // No limit on locks
      defaultLockLimit: 0,
      defaultLockLifetime: 10 * 60 * 1000, // 10 minutes
      disableAutoUpdate: true, // Don't auto-update job properties from DB
    });

    // Handle graceful shutdown
    const graceful = async () => {
      await this.agenda.stop();
      process.exit(0);
    };

    process.on('SIGTERM', graceful);
    process.on('SIGINT', graceful);

    await this.agenda.start();

    this.initialized = true;
  }

  /**
   * Define a job handler in Agenda
   */
  defineJob(jobName, handler) {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    this.agenda.define(jobName, { concurrency: 1 }, async (job) => {
      // job.attrs.data contains the job context
      await handler(job.attrs.data);
    });
  }

  /**
   * Schedule a recurring job
   * @param {string} jobId - Unique job ID
   * @param {string} jobType - Job type (matches handler name)
   * @param {object} schedule - Schedule configuration
   * @param {object} data - Job data
   */
  async scheduleRecurring(jobId, jobType, schedule, data = {}) {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    // Cancel existing jobs with same jobId
    await this.agenda.cancel({ 'data.jobId': jobId });

    // Create cron expression from schedule config
    const cronExpression = this.buildCronExpression(schedule);

    // Schedule the job using jobType as name to match handler
    const agendaJob = await this.agenda.create(jobType, { ...data, jobId });
    agendaJob.repeatEvery(cronExpression, {
      timezone: schedule.timezone || 'Asia/Karachi',
      skipImmediate: true // Don't run immediately on schedule
    });
    await agendaJob.save();

    return agendaJob;
  }

  /**
   * Build cron expression from universal schedule config
   */
  buildCronExpression(schedule) {
    const { amount, interval, time, daysOfWeek } = schedule.recurring;

    // For minute/hour intervals
    if (interval === 'minutes') {
      return `*/${amount} * * * *`;
    }

    if (interval === 'hours') {
      const minute = time ? time.split(':')[1] : '0';
      return `${minute} */${amount} * * *`;
    }

    // For day/week/month intervals with specific time
    if (time) {
      const [hour, minute] = time.split(':');

      if (interval === 'days') {
        if (daysOfWeek && daysOfWeek.length > 0) {
          // Daily but only on specific days
          return `${minute} ${hour} * * ${daysOfWeek.join(',')}`;
        }
        return `${minute} ${hour} */${amount} * *`;
      }

      if (interval === 'weeks') {
        const days = daysOfWeek && daysOfWeek.length > 0 ? daysOfWeek.join(',') : '*';
        return `${minute} ${hour} * * ${days}`;
      }

      if (interval === 'months') {
        return `${minute} ${hour} 1 */${amount} *`;
      }
    }

    // Fallback
    return `0 0 * * *`; // Daily at midnight
  }

  /**
   * Run a job immediately (manual execution)
   * @param {string} jobType - The job type to run
   * @param {object} data - Job data including jobId
   */
  async runNow(jobType, data = {}) {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    const job = await this.agenda.now(jobType, data);
    return job;
  }

  /**
   * Cancel/unschedule a job
   */
  async cancelJob(jobId) {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    const removed = await this.agenda.cancel({ 'data.jobId': jobId });
    console.log(`   🗑️  Canceled ${removed} Agenda job(s) for jobId: ${jobId}`);
    return removed;
  }

  /**
   * Calculate next run time for a job
   */
  calculateNextRun(schedule) {
    if (!schedule.recurring.enabled) {
      return null;
    }

    const cronExpression = this.buildCronExpression(schedule);

    // Use Agenda's internal logic to calculate next run
    // For display purposes, we'll use a simple calculation
    const { amount, interval, time } = schedule.recurring;
    const now = new Date();
    const next = new Date(now);

    switch (interval) {
      case 'minutes':
        next.setMinutes(next.getMinutes() + amount);
        break;
      case 'hours':
        next.setHours(next.getHours() + amount);
        break;
      case 'days':
        if (time) {
          const [h, m] = time.split(':');
          next.setHours(parseInt(h), parseInt(m), 0, 0);
          if (next <= now) {
            next.setDate(next.getDate() + amount);
          }
        } else {
          next.setDate(next.getDate() + amount);
        }
        break;
      case 'weeks':
        if (time) {
          const [h, m] = time.split(':');
          next.setHours(parseInt(h), parseInt(m), 0, 0);
          if (next <= now) {
            next.setDate(next.getDate() + (7 * amount));
          }
        } else {
          next.setDate(next.getDate() + (7 * amount));
        }
        break;
      case 'months':
        if (time) {
          const [h, m] = time.split(':');
          next.setHours(parseInt(h), parseInt(m), 0, 0);
          next.setDate(1);
          if (next <= now) {
            next.setMonth(next.getMonth() + amount);
          }
        } else {
          next.setMonth(next.getMonth() + amount);
        }
        break;
    }

    return next;
  }

  /**
   * Create a new job
   */
  async createJob(jobData) {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    const { jobType, name, description, config, schedule, enabled, createdBy, tags } = jobData;

    // Generate unique job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store all metadata in data field
    const data = {
      jobId,
      jobType,
      name,
      description,
      config,
      schedule,
      enabled,
      createdBy,
      tags,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // CRITICAL: Use jobType as the Agenda job name so it matches the defined handler
    // Store jobId in data for tracking
    const agendaJob = this.agenda.create(jobType, data);

    // Only schedule if enabled AND recurring
    // Manual jobs are stored but NOT scheduled
    if (enabled && schedule.recurring.enabled) {
      const cronExpression = this.buildCronExpression(schedule);
      agendaJob.repeatEvery(cronExpression, {
        timezone: schedule.timezone || 'Asia/Karachi',
        skipImmediate: true // CRITICAL: Never run immediately on creation/save
      });
    }

    // Save the job
    await agendaJob.save();

    return {
      _id: agendaJob.attrs._id,
      ...data,
      nextScheduledRun: agendaJob.attrs.nextRunAt,
      lastRun: agendaJob.attrs.lastRunAt,
      status: enabled && schedule.recurring.enabled ? 'running' : 'stopped'
    };
  }

  /**
   * Update an existing job
   */
  async updateJob(jobId, updates) {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    // Find the job
    const jobs = await this.agenda.jobs({ 'data.jobId': jobId });
    if (jobs.length === 0) {
      throw new Error('Job not found');
    }

    const job = jobs[0];
    const currentData = job.attrs.data;

    // Merge updates
    const updatedData = {
      ...currentData,
      ...updates,
      updatedAt: new Date()
    };

    // If schedule or enabled changed, need to reschedule
    if (updates.schedule || updates.enabled !== undefined) {
      // Cancel old schedule first
      await this.agenda.cancel({ 'data.jobId': jobId });

      // Always create a new Agenda job to preserve the job data
      // Use jobType as name to match handler
      const newJob = this.agenda.create(updatedData.jobType, updatedData);

      // Only add scheduling if BOTH enabled AND recurring are true
      if (updatedData.enabled && updatedData.schedule.recurring.enabled) {
        const cronExpression = this.buildCronExpression(updatedData.schedule);
        newJob.repeatEvery(cronExpression, {
          timezone: updatedData.schedule.timezone || 'Asia/Karachi',
          skipImmediate: true
        });
      }

      // Save the job (without schedule if disabled/manual-only)
      await newJob.save();

      // CRITICAL: After save, if disabled, directly update MongoDB to clear nextRunAt
      // This is needed because Agenda might set it during save
      if (!updatedData.enabled || !updatedData.schedule.recurring.enabled) {
        const mongoose = await import('mongoose');
        const ObjectId = mongoose.default.Types.ObjectId;

        await mongoose.default.connection.db.collection('agendaJobs').updateOne(
          { 'data.jobId': jobId },  // Use jobId instead of _id to avoid BSON issues
          { $set: { nextRunAt: null }, $unset: { repeatInterval: '' } }
        );
        // Update the in-memory object too
        newJob.attrs.nextRunAt = null;
        newJob.attrs.repeatInterval = null;
      }

      return {
        _id: newJob.attrs._id,
        ...updatedData,
        nextScheduledRun: newJob.attrs.nextRunAt,
        lastRun: newJob.attrs.lastRunAt,
        status: updatedData.enabled && updatedData.schedule.recurring.enabled ? 'running' : 'stopped'
      };
    }

    // Just update data
    job.attrs.data = updatedData;
    await job.save();

    return {
      _id: job.attrs._id,
      ...updatedData,
      nextScheduledRun: job.attrs.nextRunAt,
      lastRun: job.attrs.lastRunAt,
      status: updatedData.enabled ? 'running' : 'stopped'
    };
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId) {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    const removed = await this.agenda.cancel({ 'data.jobId': jobId });
    return removed > 0;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId) {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    const jobs = await this.agenda.jobs({ 'data.jobId': jobId });
    if (jobs.length === 0) {
      return null;
    }

    const job = jobs[0];
    return {
      _id: job.attrs._id,
      ...job.attrs.data,
      nextScheduledRun: job.attrs.nextRunAt,
      lastRun: job.attrs.lastRunAt,
      status: job.attrs.data.enabled ? 'running' : 'stopped'
    };
  }

  /**
   * Get all jobs with optional filters
   */
  async getJobs(filter = {}) {
    if (!this.agenda) {
      throw new Error('Agenda not initialized');
    }

    // Build Agenda query
    const query = {};

    if (filter.jobType) {
      query.name = filter.jobType;
    }

    if (filter.enabled !== undefined) {
      query['data.enabled'] = filter.enabled;
    }

    if (filter.tags) {
      query['data.tags'] = { $in: filter.tags };
    }

    // Force fetch from database (not cache)
    const jobs = await this.agenda.jobs(query, { _id: -1 });

    return jobs.map(job => {
      const data = job.attrs.data || {};
      const isScheduled = data.enabled && data.schedule?.recurring?.enabled;
      return {
        _id: job.attrs._id,
        jobId: data.jobId || job.attrs._id.toString(),
        jobType: data.jobType || job.attrs.name,
        name: data.name || job.attrs.name,
        description: data.description || '',
        config: data.config || {},
        schedule: data.schedule || {},
        enabled: data.enabled || false,
        createdBy: data.createdBy,
        tags: data.tags || [],
        createdAt: data.createdAt || job.attrs.lastModifiedDate,
        updatedAt: data.updatedAt || job.attrs.lastModifiedDate,
        nextScheduledRun: job.attrs.nextRunAt,
        lastRun: job.attrs.lastRunAt,
        status: isScheduled ? 'running' : 'stopped'
      };
    });
  }

  /**
   * Start a job (enable + schedule)
   */
  async startJob(jobId) {
    return await this.updateJob(jobId, { enabled: true });
  }

  /**
   * Stop a job (disable + unschedule)
   */
  async stopJob(jobId) {
    return await this.updateJob(jobId, { enabled: false });
  }

  /**
   * Get job stats
   */
  async getStats() {
    if (!this.agenda) {
      return {
        jobs: { total: 0, running: 0, stopped: 0, paused: 0 },
        executions: { total: 0, success: 0, failed: 0 }
      };
    }

    const jobs = await this.agenda.jobs({});
    const running = jobs.filter(j => j.attrs.data?.enabled === true).length;
    const stopped = jobs.filter(j => j.attrs.data?.enabled === false).length;

    return {
      jobs: {
        total: jobs.length,
        running: running,
        stopped: stopped,
        paused: 0
      },
      executions: {
        total: 0,
        success: 0,
        failed: 0
      },
      enabled: running
    };
  }

  /**
   * Shutdown Agenda gracefully
   */
  async shutdown() {
    if (this.agenda) {
      await this.agenda.stop();
    }
  }
}

export default new AgendaScheduler();

