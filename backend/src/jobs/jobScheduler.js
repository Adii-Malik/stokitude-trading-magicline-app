/**
 * Job Scheduler
 * 
 * Manages scheduling logic for jobs (Universal Pattern - Recurring & Once)
 */

import cron from 'node-cron';

class JobScheduler {
  constructor() {
    this.scheduledJobs = new Map();  // jobId -> { job, task }
  }

  /**
   * Schedule a job based on its configuration
   */
  scheduleJob(job, executeCallback) {
    // Unschedule if already scheduled
    this.unscheduleJob(job._id.toString());

    const jobIdStr = job._id.toString();

    // Check if recurring is enabled
    if (!job.schedule.recurring.enabled) {
      console.log(`   ⏸️  Job ${job.name} is manual only (recurring disabled)`);
      return;  // Manual trigger only
    }

    // Schedule recurring job
    const task = this.scheduleRecurring(job, executeCallback);

    if (task) {
      this.scheduledJobs.set(jobIdStr, { job, task });
      console.log(`   ✓ Scheduled job: ${job.name} (recurring)`);
    }
  }

  /**
   * Schedule recurring job (Universal Pattern)
   * Supports: minutes, hours, days, weeks, months with day selection
   */
  scheduleRecurring(job, executeCallback) {
    const { amount, interval, daysOfWeek, time } = job.schedule.recurring;
    const timezone = job.schedule.timezone || 'Asia/Karachi';

    // Convert to cron expression
    const cronExpression = this.convertToCron(amount, interval, daysOfWeek, time);

    if (!cronExpression) {
      console.error(`   ✗ Could not create schedule for job ${job.name}`);
      return null;
    }

    console.log(`   ℹ️  Cron expression: ${cronExpression}`);

    const cronTask = cron.schedule(
      cronExpression,
      () => {
        // Check if still within date range (if specified)
        if (job.schedule.recurring.endDate && new Date() > new Date(job.schedule.recurring.endDate)) {
          console.log(`   ⏸️  Job ${job.name} reached end date, stopping...`);
          this.unscheduleJob(job._id.toString());
          return;
        }

        executeCallback(job);
      },
      {
        scheduled: true,
        timezone
      }
    );

    return {
      type: 'recurring',
      cronTask,
      stop: () => cronTask.stop()
    };
  }


  /**
   * Convert recurring schedule to cron expression
   */
  convertToCron(amount, interval, daysOfWeek, time) {
    let minute = '*';
    let hour = '*';
    let dayOfMonth = '*';
    let month = '*';
    let dayOfWeek = '*';

    // Parse time if specified (HH:MM format)
    if (time) {
      const [h, m] = time.split(':');
      hour = h;
      minute = m;
    }

    // Convert daysOfWeek array to cron format
    if (daysOfWeek && daysOfWeek.length > 0) {
      dayOfWeek = daysOfWeek.sort().join(',');
    }

    // Handle different intervals
    switch (interval) {
      case 'minutes':
        if (amount === 1) {
          minute = '*';
        } else {
          minute = `*/${amount}`;
        }
        hour = '*';
        break;

      case 'hours':
        if (time) {
          minute = time.split(':')[1];
        } else {
          minute = '0';
        }
        if (amount === 1) {
          hour = '*';
        } else {
          hour = `*/${amount}`;
        }
        break;

      case 'days':
        if (amount === 1) {
          // Daily - already handled by time and daysOfWeek
        } else {
          // Every N days (not directly supported by cron, use dayOfMonth approximation)
          dayOfMonth = `*/${amount}`;
        }
        break;

      case 'weeks':
        // Weekly - handled by daysOfWeek
        // amount for weeks: 1 = weekly, 2 = bi-weekly (hard to express in cron)
        if (amount > 1) {
          console.warn(`   ⚠️  Multi-week intervals (${amount}) may not work perfectly with cron`);
        }
        break;

      case 'months':
        if (amount === 1) {
          dayOfMonth = '1';  // First day of month
        } else {
          month = `*/${amount}`;
          dayOfMonth = '1';
        }
        break;
    }

    return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  }

  /**
   * Unschedule a job
   */
  unscheduleJob(jobId) {
    const scheduled = this.scheduledJobs.get(jobId);
    
    if (scheduled) {
      scheduled.task.stop();
      this.scheduledJobs.delete(jobId);
      console.log(`   ✓ Unscheduled job: ${scheduled.job.name}`);
    }
  }

  /**
   * Reschedule a job (unschedule then schedule again)
   */
  rescheduleJob(job, executeCallback) {
    this.unscheduleJob(job._id.toString());
    this.scheduleJob(job, executeCallback);
  }

  /**
   * Unschedule all jobs
   */
  unscheduleAll() {
    this.scheduledJobs.forEach((scheduled, jobId) => {
      scheduled.task.stop();
    });
    this.scheduledJobs.clear();
    console.log('   ✓ Unscheduled all jobs');
  }

  /**
   * Get scheduled job info
   */
  getScheduledJob(jobId) {
    return this.scheduledJobs.get(jobId);
  }

  /**
   * Check if job is scheduled
   */
  isScheduled(jobId) {
    return this.scheduledJobs.has(jobId);
  }

  /**
   * Get all scheduled jobs
   */
  getAllScheduled() {
    return Array.from(this.scheduledJobs.entries()).map(([jobId, scheduled]) => ({
      jobId,
      jobName: scheduled.job.name,
      scheduleType: scheduled.task.type
    }));
  }

  /**
   * Calculate next scheduled run time
   */
  calculateNextRun(job) {
    // If recurring is disabled, no next run (manual only)
    if (!job.schedule.recurring.enabled) {
      return null;
    }

    const { amount, interval, time } = job.schedule.recurring;
    const now = new Date();

    // Simple calculation (more accurate calculation would need cron parser)
    let nextRun = new Date(now);

    switch (interval) {
      case 'minutes':
        nextRun.setMinutes(nextRun.getMinutes() + amount);
        break;
      case 'hours':
        nextRun.setHours(nextRun.getHours() + amount);
        break;
      case 'days':
        nextRun.setDate(nextRun.getDate() + amount);
        if (time) {
          const [h, m] = time.split(':');
          nextRun.setHours(parseInt(h), parseInt(m), 0, 0);
        }
        break;
      case 'weeks':
        nextRun.setDate(nextRun.getDate() + (amount * 7));
        if (time) {
          const [h, m] = time.split(':');
          nextRun.setHours(parseInt(h), parseInt(m), 0, 0);
        }
        break;
      case 'months':
        nextRun.setMonth(nextRun.getMonth() + amount);
        if (time) {
          const [h, m] = time.split(':');
          nextRun.setHours(parseInt(h), parseInt(m), 0, 0);
        }
        break;
    }

    return nextRun;
  }

  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      totalScheduled: this.scheduledJobs.size,
      byType: {
        interval: 0,
        cron: 0
      }
    };

    this.scheduledJobs.forEach(scheduled => {
      stats.byType[scheduled.task.type]++;
    });

    return stats;
  }
}

export default new JobScheduler();

