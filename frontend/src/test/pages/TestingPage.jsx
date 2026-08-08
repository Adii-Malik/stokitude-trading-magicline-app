import { useState } from 'react';
import { TestTube, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationTester from '../components/NotificationTester';
import TradePlanTester from '../components/TradePlanTester';

export default function TestingPage() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('notifications');

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-amber-500 rounded-lg">
                            <TestTube className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Development Testing
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Manual testing tools for features in development mode
                            </p>
                        </div>
                    </div>

                    {/* Warning Badge */}
                    <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <TestTube className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                                    Development Mode Only
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    This page and all test features are automatically hidden in production builds.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setActiveSection('notifications')}
                            className={`px-6 py-4 font-medium text-sm transition ${activeSection === 'notifications'
                                ? 'border-b-2 border-cyan-500 text-cyan-600 dark:text-cyan-400'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Notification Testing
                        </button>
                        <button
                            onClick={() => setActiveSection('tradePlan')}
                            className={`px-6 py-4 font-medium text-sm transition ${activeSection === 'tradePlan'
                                ? 'border-b-2 border-cyan-500 text-cyan-600 dark:text-cyan-400'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Trade Plan Testing
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    {activeSection === 'notifications' && (
                        <div className="p-6">
                            <NotificationTester />
                        </div>
                    )}

                    {activeSection === 'tradePlan' && (
                        <div className="p-6">
                            <TradePlanTester />
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        For documentation, see{' '}
                        <a
                            href="/docs/DEVELOPMENT_FEATURES.md"
                            className="text-cyan-600 dark:text-cyan-400 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            DEVELOPMENT_FEATURES.md
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
