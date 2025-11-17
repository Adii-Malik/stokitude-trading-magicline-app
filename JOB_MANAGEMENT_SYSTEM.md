# Job Management System

## Overview

Centralized system for managing all automated tasks (price polling, data updates, signal generation) with a unified scheduling interface, similar to Salesforce Commerce Cloud Jobs.

## Core Concept

**Problem Solved:**
- Scattered service scheduling (each service had its own timing logic)
- No central place to monitor/configure automation
- Manual trigger limitations
- Inconsistent schedule patterns

**Solution:**
- Universal Job Management System
- All services → Job Handlers (pure business logic)
- All scheduling → Job Scheduler (one place)
- All monitoring → Job Dashboard (single UI)

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                  Job Management System               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Job Manager  │→ │ Job Scheduler│→ │ Job       │ │
│  │ (Orchestrator│  │ (Timing)     │  │ Executor  │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         ↓                                     ↓      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Job Registry │  │ Job Models   │  │ Job       │ │
│  │ (Definitions)│  │ (Database)   │  │ Handlers  │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Key Files

**Backend:**
- `backend/src/jobs/jobManager.js` - Main orchestrator
- `backend/src/jobs/jobScheduler.js` - Converts schedules to cron
- `backend/src/jobs/jobExecutor.js` - Runs job handlers
- `backend/src/jobs/jobTypeRegistry.js` - Discovers available job types
- `backend/src/models/Job.js` - Job configuration storage
- `backend/src/models/JobExecution.js` - Execution history
- `backend/src/jobs/types/*.js` - Job type definitions
- `backend/src/jobs/handlers/*.js` - Business logic (wrapped services)
- `backend/src/routes/jobs.js` - API endpoints

**Frontend:**
- `frontend/src/components/Jobs/JobsDashboard.jsx` - Main interface
- `frontend/src/components/Jobs/CreateJobModal.jsx` - Create/configure jobs
- `frontend/src/components/Jobs/JobHistory.jsx` - View execution logs
- `frontend/src/services/jobs.js` - API client

## Universal Schedule Pattern (SFCC-Style)

Every job uses the same flexible scheduling:

### Recurring Schedule
```
┌─────────────────────────────────────────┐
│ ☑ Enable Automatic Recurrence           │
│                                          │
│ Run Every: [15] [minutes ▼]             │
│                                          │
│ Run Only On These Days:                 │
│ [Mon] [Tue] [Wed] [Thu] [Fri] Sat  Sun │
│                                          │
│ At Specific Time: [17:00] (optional)    │
│                                          │
│ Summary: Runs every 15 minutes on       │
│ selected days                            │
└─────────────────────────────────────────┘
```

**Options:**
- **Amount:** 1, 2, 3, ... (any number)
- **Interval:** Minutes, Hours, Days, Weeks, Months
- **Days of Week:** Mon-Sun (empty = all days)
- **Time:** HH:MM in 24-hour format (optional)

### Manual Only
```
┌─────────────────────────────────────────┐
│ ☐ Enable Automatic Recurrence           │
│                                          │
│ 👆 Manual Trigger Only                  │
│ This job will NOT run automatically.    │
│ Use the "Run Now" button to execute it  │
│ manually whenever needed.                │
└─────────────────────────────────────────┘
```

## Job Types

### 1. Price Polling Service
- **Category:** Data
- **Purpose:** Fetches real-time stock prices from PSX
- **Schedule Example:** Every 15 minutes, Mon-Fri
- **Respects:** Market hours

### 2. TradingView Data Update
- **Category:** Data
- **Purpose:** Updates OHLCV data for any timeframe(s) - daily, weekly, monthly
- **Configuration:** Select timeframes (multiselect), set lookback period
- **Schedule Example:** Every 1 day at 17:00, Mon-Fri (for daily), or Every 1 week on Saturday (for weekly/monthly)
- **Flexibility:** Users can create multiple job instances with different timeframe combinations

### 3. Signal Generation
- **Category:** Trading
- **Purpose:** Generates trading signals for active strategies
- **Schedule Example:** Every 1 day at 17:30, Mon-Sat
- **Respects:** After data updates

### 4. Historical Data Update (Deprecated)
- **Category:** Data
- **Purpose:** Legacy historical data updates
- **Recommendation:** Use TradingView jobs instead

## Database Schema

### Job Document
```javascript
{
  jobType: 'price_polling',
  name: 'Price Polling Service',
  description: 'Fetches real-time stock prices...',
  enabled: true,
  
  config: {
    // Job-specific business parameters
    skipMarketCheck: false,
    batchSize: 50
  },
  
  schedule: {
    recurring: {
      enabled: true,      // false = manual only
      amount: 15,
      interval: 'minutes',
      daysOfWeek: [1,2,3,4,5],  // Mon-Fri
      time: null          // Any time
    },
    timezone: 'Asia/Karachi',
    respectMarketHours: true
  },
  
  status: 'running',
  lastRun: Date,
  nextRun: Date,
  lastExecutionId: ObjectId
}
```

### JobExecution Document
```javascript
{
  executionId: 'uuid',
  jobId: ObjectId,
  status: 'running|completed|failed',
  
  startedAt: Date,
  completedAt: Date,
  duration: Number,
  
  logs: [
    {
      level: 'info|warn|error',
      message: 'Processing started...',
      timestamp: Date,
      metadata: {}
    }
  ],
  
  result: {
    success: true,
    message: 'Processed 50 symbols',
    metadata: {}
  }
}
```

## API Endpoints

```
GET    /api/jobs/types           - List available job types
GET    /api/jobs                 - List all jobs
GET    /api/jobs/:id             - Get job details
POST   /api/jobs                 - Create new job
PUT    /api/jobs/:id             - Update job
DELETE /api/jobs/:id             - Delete job
POST   /api/jobs/:id/start       - Enable job
POST   /api/jobs/:id/stop        - Disable job
POST   /api/jobs/:id/execute     - Manual trigger (Run Now)
GET    /api/jobs/:id/history     - Execution history
GET    /api/jobs/stats           - System statistics
```

## Frontend Features

### Jobs Dashboard
- Filter by category (Data, Trading)
- Search by name
- View job status (Running, Stopped, Error)
- Quick actions (Run Now, Enable, Disable, Delete)
- Real-time status updates

### Create Job Modal
- **Step 1:** Select job type from registry
- **Step 2:** Configure parameters + schedule
- Live schedule summary
- Validation

### Job History
- View execution logs
- Filter by status (Success, Failed)
- Detailed log viewer
- Duration and metadata

## Migration from Old Services

### Before (Old Way)
```
✗ Price Polling: setInterval in service
✗ TradingView: cron.schedule in scheduler
✗ Signals: cron.schedule in scheduler
✗ Each service: Own timing logic
✗ Settings: intervalMinutes, enabled flags
✗ Manual triggers: Scattered implementation
```

### After (New Way)
```
✓ All Services: Job Handlers (no timing)
✓ All Scheduling: Job Scheduler (centralized)
✓ All Configuration: Job Dashboard UI
✓ Manual Triggers: "Run Now" button (universal)
✓ Monitoring: Job Execution History
```

## Benefits

1. **Centralized Control**
   - One place for all automation
   - Consistent UI/UX
   - Easy to add new jobs

2. **Flexible Scheduling**
   - Universal pattern (minutes to months)
   - Day selection (Mon-Sun)
   - Time specification
   - Manual trigger always available

3. **Complete Monitoring**
   - Execution history
   - Detailed logs
   - Success/failure tracking
   - Duration metrics

4. **Developer Friendly**
   - Add new job = Create handler + Define type
   - No timing logic in services
   - Automatic scheduling
   - Built-in retry/timeout

5. **Production Ready**
   - Job enable/disable
   - Manual override
   - Error handling
   - Graceful shutdown

## Adding a New Job

1. **Create Handler** (`backend/src/jobs/handlers/myJob.js`)
   - Export async function
   - Receives context (logger, config, progress)
   - Return { success, message, metadata }

2. **Define Type** (`backend/src/jobs/types/myJobType.js`)
   - Specify name, description, category, icon
   - Define parameters (for GUI configuration)
   - Set default schedule options
   - Configure execution settings (timeout, retry)

3. **Register** (automatic)
   - JobTypeRegistry auto-discovers all types
   - No manual registration needed

4. **Seed** (`backend/src/jobs/seedJobs.js`) (optional)
   - Add default instance for migration
   - Runs once on startup

5. **Frontend** (automatic)
   - Job type appears in "Create Job" modal
   - Parameters render as form fields
   - Schedule UI is universal

## Key Design Decisions

1. **Services = Pure Logic**
   - No `start()`, `stop()`, `setInterval`, `cron.schedule`
   - Only business logic methods
   - Called by job handlers

2. **Handlers = Thin Wrappers**
   - Connect Job System ↔ Service
   - Handle execution context
   - Transform results

3. **Schedule = Always Same**
   - No job-specific schedule UI
   - No "interval vs cron" confusion
   - One universal pattern

4. **Configuration ≠ Scheduling**
   - Job config = Business parameters
   - Job schedule = Timing/recurrence
   - Clean separation

5. **Manual Always Available**
   - "Run Now" button on every job
   - Works even if recurring is disabled
   - Bypasses schedule, respects config

## Current Status

✅ **Complete Implementation**
- Job Management System fully functional
- All legacy services migrated to jobs
- Universal schedule pattern implemented
- Frontend UI complete
- Backend routes and handlers ready
- Database models and execution logging
- Service Monitor removed (replaced by Jobs)
- Settings page cleaned (only Market Hours remain)

✅ **Services Converted**
- Price Polling Service → Job Handler
- TradingView Updates → Job Handlers (daily + weekly)
- Signal Generation → Job Handler
- Historical Data → Job Handler (deprecated)

✅ **Clean Codebase**
- No manual `setInterval` in services
- No manual `cron.schedule` in services
- No service-specific scheduling code
- All timing centralized in Job System

## Future Enhancements

- Job dependencies (run job B after job A completes)
- Job chains/workflows
- Conditional execution (if-then rules)
- Job templates (clone existing jobs)
- Bulk operations (enable/disable multiple)
- Advanced filters (by status, last run, etc.)
- Email/SMS notifications on failure
- Job metrics dashboard (success rates, avg duration)

---

**Last Updated:** November 17, 2024
**Status:** Production Ready ✅

