import { useState, useEffect } from 'react';
import jobsApi from '../../services/jobs';

export default function JobHistory({ job, onClose }) {
  const [executions, setExecutions] = useState([]);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadHistory();
  }, [job.id]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await jobsApi.getJobHistory(job.id, 100);
      setExecutions(response.data.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load execution history');
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutionDetails = async (executionId) => {
    try {
      const response = await jobsApi.getExecution(executionId);
      setSelectedExecution(response.data.data);
    } catch (err) {
      console.error('Error loading execution details:', err);
    }
  };

  const handleRetry = async (execution) => {
    try {
      await jobsApi.executeJob(job.id);
      alert('Job execution started');
      loadHistory();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to retry job');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'running': return '🔄';
      case 'timeout': return '⏱️';
      case 'cancelled': return '🛑';
      case 'queued': return '⏳';
      default: return '❓';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'running': return 'text-blue-600 bg-blue-50';
      case 'timeout': return 'text-orange-600 bg-orange-50';
      case 'cancelled': return 'text-gray-600 bg-gray-50';
      case 'queued': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTriggerBadge = (trigger) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      manual: 'bg-purple-100 text-purple-800',
      retry: 'bg-orange-100 text-orange-800',
      dependency: 'bg-green-100 text-green-800'
    };
    return colors[trigger] || 'bg-gray-100 text-gray-800';
  };

  const filteredExecutions = executions.filter(exec => {
    if (filter === 'all') return true;
    return exec.status === filter;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Execution History</h2>
            <p className="text-sm text-gray-600 mt-1">
              {job.icon} {job.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="border-b border-gray-200 px-6 py-3">
          <div className="flex gap-2 overflow-x-auto">
            {['all', 'success', 'failed', 'running', 'timeout', 'cancelled'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Execution List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="text-lg">Loading history...</div>
              </div>
            ) : error ? (
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              </div>
            ) : filteredExecutions.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No executions found</h3>
                <p className="text-gray-600">
                  {filter !== 'all' ? 'Try adjusting your filter' : 'This job has not been executed yet'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredExecutions.map(exec => (
                  <div
                    key={exec._id}
                    onClick={() => loadExecutionDetails(exec.executionId)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedExecution?.executionId === exec.executionId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getStatusIcon(exec.status)}</span>
                        <div>
                          <div className={`text-sm font-semibold ${getStatusColor(exec.status).split(' ')[0]}`}>
                            {exec.status.toUpperCase()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(exec.startedAt || exec.queuedAt)}
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${getTriggerBadge(exec.trigger)}`}>
                        {exec.trigger}
                      </span>
                    </div>

                    <div className="text-sm text-gray-700 mb-2">
                      {exec.result?.message || 'No message'}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>Duration: {formatDuration(exec.duration)}</span>
                      {exec.attemptNumber > 1 && (
                        <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                          Attempt {exec.attemptNumber}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Execution Details */}
          <div className="w-1/2 overflow-y-auto">
            {selectedExecution ? (
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Execution Details</h3>
                    {selectedExecution.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(selectedExecution)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Execution ID:</span>
                      <span className="font-mono text-gray-800">{selectedExecution.executionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-semibold ${getStatusColor(selectedExecution.status).split(' ')[0]}`}>
                        {selectedExecution.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Trigger:</span>
                      <span className="font-medium text-gray-800">{selectedExecution.trigger}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Started:</span>
                      <span className="text-gray-800">{formatDate(selectedExecution.startedAt)}</span>
                    </div>
                    {selectedExecution.completedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Completed:</span>
                        <span className="text-gray-800">{formatDate(selectedExecution.completedAt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="text-gray-800">{formatDuration(selectedExecution.duration)}</span>
                    </div>
                    {selectedExecution.attemptNumber > 1 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Attempt:</span>
                        <span className="text-orange-600 font-semibold">{selectedExecution.attemptNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Result */}
                  {selectedExecution.result && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-2">Result</h4>
                      <div className={`p-4 rounded-lg ${
                        selectedExecution.result.success ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <div className="text-sm mb-2">
                          <strong>Message:</strong> {selectedExecution.result.message}
                        </div>
                        {selectedExecution.result.metadata && (
                          <div className="text-xs">
                            <strong>Metadata:</strong>
                            <pre className="mt-1 bg-white bg-opacity-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(selectedExecution.result.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        {selectedExecution.result.error && (
                          <div className="mt-2 text-xs">
                            <strong className="text-red-600">Error:</strong>
                            <div className="bg-white bg-opacity-50 p-2 rounded mt-1">
                              <div><strong>Message:</strong> {selectedExecution.result.error.message}</div>
                              {selectedExecution.result.error.code && (
                                <div><strong>Code:</strong> {selectedExecution.result.error.code}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Logs */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Logs</h4>
                    {selectedExecution.logs && selectedExecution.logs.length > 0 ? (
                      <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto font-mono text-xs max-h-96 overflow-y-auto">
                        {selectedExecution.logs.map((log, idx) => {
                          const levelColors = {
                            debug: 'text-gray-400',
                            info: 'text-blue-300',
                            warn: 'text-yellow-300',
                            error: 'text-red-400'
                          };
                          return (
                            <div key={idx} className="mb-1">
                              <span className="text-gray-500">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                              {' '}
                              <span className={`font-semibold ${levelColors[log.level]}`}>
                                [{log.level.toUpperCase()}]
                              </span>
                              {' '}
                              <span>{log.message}</span>
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="ml-4 text-gray-400">
                                  {JSON.stringify(log.metadata)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-600 text-sm">
                        No logs available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Select an execution to view details
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Total executions: {executions.length}
          </div>
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

