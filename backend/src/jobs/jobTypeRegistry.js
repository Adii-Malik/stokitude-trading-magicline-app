/**
 * Job Type Registry
 * 
 * Central registry for all available job types
 * Similar to SFCC's steptypes.json but as a JS module
 */

import pricePollingJobType from './types/pricePollingJobType.js';
import tradingViewJobType from './types/tradingViewJobType.js';
import signalGenerationJobType from './types/signalGenerationJobType.js';
import historicalDataJobType from './types/historicalDataJobType.js';
import logCleanupJobType from './types/logCleanupJobType.js';

class JobTypeRegistry {
  constructor() {
    this.jobTypes = new Map();
    this.handlers = new Map();
    this.initialized = false;
  }

  /**
   * Initialize registry - load all job types and handlers
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️  Job Type Registry already initialized');
      return;
    }

    console.log('📋 Initializing Job Type Registry...');

    // Register built-in job types
    this.register(pricePollingJobType);
    this.register(tradingViewJobType);
    this.register(signalGenerationJobType);
    this.register(historicalDataJobType);
    this.register(logCleanupJobType);

    // Auto-discover custom job types (if directory exists)
    await this.discoverCustomJobTypes();

    this.initialized = true;
    console.log(`   ✅ Registered ${this.jobTypes.size} job types`);

    // Log registered job types
    this.jobTypes.forEach((jobType) => {
      const deprecated = jobType.constraints?.deprecated ? ' [DEPRECATED]' : '';
      console.log(`      • ${jobType.name} (${jobType.type})${deprecated}`);
    });
  }

  /**
   * Register a single job type
   */
  register(jobType) {
    // Validate job type definition
    this.validateJobType(jobType);

    // Store job type
    this.jobTypes.set(jobType.type, jobType);

    // Load handler
    this.loadHandler(jobType);
  }

  /**
   * Unregister a job type (for testing or dynamic removal)
   */
  unregister(type) {
    this.jobTypes.delete(type);
    this.handlers.delete(type);
  }

  /**
   * Load job handler module
   */
  async loadHandler(jobType) {
    try {
      const handlerModule = await import(`./handlers/${jobType.handler}.js`);
      this.handlers.set(jobType.type, handlerModule.default);
      console.log(`      ✓ Loaded handler: ${jobType.handler}`);
    } catch (error) {
      console.error(`      ✗ Failed to load handler for ${jobType.type}:`, error.message);
      // Handler will be loaded later when needed
    }
  }

  /**
   * Get all job types (for API/GUI)
   */
  getAllJobTypes() {
    return Array.from(this.jobTypes.values()).map(jt => ({
      type: jt.type,
      name: jt.name,
      description: jt.description,
      category: jt.category,
      icon: jt.icon,
      parameters: jt.parameters,
      scheduleOptions: jt.scheduleOptions,
      execution: jt.execution,
      constraints: jt.constraints,
      version: jt.version,
      tags: jt.tags
    }));
  }

  /**
   * Get job types by category
   */
  getJobTypesByCategory(category) {
    return this.getAllJobTypes().filter(jt => jt.category === category);
  }

  /**
   * Get specific job type definition
   */
  getJobType(type) {
    const jobType = this.jobTypes.get(type);
    if (!jobType) {
      throw new Error(`Job type not found: ${type}`);
    }
    return jobType;
  }

  /**
   * Check if job type exists
   */
  hasJobType(type) {
    return this.jobTypes.has(type);
  }

  /**
   * Get handler for job type
   */
  getHandler(type) {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`Handler not found for job type: ${type}`);
    }
    return handler;
  }

  /**
   * Check if handler is loaded
   */
  hasHandler(type) {
    return this.handlers.has(type);
  }

  /**
   * Get all categories
   */
  getCategories() {
    const categories = new Set();
    this.jobTypes.forEach(jt => categories.add(jt.category));
    return Array.from(categories);
  }

  /**
   * Validate job type definition
   */
  validateJobType(jobType) {
    const required = ['type', 'name', 'handler', 'parameters', 'scheduleOptions', 'execution'];
    
    for (const field of required) {
      if (!jobType[field]) {
        throw new Error(`Job type '${jobType.type || 'unknown'}' missing required field: ${field}`);
      }
    }

    // Validate parameters
    if (!Array.isArray(jobType.parameters)) {
      throw new Error(`Job type '${jobType.type}' parameters must be an array`);
    }

    jobType.parameters.forEach(param => {
      if (!param.name || !param.label || !param.type) {
        throw new Error(`Job type '${jobType.type}' has invalid parameter definition`);
      }
    });

    // Validate schedule options
    const so = jobType.scheduleOptions;
    if (!Array.isArray(so.supportedTypes) || so.supportedTypes.length === 0) {
      throw new Error(`Job type '${jobType.type}' must have at least one supported schedule type`);
    }

    // Validate execution settings
    const exec = jobType.execution;
    if (typeof exec.timeout !== 'number' || exec.timeout <= 0) {
      throw new Error(`Job type '${jobType.type}' must have valid timeout`);
    }
  }

  /**
   * Auto-discover custom job types from /jobs/custom/ directory
   */
  async discoverCustomJobTypes() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const customJobsDir = path.join(__dirname, 'custom');

      // Check if directory exists
      try {
        await fs.access(customJobsDir);
      } catch {
        // Directory doesn't exist - that's fine
        return;
      }

      const files = await fs.readdir(customJobsDir);

      let discoveredCount = 0;
      for (const file of files) {
        if (file.endsWith('JobType.js')) {
          try {
            const jobTypeModule = await import(`./custom/${file}`);
            this.register(jobTypeModule.default);
            discoveredCount++;
          } catch (error) {
            console.error(`   ✗ Failed to load custom job type ${file}:`, error.message);
          }
        }
      }

      if (discoveredCount > 0) {
        console.log(`   ✅ Discovered ${discoveredCount} custom job type(s)`);
      }
    } catch (error) {
      // Silent fail - custom jobs are optional
      console.log('   ℹ️  No custom job types directory found (optional)');
    }
  }

  /**
   * Validate job configuration against job type parameters
   */
  validateJobConfig(type, config) {
    const jobType = this.getJobType(type);
    const errors = [];

    jobType.parameters.forEach(param => {
      const value = config[param.name];

      // Check required
      if (param.required && (value === undefined || value === null || value === '')) {
        errors.push(`Parameter '${param.label}' is required`);
        return;
      }

      // Skip validation if not provided and not required
      if (value === undefined || value === null) {
        return;
      }

      // Type validation
      switch (param.type) {
        case 'number':
          if (typeof value !== 'number') {
            errors.push(`Parameter '${param.label}' must be a number`);
          } else {
            if (param.min !== undefined && value < param.min) {
              errors.push(`Parameter '${param.label}' must be >= ${param.min}`);
            }
            if (param.max !== undefined && value > param.max) {
              errors.push(`Parameter '${param.label}' must be <= ${param.max}`);
            }
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Parameter '${param.label}' must be a boolean`);
          }
          break;

        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Parameter '${param.label}' must be a string`);
          }
          break;

        case 'select':
          if (!param.options.some(opt => opt.value === value)) {
            errors.push(`Parameter '${param.label}' has invalid value`);
          }
          break;

        case 'multiselect':
          if (!Array.isArray(value)) {
            errors.push(`Parameter '${param.label}' must be an array`);
          } else {
            const validValues = param.options.map(opt => opt.value);
            const invalidValues = value.filter(v => !validValues.includes(v));
            if (invalidValues.length > 0) {
              errors.push(`Parameter '${param.label}' has invalid values: ${invalidValues.join(', ')}`);
            }
          }
          break;
      }
    });

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }

  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      totalJobTypes: this.jobTypes.size,
      loadedHandlers: this.handlers.size,
      categories: {},
      byCategory: {}
    };

    this.jobTypes.forEach(jt => {
      if (!stats.byCategory[jt.category]) {
        stats.byCategory[jt.category] = [];
      }
      stats.byCategory[jt.category].push(jt.type);
    });

    Object.keys(stats.byCategory).forEach(category => {
      stats.categories[category] = stats.byCategory[category].length;
    });

    return stats;
  }
}

export default new JobTypeRegistry();

