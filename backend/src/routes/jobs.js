import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import jobManager from '../jobs/jobManager.js';
import jobTypeRegistry from '../jobs/jobTypeRegistry.js';
import JobExecution from '../models/JobExecution.js';

const router = express.Router();

/**
 * @route GET /api/jobs/types
 * @desc Get all available job types (for creating new jobs)
 * @access Admin
 */
router.get('/types', authenticate, requireAdmin, async (req, res) => {
  try {
    const jobTypes = jobTypeRegistry.getAllJobTypes();

    res.json({
      success: true,
      data: jobTypes
    });
  } catch (error) {
    console.error('Error getting job types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job types',
      error: error.message
    });
  }
});

/**
 * @route GET /api/jobs/types/:type
 * @desc Get specific job type definition
 * @access Admin
 */
router.get('/types/:type', authenticate, requireAdmin, async (req, res) => {
  try {
    const jobType = jobTypeRegistry.getJobType(req.params.type);

    res.json({
      success: true,
      data: jobType
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/jobs
 * @desc Get all configured jobs
 * @access Admin
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const jobs = await jobManager.getJobs();

    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Error getting jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get jobs',
      error: error.message
    });
  }
});

/**
 * @route GET /api/jobs/:id
 * @desc Get specific job details
 * @access Admin
 */
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const jobStatus = await jobManager.getJobStatus(req.params.id);

    res.json({
      success: true,
      data: jobStatus
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/jobs
 * @desc Create a new job from job type
 * @access Admin
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { jobType, name, description, config, schedule, enabled, tags } = req.body;

    // Validate required fields
    if (!jobType || !config || !schedule) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: jobType, config, schedule'
      });
    }

    const job = await jobManager.createJob({
      jobType,
      name,
      description,
      config,
      schedule,
      enabled: enabled || false,
      createdBy: req.user._id,
      tags
    });

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: job
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route PATCH /api/jobs/:id
 * @desc Update job configuration
 * @access Admin
 */
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { config, schedule, name, description, tags } = req.body;

    const job = await jobManager.updateJob(req.params.id, {
      config,
      schedule,
      name,
      description,
      tags
    });

    res.json({
      success: true,
      message: 'Job updated successfully',
      data: job
    });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/jobs/:id
 * @desc Delete a job
 * @access Admin
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await jobManager.deleteJob(req.params.id);

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/jobs/:id/start
 * @desc Start a job (begin scheduling)
 * @access Admin
 */
router.post('/:id/start', authenticate, requireAdmin, async (req, res) => {
  try {
    const job = await jobManager.startJob(req.params.id);

    res.json({
      success: true,
      message: `Job '${job.name}' started successfully`,
      data: job
    });
  } catch (error) {
    console.error('Error starting job:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/jobs/:id/stop
 * @desc Stop a job (stop scheduling)
 * @access Admin
 */
router.post('/:id/stop', authenticate, requireAdmin, async (req, res) => {
  try {
    const job = await jobManager.stopJob(req.params.id);

    res.json({
      success: true,
      message: `Job '${job.name}' stopped successfully`,
      data: job
    });
  } catch (error) {
    console.error('Error stopping job:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/jobs/:id/pause
 * @desc Pause a job (keep schedule but skip execution)
 * @access Admin
 */
router.post('/:id/pause', authenticate, requireAdmin, async (req, res) => {
  try {
    const job = await jobManager.pauseJob(req.params.id);

    res.json({
      success: true,
      message: `Job '${job.name}' paused successfully`,
      data: job
    });
  } catch (error) {
    console.error('Error pausing job:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/jobs/:id/resume
 * @desc Resume a paused job
 * @access Admin
 */
router.post('/:id/resume', authenticate, requireAdmin, async (req, res) => {
  try {
    const job = await jobManager.resumeJob(req.params.id);

    res.json({
      success: true,
      message: `Job '${job.name}' resumed successfully`,
      data: job
    });
  } catch (error) {
    console.error('Error resuming job:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/jobs/:id/execute
 * @desc Execute a job manually (immediate execution)
 * @access Admin
 */
router.post('/:id/execute', authenticate, requireAdmin, async (req, res) => {
  try {
    const execution = await jobManager.executeJob(req.params.id, { trigger: 'manual', triggeredBy: req.user._id });

    res.json({
      success: true,
      message: 'Job execution started',
      data: {
        executionId: execution.executionId,
        status: execution.status
      }
    });
  } catch (error) {
    console.error('Error executing job:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/jobs/:id/history
 * @desc Get job execution history
 * @access Admin
 */
router.get('/:id/history', authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await jobManager.getRecentExecutions(req.params.id, limit);

    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error getting job history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job history',
      error: error.message
    });
  }
});

/**
 * @route GET /api/jobs/executions/:executionId
 * @desc Get specific execution details
 * @access Admin
 */
router.get('/executions/:executionId', authenticate, requireAdmin, async (req, res) => {
  try {
    const execution = await JobExecution.findOne({ executionId: req.params.executionId }).lean();

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/jobs/executions/:executionId/cancel
 * @desc Cancel a running execution
 * @access Admin
 */
router.post('/executions/:executionId/cancel', authenticate, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    await jobManager.cancelExecution(req.params.executionId, reason || 'Cancelled by user');

    res.json({
      success: true,
      message: 'Execution cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling execution:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/jobs/stats
 * @desc Get system-wide job statistics
 * @access Admin
 */
router.get('/system/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const stats = await jobManager.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system stats',
      error: error.message
    });
  }
});

export default router;

