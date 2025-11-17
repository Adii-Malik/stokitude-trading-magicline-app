/**
 * Universal Schedule Pattern for ALL Jobs
 * 
 * Based on SFCC Jobs approach - every job has same scheduling capabilities
 * No job-specific restrictions on schedule types
 */

export const UNIVERSAL_SCHEDULE_CONFIG = {
  // Every job supports ALL schedule types
  supportedTypes: ['recurring', 'once', 'manual'],
  
  // Recurring schedule options
  recurring: {
    intervals: [
      { value: 'minutes', label: 'Minutes', min: 1, max: 59 },
      { value: 'hours', label: 'Hours', min: 1, max: 23 },
      { value: 'days', label: 'Days', min: 1, max: 365 },
      { value: 'weeks', label: 'Weeks', min: 1, max: 52 },
      { value: 'months', label: 'Months', min: 1, max: 12 }
    ],
    
    // Day selection (for any recurring job)
    daysOfWeek: [
      { value: 1, label: 'Monday', short: 'Mon' },
      { value: 2, label: 'Tuesday', short: 'Tue' },
      { value: 3, label: 'Wednesday', short: 'Wed' },
      { value: 4, label: 'Thursday', short: 'Thu' },
      { value: 5, label: 'Friday', short: 'Fri' },
      { value: 6, label: 'Saturday', short: 'Sat' },
      { value: 0, label: 'Sunday', short: 'Sun' }
    ],
    
    // Time options
    time: {
      enabled: true,
      default: '00:00',
      description: 'What time should this run? (24-hour format)'
    }
  },
  
  // One-time execution
  once: {
    description: 'Schedule for specific date/time (runs once)',
    requiresDateTime: true
  },
  
  // Manual only (no auto-scheduling)
  manual: {
    description: 'Manual trigger only (Run Now button)',
    autoSchedule: false
  }
};

/**
 * Universal Schedule Schema
 * Every job instance uses this same structure
 */
export const SCHEDULE_SCHEMA = {
  // Schedule type
  type: 'recurring', // 'recurring' | 'once' | 'manual'
  
  // For recurring schedules
  recurring: {
    enabled: true,
    amount: 15,              // e.g., 15
    interval: 'minutes',     // 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
    daysOfWeek: [1,2,3,4,5], // Empty = all days, [1,2,3,4,5] = Mon-Fri
    time: '17:00',           // 24-hour format HH:MM
    startDate: null,         // Optional: Start from specific date
    endDate: null            // Optional: Stop at specific date
  },
  
  // For one-time schedules
  once: {
    dateTime: '2025-11-20T17:00:00Z' // ISO datetime
  },
  
  // Common settings
  timezone: 'Asia/Karachi',
  respectMarketHours: false, // Job-specific: should check market hours before running
  
  // Next calculated run
  nextRun: null  // Calculated by system
};

/**
 * Examples:
 */

// Example 1: Price Polling - Every 15 minutes during weekdays
const pricePollingSchedule = {
  type: 'recurring',
  recurring: {
    enabled: true,
    amount: 15,
    interval: 'minutes',
    daysOfWeek: [1,2,3,4,5], // Mon-Fri
    time: null,              // Any time
  },
  respectMarketHours: true,  // Only run when market is open
  timezone: 'Asia/Karachi'
};

// Example 2: Daily Report - Every day at 6 PM
const dailyReportSchedule = {
  type: 'recurring',
  recurring: {
    enabled: true,
    amount: 1,
    interval: 'days',
    daysOfWeek: [],          // All days
    time: '18:00'
  },
  timezone: 'Asia/Karachi'
};

// Example 3: Weekly Cleanup - Every Sunday at midnight
const weeklyCleanupSchedule = {
  type: 'recurring',
  recurring: {
    enabled: true,
    amount: 1,
    interval: 'weeks',
    daysOfWeek: [0],         // Sunday only
    time: '00:00'
  },
  timezone: 'Asia/Karachi'
};

// Example 4: Manual trigger only
const manualJobSchedule = {
  type: 'manual',
  timezone: 'Asia/Karachi'
};

// Example 5: One-time execution
const oneTimeSchedule = {
  type: 'once',
  once: {
    dateTime: '2025-12-31T23:59:00Z'
  },
  timezone: 'Asia/Karachi'
};

export default UNIVERSAL_SCHEDULE_CONFIG;

