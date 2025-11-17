/**
 * Jobs API Service
 * 
 * Frontend API client for Job Management System
 */

import api from './api';

export const jobsApi = {
  // Job Types
  getJobTypes: () => api.get('/jobs/types'),
  getJobType: (type) => api.get(`/jobs/types/${type}`),

  // Jobs
  getAllJobs: () => api.get('/jobs'),
  getJob: (id) => api.get(`/jobs/${id}`),
  createJob: (data) => api.post('/jobs', data),
  updateJob: (id, data) => api.patch(`/jobs/${id}`, data),
  deleteJob: (id) => api.delete(`/jobs/${id}`),

  // Job Control
  startJob: (id) => api.post(`/jobs/${id}/start`),
  stopJob: (id) => api.post(`/jobs/${id}/stop`),
  pauseJob: (id) => api.post(`/jobs/${id}/pause`),
  resumeJob: (id) => api.post(`/jobs/${id}/resume`),
  executeJob: (id) => api.post(`/jobs/${id}/execute`),

  // Execution History
  getJobHistory: (id, limit = 50) => api.get(`/jobs/${id}/history?limit=${limit}`),
  getExecution: (executionId) => api.get(`/jobs/executions/${executionId}`),
  cancelExecution: (executionId, reason) => api.post(`/jobs/executions/${executionId}/cancel`, { reason }),

  // Statistics
  getSystemStats: () => api.get('/jobs/system/stats')
};

export default jobsApi;

