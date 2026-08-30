/**
 * One gate, for the development-only test routes.
 *
 * There is no flag store and no per-feature switch: NODE_ENV is the whole
 * decision. The summary endpoint and the unused `isFeatureEnabled` helper that
 * used to sit here reported on a system that never had more than this line.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

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

export default { requireFeature };
