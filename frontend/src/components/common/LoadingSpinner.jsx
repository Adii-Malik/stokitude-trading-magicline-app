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

