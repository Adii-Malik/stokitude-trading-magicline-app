import { useState, useEffect } from 'react';
import jobsApi from '../../../services/jobs';

export default function CreateJobModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [jobTypes, setJobTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [jobName, setJobName] = useState('');
  const [config, setConfig] = useState({});
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadJobTypes();
  }, []);

  const loadJobTypes = async () => {
    try {
      setLoading(true);
      const response = await jobsApi.getJobTypes();
      setJobTypes(response.data.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load job types');
      console.error('Error loading job types:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeSelect = (jobType) => {
    setSelectedType(jobType);
    setJobName(jobType.name);
    
    // Initialize config with defaults
    const defaultConfig = {};
    jobType.parameters.forEach(param => {
      defaultConfig[param.name] = param.default;
    });
    setConfig(defaultConfig);
    
    // Initialize schedule with defaults (Universal Pattern)
    const defaults = jobType.scheduleOptions.defaultRecurring || {
      amount: 1,
      interval: 'days',
      daysOfWeek: [],
      time: null
    };
    
    setSchedule({
      recurring: {
        enabled: true,
        amount: defaults.amount,
        interval: defaults.interval,
        daysOfWeek: defaults.daysOfWeek || [],
        time: defaults.time || ''
      },
      timezone: 'Asia/Karachi',
      respectMarketHours: jobType.scheduleOptions.respectMarketHours || false
    });
    
    setStep(2);
  };

  const handleConfigChange = (paramName, value) => {
    setConfig(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleScheduleChange = (field, value) => {
    setSchedule(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateConfig = () => {
    if (!selectedType) return false;
    
    for (const param of selectedType.parameters) {
      if (param.required && !config[param.name]) {
        setError(`${param.label} is required`);
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateConfig()) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      await jobsApi.createJob({
        jobType: selectedType.type,
        name: jobName,
        description: selectedType.description,
        config,
        schedule,
        enabled: false // Create disabled by default
      });
      
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create job');
      console.error('Error creating job:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderParameterInput = (param) => {
    const value = config[param.name];

    switch (param.type) {
      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleConfigChange(param.name, parseInt(e.target.value) || 0)}
            min={param.min}
            max={param.max}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={param.required}
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleConfigChange(param.name, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">{param.helpText}</span>
          </label>
        );

      case 'string':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleConfigChange(param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={param.required}
          />
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleConfigChange(param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={param.required}
          >
            {param.options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {param.options.map(opt => (
              <label key={opt.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={(value || []).includes(opt.value)}
                  onChange={(e) => {
                    const currentValue = value || [];
                    const newValue = e.target.checked
                      ? [...currentValue, opt.value]
                      : currentValue.filter(v => v !== opt.value);
                    handleConfigChange(param.name, newValue);
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleConfigChange(param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Create New Job</h2>
            <p className="text-sm text-gray-600 mt-1">
              Step {step} of 2: {step === 1 ? 'Select Job Type' : 'Configure Job'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl">Loading job types...</div>
            </div>
          ) : step === 1 ? (
            /* Step 1: Select Job Type */
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobTypes.map(type => (
                  <button
                    key={type.type}
                    onClick={() => handleTypeSelect(type)}
                    disabled={type.constraints?.deprecated}
                    className={`p-6 border-2 rounded-lg text-left transition-all hover:shadow-lg ${
                      type.constraints?.deprecated
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-500'
                    }`}
                  >
                    <div className="text-4xl mb-3">{type.icon}</div>
                    <h3 className="font-bold text-lg text-gray-800 mb-2">{type.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{type.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {type.category}
                      </span>
                      {type.constraints?.deprecated && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          Deprecated
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Step 2: Configure Job */
            <div className="space-y-6">
              {/* Job Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Name
                </label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter job name"
                />
              </div>

              {/* Parameters */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Configuration</h3>
                <div className="space-y-4">
                  {selectedType.parameters.map(param => (
                    <div key={param.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {param.label}
                        {param.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {renderParameterInput(param)}
                      {param.description && (
                        <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule - Universal SFCC-Style */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Schedule</h3>
                <div className="space-y-4">
                  {/* Recurrence Toggle */}
                  <div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedule.recurring?.enabled || false}
                        onChange={(e) => setSchedule(prev => ({
                          ...prev,
                          recurring: { ...prev.recurring, enabled: e.target.checked }
                        }))}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                      <span className="ml-3">
                        <span className="text-sm font-medium text-gray-900">Enable Automatic Recurrence</span>
                        <p className="text-xs text-gray-500">Uncheck for manual trigger only (Run Now button)</p>
                      </span>
                    </label>
                  </div>

                  {schedule.recurring?.enabled ? (
                    <>
                      {/* Recurrence Settings */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                        <div className="font-medium text-blue-900">Run Every:</div>
                        
                        {/* Amount & Interval */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Amount *
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={schedule.recurring?.amount || 1}
                              onChange={(e) => setSchedule(prev => ({
                                ...prev,
                                recurring: { ...prev.recurring, amount: parseInt(e.target.value) || 1 }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Interval *
                            </label>
                            <select
                              value={schedule.recurring?.interval || 'days'}
                              onChange={(e) => setSchedule(prev => ({
                                ...prev,
                                recurring: { ...prev.recurring, interval: e.target.value }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="minutes">Minutes</option>
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                              <option value="weeks">Weeks</option>
                              <option value="months">Months</option>
                            </select>
                          </div>
                        </div>

                        {/* Days of Week */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Run Only On These Days: <span className="text-xs text-gray-500">(Empty = All days)</span>
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { value: 1, label: 'Mon' },
                              { value: 2, label: 'Tue' },
                              { value: 3, label: 'Wed' },
                              { value: 4, label: 'Thu' },
                              { value: 5, label: 'Fri' },
                              { value: 6, label: 'Sat' },
                              { value: 0, label: 'Sun' }
                            ].map(day => {
                              const isSelected = (schedule.recurring?.daysOfWeek || []).includes(day.value);
                              return (
                                <button
                                  key={day.value}
                                  type="button"
                                  onClick={() => {
                                    const current = schedule.recurring?.daysOfWeek || [];
                                    const newDays = isSelected
                                      ? current.filter(d => d !== day.value)
                                      : [...current, day.value];
                                    setSchedule(prev => ({
                                      ...prev,
                                      recurring: { ...prev.recurring, daysOfWeek: newDays }
                                    }));
                                  }}
                                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {day.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Specific Time */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            At Specific Time: <span className="text-xs text-gray-500">(Optional, 24-hour format)</span>
                          </label>
                          <input
                            type="time"
                            value={schedule.recurring?.time || ''}
                            onChange={(e) => setSchedule(prev => ({
                              ...prev,
                              recurring: { ...prev.recurring, time: e.target.value }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Leave empty to run throughout the day
                          </p>
                        </div>

                        {/* Summary */}
                        <div className="bg-white rounded p-3 text-sm">
                          <strong>Summary:</strong> Runs every{' '}
                          <strong>{schedule.recurring?.amount || 1}</strong>{' '}
                          <strong>{schedule.recurring?.interval || 'days'}</strong>
                          {schedule.recurring?.daysOfWeek?.length > 0 && (
                            <span> on selected days</span>
                          )}
                          {schedule.recurring?.time && (
                            <span> at <strong>{schedule.recurring.time}</strong></span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Manual Only */
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">👆</div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-1">Manual Trigger Only</h4>
                          <p className="text-sm text-gray-600">
                            This job will NOT run automatically. Use the <strong>"Run Now"</strong> button 
                            to execute it manually whenever needed.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          {step === 2 ? (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Job'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

