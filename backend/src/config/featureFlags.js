/**
 * Feature Flags - Simple Approach
 * 
 * Just set NODE_ENV:
 * - development = All test features enabled
 * - production = All test features disabled
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const featureFlags = {
    devMode: isDevelopment
};

export function isFeatureEnabled(featureName) {
    return isDevelopment;
}

export function requireFeature(featureName) {
    return (req, res, next) => {
        if (!isDevelopment) {
            return res.status(403).json({
                success: false,
                message: 'This feature is only available in development mode'
            });
        }
        next();
    };
}

export function requireDevFeatures(req, res, next) {
    if (!isDevelopment) {
        return res.status(403).json({
            success: false,
            message: 'Development features are disabled in production'
        });
    }
    next();
}

export function getFeatureFlagsSummary() {
    return {
        environment: process.env.NODE_ENV,
        devMode: isDevelopment,
        message: isDevelopment
            ? 'All test features enabled (development mode)'
            : 'All test features disabled (production mode)'
    };
}

export default featureFlags;
