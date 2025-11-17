import { useState, useEffect } from 'react';
import jobsApi from '../../../services/jobs';
import CreateJobModal from './CreateJobModal';
import JobHistory from './JobHistory';

export default function JobsDashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadJobs();
    loadStats();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await jobsApi.getAllJobs();
      setJobs(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load jobs');
      console.error('Error loading jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await jobsApi.getSystemStats();
      setStats(response.data.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleStartJob = async (jobId, jobName) => {
    try {
      await jobsApi.startJob(jobId);
      showToast(`Job "${jobName}" started successfully`, 'success');
      loadJobs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to start job', 'error');
    }
  };

  const handleStopJob = async (jobId, jobName) => {
    try {
      await jobsApi.stopJob(jobId);
      showToast(`Job "${jobName}" stopped successfully`, 'success');
      loadJobs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to stop job', 'error');
    }
  };

  const handleExecuteJob = async (jobId, jobName) => {
    try {
      const response = await jobsApi.executeJob(jobId);
      showToast(`Job "${jobName}" execution started (ID: ${response.data.data.executionId})`, 'success');
      loadJobs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to execute job', 'error');
    }
  };

  const handleDeleteJob = async (jobId, jobName) => {
    if (!window.confirm(`Are you sure you want to delete job "${jobName}"?`)) {
      return;
    }

    try {
      await jobsApi.deleteJob(jobId);
      showToast(`Job "${jobName}" deleted successfully`, 'success');
      loadJobs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete job', 'error');
    }
  };

  const handleViewHistory = (job) => {
    setSelectedJob(job);
    setShowHistory(true);
  };

  const showToast = (message, type) => {
    // Simple toast notification (you can integrate a toast library)
    alert(message);
  };

  const categories = ['all', 'data', 'trading'];

  const filteredJobs = jobs.filter(job => {
    const matchesCategory = selectedCategory === 'all' || job.category === selectedCategory;
    const matchesSearch = job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.typeName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800';
      case 'stopped': return 'bg-gray-100 text-gray-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (date) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Job Management</h1>
          <p className="text-gray-600 mt-1">Manage and monitor all automated jobs</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          + Create Job
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Jobs</div>
            <div className="text-2xl font-bold text-gray-800">{stats.jobs.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Running</div>
            <div className="text-2xl font-bold text-green-600">{stats.jobs.running}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Executions (24h)</div>
            <div className="text-2xl font-bold text-blue-600">{stats.executions.last24h}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Job Types Available</div>
            <div className="text-2xl font-bold text-purple-600">{stats.registry.totalJobTypes}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'data' ? '📊 Data' : '🎯 Trading'}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="🔍 Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-80"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Jobs Grid */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No jobs found</h3>
          <p className="text-gray-600">
            {searchQuery || selectedCategory !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first job to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredJobs.map(job => (
            <div key={job.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              {/* Job Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{job.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{job.name}</h3>
                    <p className="text-sm text-gray-600">{job.typeName}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>

              {/* Job Info */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Schedule:</span>
                  <span className="text-gray-800 font-medium">
                    {job.schedule.recurring?.enabled
                      ? `Every ${job.schedule.recurring.amount} ${job.schedule.recurring.interval}${job.schedule.recurring.time ? ` at ${job.schedule.recurring.time}` : ''}`
                      : 'Manual Only'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Run:</span>
                  <span className="text-gray-800">{getTimeAgo(job.lastRun)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Next Run:</span>
                  <span className="text-gray-800">{job.nextRun ? formatDate(job.nextRun) : 'N/A'}</span>
                </div>
              </div>

              {/* Configuration */}
              {job.config && Object.keys(job.config).length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Configuration:</div>
                  <div className="space-y-1">
                    {Object.entries(job.config).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="text-gray-800 font-medium">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Statistics */}
              <div className="flex gap-4 mb-4 text-sm">
                <div className="flex-1 bg-gray-50 p-2 rounded text-center">
                  <div className="text-gray-600">Total</div>
                  <div className="font-bold text-gray-800">{job.stats.total}</div>
                </div>
                <div className="flex-1 bg-green-50 p-2 rounded text-center">
                  <div className="text-green-600">Success</div>
                  <div className="font-bold text-green-700">{job.stats.success}</div>
                </div>
                <div className="flex-1 bg-red-50 p-2 rounded text-center">
                  <div className="text-red-600">Failed</div>
                  <div className="font-bold text-red-700">{job.stats.failed}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {job.status === 'running' ? (
                  <button
                    onClick={() => handleStopJob(job.id, job.name)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartJob(job.id, job.name)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Start
                  </button>
                )}
                <button
                  onClick={() => handleExecuteJob(job.id, job.name)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Run Now
                </button>
                <button
                  onClick={() => handleViewHistory(job)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  History
                </button>
                <button
                  onClick={() => handleDeleteJob(job.id, job.name)}
                  className="bg-gray-100 hover:bg-gray-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateJobModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadJobs();
          }}
        />
      )}

      {showHistory && selectedJob && (
        <JobHistory
          job={selectedJob}
          onClose={() => {
            setShowHistory(false);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}

