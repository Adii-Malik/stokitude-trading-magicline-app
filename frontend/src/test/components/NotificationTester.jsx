import { useState, useEffect } from 'react';
import { Bell, TestTube, Send, Loader2, CheckCircle, AlertCircle, Mail, Info, Bug } from 'lucide-react';
import {
    sendTestNotification,
    testAdminNotification,
    getEmailDebugInfo,
    sendTestEmail
} from '../../services/notifications';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function NotificationTester() {
    const [loading, setLoading] = useState({});
    const [results, setResults] = useState([]);
    const [emailDebug, setEmailDebug] = useState(null);
    const [showDebug, setShowDebug] = useState(false);
    const { user } = useAuth();

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    useEffect(() => {
        loadEmailDebugInfo();
    }, []);

    const loadEmailDebugInfo = async () => {
        try {
            const result = await getEmailDebugInfo();
            setEmailDebug(result.data);
        } catch (error) {
            console.error('Error loading email debug info:', error);
        }
    };

    const handleTestEmail = async () => {
        setLoading(prev => ({ ...prev, email: true }));
        try {
            const result = await sendTestEmail();

            setResults(prev => [{
                id: 'email',
                label: 'Direct Email Test',
                success: true,
                message: result.message || 'Test email sent successfully! Check your inbox.',
                timestamp: new Date(),
                data: result.data
            }, ...prev].slice(0, 10));

            toast.success('Test email sent! Check your inbox.');
        } catch (error) {
            console.error('Error sending test email:', error);

            setResults(prev => [{
                id: 'email',
                label: 'Direct Email Test',
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to send test email',
                timestamp: new Date()
            }, ...prev].slice(0, 10));

            toast.error('Failed to send test email');
        } finally {
            setLoading(prev => ({ ...prev, email: false }));
        }
    };

    const testNotifications = [
        {
            id: 'basic',
            label: 'Basic System Notification',
            description: 'Test the basic notification system',
            icon: '🔔',
            category: 'system',
            action: async () => {
                const result = await sendTestNotification();
                return result;
            }
        },
        {
            id: 'admin_signal',
            label: 'Admin - Signal Generated',
            description: 'Trading signal notification (ENGRO)',
            icon: '👨‍💼',
            category: 'admin',
            adminOnly: true,
            action: async () => {
                const result = await testAdminNotification();
                return result;
            }
        }
    ];

    const handleTest = async (test) => {
        setLoading(prev => ({ ...prev, [test.id]: true }));

        try {
            const result = await test.action();

            setResults(prev => [{
                id: test.id,
                label: test.label,
                success: true,
                message: result.message || 'Notification sent successfully',
                timestamp: new Date()
            }, ...prev].slice(0, 10)); // Keep last 10 results

            toast.success(result.message || 'Test notification sent!');
        } catch (error) {
            console.error(`Error testing ${test.id}:`, error);

            setResults(prev => [{
                id: test.id,
                label: test.label,
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to send notification',
                timestamp: new Date()
            }, ...prev].slice(0, 10));

            toast.error('Failed to send test notification');
        } finally {
            setLoading(prev => ({ ...prev, [test.id]: false }));
        }
    };

    const handleTestAll = async () => {
        for (const test of testNotifications) {
            if (test.adminOnly && !isAdmin) continue;
            await handleTest(test);
            // Add small delay between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    const clearResults = () => {
        setResults([]);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <TestTube className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                            Notification Tester
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Manually trigger notifications to test the system
                        </p>
                    </div>
                    <button
                        onClick={handleTestAll}
                        className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-sm font-medium flex items-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                        Test All
                    </button>
                </div>
            </div>

            {/* Test Buttons */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Test Notifications
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {testNotifications
                        .filter(test => !test.adminOnly || isAdmin)
                        .map((test) => (
                            <div
                                key={test.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-cyan-500 dark:hover:border-cyan-400 transition"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">{test.icon}</span>
                                        <div>
                                            <h4 className="font-semibold text-gray-900 dark:text-white">
                                                {test.label}
                                            </h4>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                {test.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleTest(test)}
                                    disabled={loading[test.id]}
                                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading[test.id] ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Test Now
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                </div>
            </div>

            {/* Results Log */}
            {results.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Test Results
                        </h3>
                        <button
                            onClick={clearResults}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            Clear
                        </button>
                    </div>

                    <div className="space-y-2">
                        {results.map((result, index) => (
                            <div
                                key={`${result.id}-${index}`}
                                className={`flex items-start gap-3 p-3 rounded-lg ${result.success
                                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                    }`}
                            >
                                {result.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={`text-sm font-medium ${result.success
                                            ? 'text-green-800 dark:text-green-200'
                                            : 'text-red-800 dark:text-red-200'
                                            }`}>
                                            {result.label}
                                        </p>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {result.timestamp.toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className={`text-sm mt-1 ${result.success
                                        ? 'text-green-700 dark:text-green-300'
                                        : 'text-red-700 dark:text-red-300'
                                        }`}>
                                        {result.message}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Email Testing Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            Email Testing
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Test email delivery and configuration
                        </p>
                    </div>
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-xs font-medium flex items-center gap-2"
                    >
                        <Bug className="w-3.5 h-3.5" />
                        {showDebug ? 'Hide' : 'Show'} Debug Info
                    </button>
                </div>

                {/* Email Debug Info */}
                {showDebug && emailDebug && (
                    <div className="mb-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            Configuration Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 mb-1">Your Email:</p>
                                <p className="font-mono text-gray-900 dark:text-white">{emailDebug.user.email}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 mb-1">Email Notifications:</p>
                                <p className={`font-medium ${emailDebug.preferences.emailChannel.enabled ? 'text-green-600' : 'text-red-600'}`}>
                                    {emailDebug.preferences.emailChannel.enabled ? '✓ Enabled' : '✗ Disabled'}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 mb-1">Email Provider:</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {emailDebug.emailService.provider || 'Console Only'}
                                    {emailDebug.emailService.initialized && ' ✓'}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 mb-1">From Address:</p>
                                <p className="font-mono text-gray-900 dark:text-white text-xs">{emailDebug.config.fromEmail}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Send Test Email Button */}
                <button
                    onClick={handleTestEmail}
                    disabled={loading.email}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading.email ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending Test Email...
                        </>
                    ) : (
                        <>
                            <Mail className="w-5 h-5" />
                            Send Test Email to {user?.email || 'Your Inbox'}
                        </>
                    )}
                </button>

                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                    This will send a direct test email to your registered email address
                </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    How to Test
                </h3>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <li className="flex items-start gap-2">
                        <span className="font-bold mt-0.5">1.</span>
                        <span>Click any "Test Now" button above to trigger a notification</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="font-bold mt-0.5">2.</span>
                        <span>Check the bell icon in the header - it should show a badge (+1)</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="font-bold mt-0.5">3.</span>
                        <span>Click the bell to see the notification in the dropdown</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="font-bold mt-0.5">4.</span>
                        <span>If email is enabled, check your inbox for the email notification</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="font-bold mt-0.5">5.</span>
                        <span>Go to Notifications page to see full details and filter by category</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
