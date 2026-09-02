import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Job Execution Model
 * 
 * Tracks individual job execution runs with detailed logs and results
 */

const jobExecutionSchema = new mongoose.Schema({
  // Unique execution ID
  executionId: {
    type: String,
    required: true,
    unique: true,
    default: () => `exec_${uuidv4()}`
  },

  // Reference to job (stored as string in Agenda)
  jobId: {
    type: String,
    required: true
  },

  // Denormalized for quick lookup (no joins needed)
  jobType: {
    type: String,
    required: true
  },

  jobName: {
    type: String,
    required: true
  },

  // Execution details
  status: {
    type: String,
    enum: ['queued', 'running', 'success', 'failed', 'cancelled', 'timeout'],
    default: 'queued',
    required: true
  },

  trigger: {
    type: String,
    enum: ['scheduled', 'manual', 'retry', 'dependency'],
    default: 'scheduled',
    required: true
  },

  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'  // For manual triggers
  },

  // Timing
  queuedAt: {
    type: Date,
    default: Date.now
  },

  startedAt: {
    type: Date
  },

  completedAt: {
    type: Date
  },

  duration: {
    type: Number  // milliseconds
  },

  // Logs (structured)
  logs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    level: {
      type: String,
      enum: ['debug', 'info', 'warn', 'error'],
      default: 'info'
    },
    message: {
      type: String,
      required: true
    },
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Results
  result: {
    success: Boolean,
    message: String,
    metadata: mongoose.Schema.Types.Mixed,
    
    // Error details
    error: {
      message: String,
      stack: String,
      code: String
    }
  },

  // Execution context
  config: {
    type: mongoose.Schema.Types.Mixed  // Config used for this execution
  },

  environment: {
    nodeVersion: String,
    platform: String,
    memory: {
      used: Number,
      total: Number
    }
  },

  // Retry tracking
  attemptNumber: {
    type: Number,
    default: 1
  },

  retryOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobExecution'  // Original execution if this is a retry
  },

  // Progress tracking (optional)
  progress: {
    current: Number,
    total: Number,
    percentage: Number,
    message: String
  }
}, {
  timestamps: true
});

/**
 * Four indexes, where there were fifteen.
 *
 * Every query this collection has ever served is here: findOne by executionId,
 * a job's history newest-first, and the unfiltered recent list. Nothing filters
 * by jobType, status, queuedAt or completedAt, and nothing ever has - those
 * columns had an index each because they looked like the sort of thing you
 * index, which is not a reason.
 *
 * It matters more than it used to. Level Watch inserts one document every
 * fifteen minutes, so this collection now takes about a hundred writes a day,
 * and a write pays for every index tree whether or not anything reads it.
 *
 *   executionId    unique, from the field definition - the only lookup key
 *   jobId+createdAt   one job's history, and the cleanup's boundary query
 *   createdAt      the TTL, and it serves an unfiltered sort in either direction
 *
 * Both sorts are on createdAt rather than startedAt on purpose: a queued
 * execution that never started has no startedAt, and sorting the history by a
 * field that can be null puts the failures in an arbitrary place.
 */
jobExecutionSchema.index({ jobId: 1, createdAt: -1 });

// TTL - the floor under everything. Log Cleanup enforces a stricter rule on top
// of it; this is what happens if that job is ever disabled or fails silently.
jobExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Methods
jobExecutionSchema.methods.addLog = function (level, message, metadata = {}) {
  this.logs.push({
    timestamp: new Date(),
    level,
    message,
    metadata
  });
};

jobExecutionSchema.methods.start = function () {
  this.status = 'running';
  this.startedAt = new Date();
};

jobExecutionSchema.methods.complete = function (success, message, metadata = {}) {
  this.status = success ? 'success' : 'failed';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  
  this.result = {
    success,
    message,
    metadata
  };
};

jobExecutionSchema.methods.fail = function (error) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  
  this.result = {
    success: false,
    message: error.message,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code || 'UNKNOWN_ERROR'
    }
  };
};

jobExecutionSchema.methods.timeout = function () {
  this.status = 'timeout';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  
  this.result = {
    success: false,
    message: 'Job execution timed out',
    error: {
      message: 'Job execution timed out',
      code: 'TIMEOUT'
    }
  };
};

jobExecutionSchema.methods.cancel = function (reason) {
  this.status = 'cancelled';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  
  this.result = {
    success: false,
    message: reason || 'Job execution cancelled',
    error: {
      message: reason || 'Job execution cancelled',
      code: 'CANCELLED'
    }
  };
};

jobExecutionSchema.methods.updateProgress = function (current, total, message) {
  this.progress = {
    current,
    total,
    percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    message
  };
};

// Static methods
jobExecutionSchema.statics.getRecentExecutions = function (jobId, limit = 10) {
  return this.find({ jobId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

jobExecutionSchema.statics.getExecutionsByStatus = function (status, limit = 50) {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

jobExecutionSchema.statics.getFailedExecutions = function (jobId, limit = 10) {
  return this.find({ 
    jobId, 
    status: { $in: ['failed', 'timeout'] } 
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

jobExecutionSchema.statics.getRunningExecutions = function () {
  return this.find({ status: 'running' });
};

jobExecutionSchema.statics.getStatistics = async function (jobId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const executions = await this.find({
    jobId,
    createdAt: { $gte: startDate }
  }).lean();

  const stats = {
    total: executions.length,
    success: 0,
    failed: 0,
    timeout: 0,
    cancelled: 0,
    averageDuration: 0,
    successRate: 0
  };

  let totalDuration = 0;
  let durationCount = 0;

  executions.forEach(exec => {
    stats[exec.status] = (stats[exec.status] || 0) + 1;
    
    if (exec.duration) {
      totalDuration += exec.duration;
      durationCount++;
    }
  });

  if (durationCount > 0) {
    stats.averageDuration = Math.round(totalDuration / durationCount);
  }

  if (stats.total > 0) {
    stats.successRate = Math.round((stats.success / stats.total) * 100);
  }

  return stats;
};

export default mongoose.model('JobExecution', jobExecutionSchema);

