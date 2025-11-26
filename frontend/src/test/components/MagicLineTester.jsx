import { useState, useEffect } from 'react';
import { TrendingUp, Play, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { triggerMagicLineCheck, mockMagicLineMet } from '../../services/notifications';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function MagicLineTester() {
    const [loading, setLoading] = useState({});
    const [magicLines, setMagicLines] = useState([]);
    const [loadingMagicLines, setLoadingMagicLines] = useState(true);
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [results, setResults] = useState([]);

    useEffect(() => {
        loadMagicLines();
    }, []);

    const loadMagicLines = async () => {
        try {
            setLoadingMagicLines(true);
            const response = await api.get('/magic-line');
            console.log('Magic lines loaded:', response.data);

            // API returns symbols array, not data array
            const allLines = response.data.symbols || response.data.data || [];

            // Transform to expected format if needed
            const formattedLines = allLines.map(line => ({
                symbol: line.symbol,
                companyName: line.companyName || line.symbol, // Use symbol if companyName not available
                magicLine: line.magicLine,
                currentPrice: line.currentPrice,
                status: line.isMet ? 'met' : 'pending',
                isActive: true // Assume all returned lines are active
            }));

            setMagicLines(formattedLines);

            if (formattedLines.length > 0) {
                setSelectedSymbol(formattedLines[0].symbol);
            } else {
                console.warn('No magic lines found in response');
            }
        } catch (error) {
            console.error('Error loading magic lines:', error);
            toast.error(`Failed to load magic lines: ${error.message}`);
        } finally {
            setLoadingMagicLines(false);
        }
    };

    const handleTriggerCheck = async () => {
        try {
            setLoading({ check: true });
            const response = await triggerMagicLineCheck();

            addResult({
                type: 'success',
                title: 'Strategic Level Check Completed',
                message: `Checked: ${response.data.checked}, Updated: ${response.data.updated}`,
                timestamp: new Date()
            });

            toast.success(`Checked ${response.data.checked} symbols, ${response.data.updated} status changes`);

            // Reload magic lines to see updated statuses
            await loadMagicLines();
        } catch (error) {
            console.error('Error triggering check:', error);
            addResult({
                type: 'error',
                title: 'Check Failed',
                message: error.response?.data?.message || error.message,
                timestamp: new Date()
            });
            toast.error('Failed to trigger strategic level check');
        } finally {
            setLoading({ check: false });
        }
    };

    const handleMockMagicLine = async () => {
        if (!selectedSymbol) {
            toast.error('Please select a symbol');
            return;
        }

        try {
            setLoading({ mock: true });
            const response = await mockMagicLineMet(selectedSymbol);

            addResult({
                type: 'success',
                title: `Strategic Level Test: ${selectedSymbol}`,
                message: `Test completed - Mock price: Rs. ${response.data.mockPrice}`,
                details: `Production handler executed. Original price: ${response.data.originalPrice ? `Rs. ${response.data.originalPrice}` : 'N/A'}`,
                timestamp: new Date()
            });

            toast.success(`Test completed for ${selectedSymbol}! Check your notifications.`);

            // Reload magic lines to see updated status
            await loadMagicLines();
        } catch (error) {
            console.error('Error mocking magic line:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
            const errorDetails = error.response?.status
                ? `HTTP ${error.response.status}: ${errorMsg}`
                : errorMsg;

            addResult({
                type: 'error',
                title: 'Mock Failed',
                message: errorDetails,
                details: error.response?.data?.error || 'Check browser console for details',
                timestamp: new Date()
            });
            toast.error(errorMsg);
        } finally {
            setLoading({ mock: false });
        }
    };

    const addResult = (result) => {
        setResults(prev => [result, ...prev].slice(0, 10));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Strategic Level Testing
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Test strategic level monitoring and notification system
                </p>
            </div>

            {/* Test Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Manual Check Trigger */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                                Trigger Strategic Level Check
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Manually run the strategic level monitoring process
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleTriggerCheck}
                        disabled={loading.check}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {loading.check ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                Run Check Now
                            </>
                        )}
                    </button>
                </div>

                {/* Mock Magic Line Met */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                                Mock Strategic Level Met
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Simulate a symbol reaching its strategic level
                            </p>
                        </div>
                    </div>

                    {loadingMagicLines ? (
                        <div className="text-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                        </div>
                    ) : magicLines.length === 0 ? (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                                No strategic levels found
                            </p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                                Create a strategic level first to test notifications.
                            </p>
                            <button
                                onClick={() => window.location.href = '/magic-line'}
                                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg py-2 px-4 text-sm font-medium transition"
                            >
                                Go to Strategic Level Page
                            </button>
                        </div>
                    ) : (
                        <>
                            <select
                                value={selectedSymbol}
                                onChange={(e) => setSelectedSymbol(e.target.value)}
                                className="w-full mb-3 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                            >
                                {magicLines.map((ml) => (
                                    <option key={ml.symbol} value={ml.symbol}>
                                        {ml.symbol} - {ml.companyName} (Rs. {ml.magicLine}) {!ml.isActive ? '[INACTIVE]' : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                {magicLines.length} strategic level{magicLines.length !== 1 ? 's' : ''} available for testing
                            </p>
                            <button
                                onClick={handleMockMagicLine}
                                disabled={loading.mock || !selectedSymbol}
                                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                {loading.mock ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <TrendingUp className="w-4 h-4" />
                                        Mock Level Met
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Magic Lines List */}
            {!loadingMagicLines && magicLines.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Strategic Levels ({magicLines.length}) - Showing first 10
                        </h4>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                        {magicLines.slice(0, 10).map((ml) => (
                            <div key={ml.symbol} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {ml.symbol}
                                        {!ml.isActive && (
                                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Inactive)</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {ml.companyName}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        Rs. {ml.magicLine}
                                    </p>
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ml.status === 'met'
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                            }`}
                                    >
                                        {ml.status === 'met' ? 'Met' : 'Pending'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Test Results Log */}
            {results.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-white">Test Results</h4>
                        <button
                            onClick={() => setResults([])}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                        {results.map((result, index) => (
                            <div key={index} className="px-4 py-3">
                                <div className="flex items-start gap-3">
                                    {result.type === 'success' ? (
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {result.title}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            {result.message}
                                        </p>
                                        {result.details && (
                                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                                                ℹ️ {result.details}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            {result.timestamp.toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-200 mb-2">
                    <strong>How it works:</strong>
                </p>
                <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-2 ml-4 list-disc">
                    <li>
                        <strong>Run Check Now:</strong> Manually triggers the magic line monitoring system to check all active symbols
                    </li>
                    <li>
                        <strong>Mock Level Met:</strong> Temporarily sets a mock price above the magic line and runs the actual production logic
                    </li>
                </ul>
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                        <strong>🔄 2-Step Test Process:</strong>
                    </p>
                    <ol className="text-xs text-blue-700 dark:text-blue-400 ml-4 space-y-1 list-decimal">
                        <li><strong>Step 1:</strong> Set price <em>below</em> magic line → Run handler → Status becomes "pending"</li>
                        <li><strong>Step 2:</strong> Set price <em>above</em> magic line → Run handler → Status becomes "met" & notification sent</li>
                    </ol>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                        ℹ️ This simulates the complete pending→met cycle exactly as it works in production.
                        Original price and status are restored after test.
                    </p>
                </div>
            </div>
        </div>
    );
}
