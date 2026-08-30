/**
 * What this app can notify you about.
 *
 * One category and two events, because that is everything anything actually
 * raises: a stop and a target on an open journal trade, both from
 * journalLevelHandler. There were two further categories - system and admin,
 * with six events between them - describing announcements, maintenance, signal
 * generation and user registration. Nothing ever sent one, which meant every
 * preference row carried switches for notifications that could not arrive and
 * the model kept an always-enabled bypass for categories that never occurred.
 *
 * `buy_level_hit` went the same way: the journal has no entry-zone concept
 * since planned trades were removed from it, so nothing could raise it either.
 *
 * The id and event ids are stored on every NotificationPreference row, so they
 * stay as they are even though they now describe journal levels rather than the
 * trade plans they were named for.
 */

export const NOTIFICATION_CATEGORIES = {
    // The id and event ids are stored on every NotificationPreference row, so
    // they stay as they are even though these now describe journal levels.
    trade_plans: {
        id: 'trade_plans',
        label: 'Level Alerts',
        description: 'Get notified when your entry zones, targets and stops are reached',
        icon: '💰',
        userControllable: true,
        defaultEnabled: true,
        events: [
            {
                id: 'target_hit',
                label: 'Target Reached',
                description: 'Price traded through a target on an open trade'
            },
            {
                id: 'stop_loss_hit',
                label: 'Stop Reached',
                description: 'Price traded through the stop on an open trade'
            }
        ]
    },

};


/**
 * Validate if a category exists
 * @param {String} category - Category ID
 * @returns {Boolean}
 */
export function isValidCategory(category) {
    return Object.prototype.hasOwnProperty.call(NOTIFICATION_CATEGORIES, category);
}

/**
 * Validate if an event exists for a category
 * @param {String} category - Category ID
 * @param {String} event - Event ID
 * @returns {Boolean}
 */
export function isValidEvent(category, event) {
    const cat = NOTIFICATION_CATEGORIES[category];
    if (!cat) return false;
    return cat.events.some(e => e.id === event);
}


export default {
    NOTIFICATION_CATEGORIES,
    isValidCategory,
    isValidEvent,
};
