/**
 * Notification Configuration
 * 
 * This file defines all available notification categories and events.
 * Adding/removing features here automatically updates the entire system.
 * 
 * IMPORTANT: 
 * - 'system' and 'admin' categories are ALWAYS ENABLED (no user control)
 * - Only categories with userControllable: true appear in preferences UI
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
                id: 'buy_level_hit',
                label: 'Entry Zone Reached',
                description: 'Price traded into the entry zone of a planned trade'
            },
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

    system: {
        id: 'system',
        label: 'System Notifications',
        description: 'Important system updates and announcements',
        icon: '🔔',
        userControllable: false, // ALWAYS ENABLED
        defaultEnabled: true,
        events: [
            {
                id: 'system_alert',
                label: 'System Alert',
                description: 'Critical system notifications'
            },
            {
                id: 'maintenance',
                label: 'Maintenance',
                description: 'System maintenance notifications'
            },
            {
                id: 'announcement',
                label: 'Announcement',
                description: 'Admin announcements'
            }
        ]
    },

    admin: {
        id: 'admin',
        label: 'Admin Notifications',
        description: 'Signal generation and incomplete trade setups',
        icon: '👨‍💼',
        userControllable: false, // ALWAYS ENABLED
        defaultEnabled: true,
        adminOnly: true, // Only visible to admins
        events: [
            {
                id: 'signal_generated',
                label: 'Signal Generated',
                description: 'Trading signal generated (incomplete setup)'
            },
            {
                id: 'strategy_opportunity',
                label: 'Strategy Opportunity',
                description: 'Trading strategy opportunity detected'
            },
            {
                id: 'user_registered',
                label: 'User Registered',
                description: 'New user registration pending approval'
            }
        ]
    }
};

/**
 * Get user-controllable notification features
 * @returns {Array} List of features user can enable/disable
 */
export function getUserControllableFeatures() {
    return Object.values(NOTIFICATION_CATEGORIES)
        .filter(cat => cat.userControllable === true)
        .map(cat => ({
            id: cat.id,
            label: cat.label,
            description: cat.description,
            icon: cat.icon,
            defaultEnabled: cat.defaultEnabled
        }));
}

/**
 * Get all notification features for admins
 * @returns {Array} List of all features including admin-only
 */
export function getAllFeatures() {
    return Object.values(NOTIFICATION_CATEGORIES).map(cat => ({
        id: cat.id,
        label: cat.label,
        description: cat.description,
        icon: cat.icon,
        userControllable: cat.userControllable,
        adminOnly: cat.adminOnly || false,
        defaultEnabled: cat.defaultEnabled
    }));
}

/**
 * Get notification features based on user role
 * @param {String} userRole - User role (user, admin, super_admin)
 * @returns {Array} List of features available to this user
 */
export function getFeaturesForUser(userRole) {
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    return Object.values(NOTIFICATION_CATEGORIES)
        .filter(cat => {
            // Include user-controllable features
            if (cat.userControllable) return true;
            // Include admin features for admins
            if (cat.adminOnly && isAdmin) return true;
            return false;
        })
        .map(cat => ({
            id: cat.id,
            label: cat.label,
            description: cat.description,
            icon: cat.icon,
            userControllable: cat.userControllable,
            adminOnly: cat.adminOnly || false,
            defaultEnabled: cat.defaultEnabled
        }));
}

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

/**
 * Get category configuration
 * @param {String} category - Category ID
 * @returns {Object|null}
 */
export function getCategoryConfig(category) {
    return NOTIFICATION_CATEGORIES[category] || null;
}

/**
 * Check if category should always be enabled
 * @param {String} category - Category ID
 * @returns {Boolean}
 */
export function isAlwaysEnabled(category) {
    const cat = NOTIFICATION_CATEGORIES[category];
    return cat && cat.userControllable === false;
}

/**
 * Check if category is admin-only
 * @param {String} category - Category ID
 * @returns {Boolean}
 */
export function isAdminOnly(category) {
    const cat = NOTIFICATION_CATEGORIES[category];
    return cat && cat.adminOnly === true;
}

export default {
    NOTIFICATION_CATEGORIES,
    getUserControllableFeatures,
    getAllFeatures,
    getFeaturesForUser,
    isValidCategory,
    isValidEvent,
    getCategoryConfig,
    isAlwaysEnabled,
    isAdminOnly
};
