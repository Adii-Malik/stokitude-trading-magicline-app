import mongoose from 'mongoose';

/**
 * Job Model
 * 
 * Represents a configured job instance (created from a job type)
 * Users configure these via the admin UI
 */

const jobSchema = new mongoose.Schema({
  // Reference to job type
  jobType: {
    type: String,
    required: true,
    index: true
  },

  // User-provided configuration
  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    trim: true
  },

  // Job status
  enabled: {
    type: Boolean,
    default: false,
    index: true
  },

  status: {
    type: String,
    enum: ['stopped', 'running', 'paused', 'error'],
    default: 'stopped',
    index: true
  },

  // User-configured parameters (from jobType.parameters)
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // User-configured schedule (Universal Pattern - SFCC Style)
  schedule: {
    // Recurring settings (enabled = auto-schedule, disabled = manual only)
    recurring: {
      enabled: {
        type: Boolean,
        default: true  // true = auto-recurring, false = manual only (Run Now button)
      },
      amount: {
        type: Number,
        min: 1,
        default: 1
      },
      interval: {
        type: String,
        enum: ['minutes', 'hours', 'days', 'weeks', 'months'],
        default: 'days'
      },
      daysOfWeek: {
        type: [Number],  // [0-6] where 0=Sunday, 1=Monday, etc. Empty = all days
        default: []
      },
      time: {
        type: String,    // HH:MM format (24-hour). null = any time
        default: null
      },
      startDate: Date,   // Optional: start from specific date
      endDate: Date      // Optional: end at specific date
    },
    
    // Common settings
    timezone: {
      type: String,
      default: 'Asia/Karachi'
    },
    
    respectMarketHours: {
      type: Boolean,
      default: false
    }
  },

  // Runtime state
  lastExecutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobExecution'
  },

  lastExecutionTime: {
    type: Date,
    index: true
  },

  lastExecutionStatus: {
    type: String,
    enum: ['success', 'failed', 'timeout', 'cancelled']
  },

  nextScheduledRun: {
    type: Date,
    index: true
  },

  // Statistics
  totalExecutions: {
    type: Number,
    default: 0
  },

  successCount: {
    type: Number,
    default: 0
  },

  failureCount: {
    type: Number,
    default: 0
  },

  averageDuration: {
    type: Number,  // milliseconds
    default: 0
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  tags: [String]
}, {
  timestamps: true
});

// Indexes for performance
jobSchema.index({ jobType: 1, enabled: 1 });
jobSchema.index({ status: 1, enabled: 1 });
jobSchema.index({ enabled: 1, nextScheduledRun: 1 });
jobSchema.index({ createdAt: -1 });

// Virtual for execution history
jobSchema.virtual('executions', {
  ref: 'JobExecution',
  localField: '_id',
  foreignField: 'jobId'
});

// Methods
jobSchema.methods.updateStats = async function(execution) {
  this.totalExecutions += 1;
  
  if (execution.status === 'success') {
    this.successCount += 1;
  } else if (execution.status === 'failed' || execution.status === 'timeout') {
    this.failureCount += 1;
  }

  // Update average duration (rolling average)
  if (execution.duration) {
    if (this.averageDuration === 0) {
      this.averageDuration = execution.duration;
    } else {
      // Exponential moving average (weight recent executions more)
      this.averageDuration = Math.round(
        this.averageDuration * 0.8 + execution.duration * 0.2
      );
    }
  }

  this.lastExecutionId = execution._id;
  this.lastExecutionTime = execution.completedAt || execution.startedAt;
  this.lastExecutionStatus = execution.status;

  await this.save();
};

// Static methods
jobSchema.statics.getActiveJobs = function() {
  return this.find({ enabled: true, status: 'running' });
};

jobSchema.statics.getJobsByType = function(jobType) {
  return this.find({ jobType }).sort({ createdAt: -1 });
};

jobSchema.statics.getJobsDueForExecution = function() {
  const now = new Date();
  return this.find({
    enabled: true,
    status: 'running',
    'schedule.type': { $ne: 'manual' },
    nextScheduledRun: { $lte: now }
  });
};

export default mongoose.model('Job', jobSchema);

