import moment from 'moment-timezone';

/**
 * PSX Market Hours Service
 * Handles all market timing logic for Pakistan Stock Exchange
 * 
 * Regular Trading Hours (Mon-Thu):
 *   - 9:15 AM to 3:30 PM PKT
 * 
 * Friday Trading Hours:
 *   - 9:15 AM to 12:00 PM (Morning Session)
 *   - 2:30 PM to 4:30 PM (Afternoon Session)
 * 
 * Weekends: Saturday & Sunday - Market Closed
 */
class MarketHoursService {
  constructor() {
    this.timezone = 'Asia/Karachi';
    
    // Regular trading hours (Mon-Thu)
    this.regularMarketOpen = { hour: 9, minute: 15 };
    this.regularMarketClose = { hour: 15, minute: 30 };
    
    // Friday trading hours
    this.fridayMorningOpen = { hour: 9, minute: 15 };
    this.fridayMorningClose = { hour: 12, minute: 0 };
    this.fridayAfternoonOpen = { hour: 14, minute: 30 };
    this.fridayAfternoonClose = { hour: 16, minute: 30 };
    
    // Public holidays (can be loaded from config or database)
    this.publicHolidays = [
      // Format: 'YYYY-MM-DD'
      // Add holidays here as needed
    ];
  }

  /**
   * Get current time in Pakistan timezone
   */
  getCurrentTime() {
    return moment.tz(this.timezone);
  }

  /**
   * Check if today is a weekend (Saturday or Sunday)
   */
  isWeekend(time = null) {
    const current = time || this.getCurrentTime();
    const day = current.day(); // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
  }

  /**
   * Check if today is a public holiday
   */
  isPublicHoliday(time = null) {
    const current = time || this.getCurrentTime();
    const dateStr = current.format('YYYY-MM-DD');
    return this.publicHolidays.includes(dateStr);
  }

  /**
   * Check if current time is within trading hours
   */
  isMarketOpen() {
    const now = this.getCurrentTime();
    
    // Check if weekend
    if (this.isWeekend(now)) {
      return false;
    }
    
    // Check if public holiday
    if (this.isPublicHoliday(now)) {
      return false;
    }
    
    const currentHour = now.hour();
    const currentMinute = now.minute();
    const dayOfWeek = now.day(); // 0 = Sunday, 5 = Friday
    
    // Friday has special hours
    if (dayOfWeek === 5) {
      return this.isFridayMarketOpen(currentHour, currentMinute);
    }
    
    // Regular trading hours (Mon-Thu)
    return this.isRegularMarketOpen(currentHour, currentMinute);
  }

  /**
   * Check if within regular trading hours (Mon-Thu)
   */
  isRegularMarketOpen(hour, minute) {
    const currentTime = hour * 60 + minute;
    const openTime = this.regularMarketOpen.hour * 60 + this.regularMarketOpen.minute;
    const closeTime = this.regularMarketClose.hour * 60 + this.regularMarketClose.minute;
    
    return currentTime >= openTime && currentTime <= closeTime;
  }

  /**
   * Check if within Friday trading hours (split sessions)
   */
  isFridayMarketOpen(hour, minute) {
    const currentTime = hour * 60 + minute;
    
    // Morning session: 9:15 AM - 12:00 PM
    const morningOpen = this.fridayMorningOpen.hour * 60 + this.fridayMorningOpen.minute;
    const morningClose = this.fridayMorningClose.hour * 60 + this.fridayMorningClose.minute;
    
    // Afternoon session: 2:30 PM - 4:30 PM
    const afternoonOpen = this.fridayAfternoonOpen.hour * 60 + this.fridayAfternoonOpen.minute;
    const afternoonClose = this.fridayAfternoonClose.hour * 60 + this.fridayAfternoonClose.minute;
    
    const inMorningSession = currentTime >= morningOpen && currentTime <= morningClose;
    const inAfternoonSession = currentTime >= afternoonOpen && currentTime <= afternoonClose;
    
    return inMorningSession || inAfternoonSession;
  }

  /**
   * Get market status with detailed information
   */
  getMarketStatus() {
    const now = this.getCurrentTime();
    const isOpen = this.isMarketOpen();
    const isWeekend = this.isWeekend(now);
    const isHoliday = this.isPublicHoliday(now);
    
    let status = 'closed';
    let message = '';
    let nextOpen = null;
    
    if (isWeekend) {
      status = 'weekend';
      message = 'Market is closed for the weekend';
      nextOpen = this.getNextMarketOpen(now);
    } else if (isHoliday) {
      status = 'holiday';
      message = 'Market is closed for public holiday';
      nextOpen = this.getNextMarketOpen(now);
    } else if (isOpen) {
      status = 'open';
      message = 'Market is currently open';
    } else {
      status = 'closed';
      message = 'Market is closed';
      nextOpen = this.getNextMarketOpen(now);
    }
    
    return {
      isOpen,
      status,
      message,
      currentTime: now.format('HH:mm:ss'),
      currentDate: now.format('YYYY-MM-DD'),
      dayOfWeek: now.format('dddd'),
      nextOpen: nextOpen ? nextOpen.format('YYYY-MM-DD HH:mm') : null
    };
  }

  /**
   * Calculate when market will open next
   */
  getNextMarketOpen(time = null) {
    const current = time || this.getCurrentTime();
    let next = current.clone();
    
    // Try up to 7 days ahead to find next opening
    for (let i = 0; i < 7; i++) {
      if (i > 0) {
        next.add(1, 'day').startOf('day');
      }
      
      // Skip weekends
      if (this.isWeekend(next)) {
        continue;
      }
      
      // Skip holidays
      if (this.isPublicHoliday(next)) {
        continue;
      }
      
      // Set to market open time
      if (next.day() === 5) {
        // Friday morning session
        next.set({
          hour: this.fridayMorningOpen.hour,
          minute: this.fridayMorningOpen.minute,
          second: 0
        });
      } else {
        // Regular day
        next.set({
          hour: this.regularMarketOpen.hour,
          minute: this.regularMarketOpen.minute,
          second: 0
        });
      }
      
      // Only return if this time is in the future
      if (next.isAfter(current)) {
        return next;
      }
    }
    
    return null;
  }

  /**
   * Get minutes until market opens (if closed)
   */
  getMinutesUntilOpen() {
    if (this.isMarketOpen()) {
      return 0;
    }
    
    const now = this.getCurrentTime();
    const nextOpen = this.getNextMarketOpen(now);
    
    if (!nextOpen) {
      return null;
    }
    
    return nextOpen.diff(now, 'minutes');
  }

  /**
   * Get minutes until market closes (if open)
   */
  getMinutesUntilClose() {
    if (!this.isMarketOpen()) {
      return 0;
    }
    
    const now = this.getCurrentTime();
    const currentHour = now.hour();
    const currentMinute = now.minute();
    const dayOfWeek = now.day();
    
    let closeHour, closeMinute;
    
    if (dayOfWeek === 5) {
      // Friday - check which session
      const morningCloseTime = this.fridayMorningClose.hour * 60 + this.fridayMorningClose.minute;
      const currentTime = currentHour * 60 + currentMinute;
      
      if (currentTime < morningCloseTime) {
        closeHour = this.fridayMorningClose.hour;
        closeMinute = this.fridayMorningClose.minute;
      } else {
        closeHour = this.fridayAfternoonClose.hour;
        closeMinute = this.fridayAfternoonClose.minute;
      }
    } else {
      // Regular day
      closeHour = this.regularMarketClose.hour;
      closeMinute = this.regularMarketClose.minute;
    }
    
    const closeTime = now.clone().set({ hour: closeHour, minute: closeMinute, second: 0 });
    return closeTime.diff(now, 'minutes');
  }

  /**
   * Add a public holiday
   */
  addHoliday(date) {
    // Expected format: 'YYYY-MM-DD'
    if (!this.publicHolidays.includes(date)) {
      this.publicHolidays.push(date);
    }
  }

  /**
   * Remove a public holiday
   */
  removeHoliday(date) {
    const index = this.publicHolidays.indexOf(date);
    if (index > -1) {
      this.publicHolidays.splice(index, 1);
    }
  }

  /**
   * Log current market status (for debugging)
   */
  logStatus() {
    const status = this.getMarketStatus();
    console.log('\n📊 PSX Market Status:');
    console.log(`   Status: ${status.status.toUpperCase()}`);
    console.log(`   Message: ${status.message}`);
    console.log(`   Current Time: ${status.currentTime} PKT`);
    console.log(`   Date: ${status.currentDate} (${status.dayOfWeek})`);
    
    if (status.nextOpen) {
      console.log(`   Next Opening: ${status.nextOpen} PKT`);
    }
    
    if (status.isOpen) {
      const minutesUntilClose = this.getMinutesUntilClose();
      console.log(`   Closes in: ${minutesUntilClose} minutes`);
    } else {
      const minutesUntilOpen = this.getMinutesUntilOpen();
      if (minutesUntilOpen !== null) {
        console.log(`   Opens in: ${minutesUntilOpen} minutes (${(minutesUntilOpen / 60).toFixed(1)} hours)`);
      }
    }
  }
}

// Export singleton instance
export default new MarketHoursService();

