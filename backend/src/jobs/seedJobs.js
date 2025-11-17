/**
 * Seed Jobs
 * 
 * Creates job instances for existing services
 * Run once during migration
 */

import Job from '../models/Job.js';
import Settings from '../models/Settings.js';

export async function seedExistingServices() {
  console.log('\n🌱 Seeding existing services as job instances...\n');

  try {
    // Get settings for price polling interval
    const settings = await Settings.getSettings();
    const pollingInterval = settings?.pricePolling?.intervalMinutes || 15;

    const existingJobs = [
      // Price Polling Service
      {
        jobType: 'price_polling',
        name: 'Price Polling Service',
        description: 'Fetches real-time stock prices from PSX during market hours',
        enabled: settings?.pricePolling?.enabled || false,
        config: {
          // Note: intervalMinutes removed - now controlled by schedule.recurring
          skipMarketCheck: false,
          batchSize: 50,
          maxSymbols: 0
        },
        schedule: {
          recurring: {
            enabled: true,
            amount: pollingInterval,
            interval: 'minutes',
            daysOfWeek: [1,2,3,4,5], // Mon-Fri
            time: null  // Any time
          },
          timezone: 'Asia/Karachi',
          respectMarketHours: true
        },
        tags: ['legacy', 'prices', 'psx']
      },

      // TradingView Daily Updates
      {
        jobType: 'tradingview_daily',
        name: 'TradingView Daily Updates',
        description: 'Updates daily OHLCV data from TradingView after market close',
        enabled: true,
        config: {
          timeframes: ['daily'],
          lookbackDays: 7
        },
        schedule: {
          recurring: {
            enabled: true,
            amount: 1,
            interval: 'days',
            daysOfWeek: [1,2,3,4,5], // Mon-Fri
            time: '17:00'  // 5:00 PM
          },
          timezone: 'Asia/Karachi',
          respectMarketHours: false
        },
        tags: ['legacy', 'ohlcv', 'daily']
      },

      // TradingView Weekly/Monthly Updates
      {
        jobType: 'tradingview_weekly',
        name: 'TradingView Weekly/Monthly Updates',
        description: 'Updates weekly and monthly OHLCV data from TradingView',
        enabled: true,
        config: {
          timeframes: ['weekly', 'monthly'],
          lookbackWeeks: 12
        },
        schedule: {
          recurring: {
            enabled: true,
            amount: 1,
            interval: 'weeks',
            daysOfWeek: [6], // Saturday
            time: '17:00'  // 5:00 PM
          },
          timezone: 'Asia/Karachi',
          respectMarketHours: false
        },
        tags: ['legacy', 'ohlcv', 'weekly', 'monthly']
      },

      // Signal Generation
      {
        jobType: 'signal_generation',
        name: 'Signal Generation',
        description: 'Generates trading signals for all active strategies',
        enabled: true,
        config: {
          onlyActiveStrategies: true,
          batchSize: 20,
          saveToDatabase: true,
          notifyUsers: true
        },
        schedule: {
          recurring: {
            enabled: true,
            amount: 1,
            interval: 'days',
            daysOfWeek: [1,2,3,4,5,6], // Mon-Sat
            time: '17:30'  // 5:30 PM
          },
          timezone: 'Asia/Karachi',
          respectMarketHours: false
        },
        tags: ['legacy', 'signals', 'trading']
      }
    ];

    let seededCount = 0;
    let skippedCount = 0;

    for (const jobData of existingJobs) {
      // Check if already exists
      const exists = await Job.findOne({ jobType: jobData.jobType });
      
      if (exists) {
        console.log(`   ⏭️  Skipped (already exists): ${jobData.name}`);
        skippedCount++;
        continue;
      }

      // Create job
      await Job.create(jobData);
      console.log(`   ✅ Seeded: ${jobData.name} (${jobData.enabled ? 'enabled' : 'disabled'})`);
      seededCount++;
    }

    console.log(`\n✅ Job seeding completed:`);
    console.log(`   • Created: ${seededCount}`);
    console.log(`   • Skipped: ${skippedCount}`);
    console.log(`   • Total: ${existingJobs.length}\n`);

    return {
      seeded: seededCount,
      skipped: skippedCount,
      total: existingJobs.length
    };

  } catch (error) {
    console.error('❌ Failed to seed jobs:', error);
    throw error;
  }
}

export default seedExistingServices;

