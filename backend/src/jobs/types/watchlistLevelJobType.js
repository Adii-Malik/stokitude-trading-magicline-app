/**
 * Level Watch
 *
 * Every price you named - the stop and targets of a position you are in, and
 * the trigger and invalidation of an idea you are still deciding on - checked
 * often enough to be worth naming.
 *
 * Both used to ride the nightly bar sync, because that was the job producing
 * the price they read. It no longer is, so they share this clock instead and a
 * level reached at eleven in the morning does not wait until five.
 *
 * Every fifteen minutes, all day. The feed is delayed a quarter of an hour, so
 * a tighter cadence would ask the same question of the same number; a looser one
 * only widens the window between price getting there and you hearing about it.
 * Running outside market hours costs one request and settles nothing, which is
 * cheaper than a calendar of two exchanges' sessions and holidays to get wrong.
 */
export default {
  type: 'watchlist_levels',

  name: 'Level Watch',
  description: 'Checks your journal stops and targets and your shortlist levels against the session',
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

  tags: ['watchlist', 'journal', 'levels']
};
