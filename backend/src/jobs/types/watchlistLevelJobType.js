/**
 * Shortlist Level Watch
 *
 * The levels you named while deciding whether to trade a name, checked often
 * enough to be worth naming. The nightly sync checks them once as a byproduct
 * of producing a close; this is the same check on its own clock, so a level
 * reached at eleven in the morning does not wait until five.
 *
 * Every fifteen minutes, all day. The feed is delayed a quarter of an hour, so
 * a tighter cadence would ask the same question of the same number; a looser one
 * only widens the window between price getting there and you hearing about it.
 * Running outside market hours costs one request and settles nothing, which is
 * cheaper than a calendar of two exchanges' sessions and holidays to get wrong.
 */
export default {
  type: 'watchlist_levels',

  name: 'Shortlist Level Watch',
  description: 'Checks the triggers and invalidations on your shortlist against the session',
  category: 'data',
  icon: '🎯',

  handler: 'watchlistLevelJob',

  parameters: [],

  scheduleOptions: {
    supportedTypes: ['recurring', 'manual'],
    defaultType: 'recurring',
    defaultRecurring: {
      amount: 15,
      interval: 'minutes'
    },
    respectMarketHours: false,
    skipWeekends: false
  },

  /**
   * No retry: the next run is fifteen minutes away and asks the same question of
   * the same session, so a failed check costs one cycle rather than needing to
   * be chased. The notification itself is already retried, by being left unsent
   * until it succeeds.
   */
  execution: {
    timeout: 120000,
    retryEnabled: false,
    maxRetries: 0,
    concurrentExecutions: false
  },

  constraints: {
    maxInstances: 1
  },

  tags: ['watchlist', 'levels']
};
