/**
 * Feature Flags - Simple Approach
 * 
 * Check MODE or allow manual override via VITE_ENABLE_DEV_FEATURES:
 * - development = All test features enabled  
 * - production = All test features disabled
 * - VITE_ENABLE_DEV_FEATURES=false = Force disable even in dev mode (dev only override)
 */

const isDevelopment = import.meta.env.MODE === 'development'
    && import.meta.env.VITE_ENABLE_DEV_FEATURES !== 'false';

export const featureFlags = {
    devMode: isDevelopment
};

export function isFeatureEnabled(featureName) {
    return isDevelopment;
}

export function useFeatureFlag(featureName) {
    return isDevelopment;
}

export function getFeatureFlagsSummary() {
    return {
        mode: import.meta.env.MODE,
        devMode: isDevelopment,
        message: isDevelopment
            ? 'All test features enabled (development mode)'
            : 'All test features disabled (production mode)'
    };
}

export default featureFlags;
