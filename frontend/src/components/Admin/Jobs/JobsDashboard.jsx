import { useState, useEffect } from 'react';
import jobsApi from '../../../services/jobs';
import CreateJobModal from './CreateJobModal';
import JobHistory from './JobHistory';
import { ContentLoader } from '../../common';

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
      // Map jobId to id for frontend compatibility and add icons
      const jobsData = (response.data.data || []).map(job => ({
        ...job,
        id: job.jobId,
        icon: getJobIcon(job.jobType)
      }));
      setJobs(jobsData);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load jobs');
      console.error('Error loading jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getJobIcon = (jobType) => {
    const iconMap = {
      'price_polling': '💰',
      'tradingview_update': '📈',
      'signal_generation': '🎯',
      'historical_data': '📊',
      'log_cleanup': '🧹'
    };
    return iconMap[jobType] || '⚙️';
  };

  const loadStats = async () => {
    try {
      const response = await jobsApi.getSystemStats();
      setStats(response.data.data || { jobs: { total: 0, running: 0, stopped: 0 }, executions: { total: 0 } });
    } catch (err) {
      console.error('Error loading stats:', err);
      setStats({ jobs: { total: 0, running: 0, stopped: 0 }, executions: { total: 0 } });
    }
  };

  const handleStartJob = async (jobId, jobName) => {
    try {
      await jobsApi.startJob(jobId);
      showToast(`Job "${jobName}" started successfully`, 'success');
      await Promise.all([loadJobs(), loadStats()]);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to start job', 'error');
    }
  };

  const handleStopJob = async (jobId, jobName) => {
    try {
      await jobsApi.stopJob(jobId);
      showToast(`Job "${jobName}" stopped successfully`, 'success');
      await Promise.all([loadJobs(), loadStats()]);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to stop job', 'error');
    }
  };

  const handleExecuteJob = async (jobId, jobName) => {
    try {
      const response = await jobsApi.executeJob(jobId);
      showToast(`Job "${jobName}" execution started (ID: ${response.data.data.executionId})`, 'success');
      await loadJobs();
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
      await Promise.all([loadJobs(), loadStats()]);
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

  const categories = ['all', 'data', 'trading', 'maintenance'];

  const filteredJobs = jobs.filter(job => {
    // Get category from job config (need to fetch from job type)
    // Since we don't have category in job response, derive from tags or jobType
    let jobCategory = 'data'; // default
    if (job.tags && job.tags.length > 0) {
      // Map tags to categories
      if (job.tags.includes('maintenance') || job.tags.includes('cleanup')) {
        jobCategory = 'maintenance';
      } else if (job.tags.includes('signals') || job.tags.includes('strategies')) {
        jobCategory = 'trading';
      } else {
        jobCategory = 'data';
      }
    }
    const matchesCategory = selectedCategory === 'all' || jobCategory === selectedCategory;

    // Search match
    const jobName = job.name || '';
    const jobType = job.jobType || '';
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      jobName.toLowerCase().includes(searchLower) ||
      jobType.toLowerCase().includes(searchLower);

    return matchesCategory && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800';
      case 'stopped': return 'bg-surface-muted text-ink';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-surface-muted text-ink';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
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

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ink">Job Management</h1>
          <p className="text-ink-muted mt-1">Manage and monitor all automated jobs</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-control font-medium transition-colors"
        >
          + Create Job
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface p-4 rounded-control shadow">
            <div className="text-sm text-ink-muted">Total Jobs</div>
            <div className="text-2xl font-bold text-ink">{stats.jobs?.total || 0}</div>
          </div>
          <div className="bg-surface p-4 rounded-control shadow">
            <div className="text-sm text-ink-muted">Running</div>
            <div className="text-2xl font-bold text-green-600">{stats.jobs?.running || 0}</div>
          </div>
          <div className="bg-surface p-4 rounded-control shadow">
            <div className="text-sm text-ink-muted">Executions (24h)</div>
            <div className="text-2xl font-bold text-blue-600">{stats.executions?.last24h || stats.executions?.total || 0}</div>
          </div>
          <div className="bg-surface p-4 rounded-control shadow">
            <div className="text-sm text-ink-muted">Stopped</div>
            <div className="text-2xl font-bold text-ink-muted">{stats.jobs?.stopped || 0}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-surface p-4 rounded-control shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-control font-medium whitespace-nowrap transition-colors ${selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-muted text-ink hover:bg-hairline'
                  }`}
              >
                {cat === 'all' ? 'All' : cat === 'data' ? '📊 Data' : cat === 'trading' ? '🎯 Trading' : '🧹 Maintenance'}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="🔍 Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-hairline rounded-control focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-80"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-control mb-6">
          {error}
        </div>
      )}

      {/* Jobs Grid */}
      {loading ? (
        <div className="bg-surface rounded-control shadow">
          <ContentLoader message="Loading jobs..." />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-control shadow">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-ink-muted mb-2">No jobs found</h3>
          <p className="text-ink-muted">
            {searchQuery || selectedCategory !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first job to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredJobs.map(job => (
            <div key={job.id} className="bg-surface rounded-control shadow-card-hover p-6 hover:shadow-card-hover transition-shadow">
              {/* Job Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{job.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold text-ink">{job.name}</h3>
                    <p className="text-sm text-ink-muted">{job.description || job.jobType}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>

              {/* Job Info */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Schedule:</span>
                  <span className="text-ink font-medium">
                    {job.schedule.recurring?.enabled
                      ? `Every ${job.schedule.recurring.amount === 1 ? '' : job.schedule.recurring.amount + ' '}${job.schedule.recurring.amount === 1 ? job.schedule.recurring.interval.replace(/s$/, '') : job.schedule.recurring.interval}${job.schedule.recurring.time ? ` at ${formatTime12Hour(job.schedule.recurring.time)}` : ''}`
                      : 'Manual Only'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Last Run:</span>
                  <span className="text-ink">{getTimeAgo(job.lastRun)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Next Run:</span>
                  <span className="text-ink">{job.nextScheduledRun ? formatDate(job.nextScheduledRun) : 'N/A'}</span>
                </div>
              </div>

              {/* Configuration */}
              {job.config && Object.keys(job.config).length > 0 && (
                <div className="mb-4 p-3 bg-surface-muted rounded border border-hairline">
                  <div className="text-xs font-semibold text-ink-muted mb-2">Configuration:</div>
                  <div className="space-y-1">
                    {Object.entries(job.config).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-ink-muted capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="text-ink font-medium">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {/* Only show Start/Stop for recurring jobs */}
                {job.schedule?.recurring?.enabled && (
                  <>
                    {job.status === 'running' ? (
                      <button
                        onClick={() => handleStopJob(job.id, job.name)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-control text-sm font-medium transition-colors"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartJob(job.id, job.name)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-control text-sm font-medium transition-colors"
                      >
                        Start
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => handleExecuteJob(job.id, job.name)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-control text-sm font-medium transition-colors"
                >
                  Run Now
                </button>
                <button
                  onClick={() => handleViewHistory(job)}
                  className="bg-surface-muted hover:bg-hairline text-ink px-4 py-2 rounded-control text-sm font-medium transition-colors"
                >
                  History
                </button>
                <button
                  onClick={() => handleDeleteJob(job.id, job.name)}
                  className="bg-surface-muted hover:bg-hairline text-red-600 px-4 py-2 rounded-control text-sm font-medium transition-colors"
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

