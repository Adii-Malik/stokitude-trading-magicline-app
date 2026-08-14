import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, CheckCircle, AlertTriangle, TestTube } from 'lucide-react';
import { getFeatureFlagsSummary } from '../../config/featureFlags';

export default function DevToolsPanel() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        setSummary(getFeatureFlagsSummary());
    }, []);

    if (!summary || !summary.devMode) {
        return null; // Don't show in production
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {/* Collapsed Button */}
            {!expanded && (
                <button
                    onClick={() => setExpanded(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-lg transition flex items-center gap-2"
                    title="Development Tools"
                >
                    <Settings className="w-5 h-5 animate-spin-slow" />
                    <span className="text-xs font-medium">DEV</span>
                </button>
            )}

            {/* Expanded Panel */}
            {expanded && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-purple-500 p-4 w-80 max-h-96 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-purple-600" />
                            <h3 className="font-bold text-gray-900 dark:text-white">Dev Tools</h3>
                        </div>
                        <button
                            onClick={() => setExpanded(false)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            ×
                        </button>
                    </div>

                    {/* Environment */}
                    <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                Environment: {summary.mode.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                Test Features: {summary.devMode ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    </div>

                    {/* Simple Message */}
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                        <p className="text-xs text-green-800 dark:text-green-200">
                            {summary.message}
                        </p>
                    </div>

                    {/* Testing Page Link */}
                    <button
                        onClick={() => {
                            navigate('/testing');
                            setExpanded(false);
                        }}
                        className="mt-3 w-full bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg py-2 px-3 text-xs font-medium flex items-center justify-center gap-2 transition"
                    >
                        <TestTube className="w-4 h-4" />
                        Open Testing Page
                    </button>

                    {/* Warning */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                            ⚠️ Disable dev features in production!
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// Add slow spin animation to tailwind.config.js if not exists
// animation: { 'spin-slow': 'spin 3s linear infinite' }
