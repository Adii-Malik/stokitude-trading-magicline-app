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

  // Reference to job
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },

  // Denormalized for quick lookup (no joins needed)
  jobType: {
    type: String,
    required: true,
    index: true
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
    required: true,
    index: true
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
    default: Date.now,
    index: true
  },

  startedAt: {
    type: Date,
    index: true
  },

  completedAt: {
    type: Date,
    index: true
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

// Indexes for performance
jobExecutionSchema.index({ jobId: 1, createdAt: -1 });
jobExecutionSchema.index({ jobType: 1, createdAt: -1 });
jobExecutionSchema.index({ status: 1, createdAt: -1 });
// executionId index already created by "unique: true" on field definition
jobExecutionSchema.index({ queuedAt: -1 });
jobExecutionSchema.index({ startedAt: -1 });
jobExecutionSchema.index({ completedAt: -1 });

// TTL index - auto-delete executions older than 90 days (keep longer than ServiceLog)
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

