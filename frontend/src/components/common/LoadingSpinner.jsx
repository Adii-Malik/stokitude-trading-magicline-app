/**
 * Reusable Loading Spinner Components
 * Provides consistent loading states across the application
 */

// Full page loading spinner (for initial app load only)
export function FullPageLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 text-lg">Loading...</p>
            </div>
        </div>
    );
}

// Content loading spinner (for data fetching within a page)
export function ContentLoader({ message = 'Loading data...' }) {
    return (
        <div className="flex items-center justify-center py-12">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
            </div>
        </div>
    );
}

// Inline loading spinner (for buttons, small sections)
export function InlineLoader({ size = 'md', className = '' }) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-5 h-5 border-2',
        lg: 'w-6 h-6 border-3'
    };

    return (
        <div className={`${sizeClasses[size]} border-current border-t-transparent rounded-full animate-spin ${className}`} />
    );
}

// Skeleton loader for cards/lists
export function SkeletonLoader({ count = 3, type = 'card' }) {
    if (type === 'card') {
        return (
            <div className="space-y-4">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'table') {
        return (
            <div className="space-y-2">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                    </div>
                ))}
            </div>
        );
    }

    return null;
}

// Export all loaders
export default {
    FullPageLoader,
    ContentLoader,
    InlineLoader,
    SkeletonLoader
};

