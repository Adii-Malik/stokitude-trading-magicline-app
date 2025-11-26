import { useState, useEffect } from 'react';
import { TrendingUp, Target, AlertTriangle, Play, Loader2, CheckCircle, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { triggerTradePlanCheck, mockTradePlanScenario, resetTradePlan } from '../../services/notifications';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function TradePlanTester() {
    const [loading, setLoading] = useState({});
    const [tradePlans, setTradePlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [results, setResults] = useState([]);

    useEffect(() => {
        loadTradePlans();
    }, []);

    const loadTradePlans = async () => {
        try {
            setLoadingPlans(true);
            const response = await api.get('/trade-plans');
            console.log('Trade plans loaded:', response.data);

            // API returns data.plans array
            const allPlans = response.data.data?.plans || response.data.plans || [];

            // Transform to ensure correct field names
            const formattedPlans = allPlans.map(plan => ({
                ...plan,
                // Map API fields to expected format
                buyLevels: plan.buyLevels?.map(level => ({
                    ...level,
                    minPrice: level.priceFrom || level.minPrice,
                    maxPrice: level.priceTo || level.maxPrice
                })) || [],
                targetPrices: plan.targetPrices || []
            }));

            setTradePlans(formattedPlans);
            if (formattedPlans.length > 0) {
                setSelectedPlan(formattedPlans[0]._id);
            }
        } catch (error) {
            console.error('Error loading trade plans:', error);
            toast.error(`Failed to load trade plans: ${error.message}`);
        } finally {
            setLoadingPlans(false);
        }
    };

    const handleTriggerCheck = async () => {
        try {
            setLoading({ check: true });
            const response = await triggerTradePlanCheck();

            addResult({
                type: 'success',
                title: 'Trade Plan Check Completed',
                message: `Checked: ${response.data.checked}, Updated: ${response.data.updated}`,
                timestamp: new Date()
            });

            toast.success(`Checked ${response.data.checked} trade plans, ${response.data.updated} updates`);

            // Reload trade plans to see updated statuses
            await loadTradePlans();
        } catch (error) {
            console.error('Error triggering check:', error);
            addResult({
                type: 'error',
                title: 'Check Failed',
                message: error.response?.data?.message || error.message,
                timestamp: new Date()
            });
            toast.error('Failed to trigger trade plan check');
        } finally {
            setLoading({ check: false });
        }
    };

    const handleMockScenario = async (scenario) => {
        if (!selectedPlan) {
            toast.error('Please select a trade plan');
            return;
        }

        try {
            setLoading({ [scenario]: true });
            const response = await mockTradePlanScenario(selectedPlan, scenario);

            addResult({
                type: 'success',
                title: `${scenario.replace('_', ' ').toUpperCase()} Test Completed`,
                message: `${response.message} - Mock price: Rs. ${response.data.mockPrice}`,
                details: response.data.scenarioDescription,
                timestamp: new Date()
            });

            toast.success(`Test completed! Check your notifications.`);

            // Reload trade plans to see updated statuses
            await loadTradePlans();
        } catch (error) {
            console.error('Error mocking scenario:', error);
            addResult({
                type: 'error',
                title: 'Mock Failed',
                message: error.response?.data?.message || error.message,
                timestamp: new Date()
            });
            toast.error(error.response?.data?.message || 'Failed to mock scenario');
        } finally {
            setLoading({ [scenario]: false });
        }
    };

    const handleResetPlan = async () => {
        if (!selectedPlan) {
            toast.error('Please select a trade plan');
            return;
        }

        try {
            setLoading({ reset: true });
            const response = await resetTradePlan(selectedPlan);

            addResult({
                type: 'success',
                title: 'Trade Plan Reset',
                message: `${response.data.symbol} reset to initial state - All levels unmarked`,
                timestamp: new Date()
            });

            toast.success('Trade plan reset successfully!');

            // Reload trade plans to see reset state
            await loadTradePlans();
        } catch (error) {
            console.error('Error resetting trade plan:', error);
            addResult({
                type: 'error',
                title: 'Reset Failed',
                message: error.response?.data?.message || error.message,
                timestamp: new Date()
            });
            toast.error('Failed to reset trade plan');
        } finally {
            setLoading({ reset: false });
        }
    };

    const addResult = (result) => {
        setResults(prev => [result, ...prev].slice(0, 10));
    };

    const getSelectedPlanDetails = () => {
        return tradePlans.find(p => p._id === selectedPlan);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Trade Plan Testing
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Test trade plan monitoring: buy levels, targets, and stop loss triggers
                </p>
            </div>

            {/* Manual Check Trigger */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                            Trigger Trade Plan Check
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Manually run the trade plan monitoring process for all active plans
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

            {/* Trade Plan Selector & Scenario Tests */}
            {!loadingPlans && tradePlans.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                        Mock Trade Plan Scenarios
                    </h4>

                    {/* Plan Selector */}
                    <select
                        value={selectedPlan || ''}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="w-full mb-4 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                    >
                        {tradePlans.map((plan) => (
                            <option key={plan._id} value={plan._id}>
                                {plan.symbol} - {plan.companyName} ({plan.tradeType.toUpperCase()}) {!plan.isActive ? '[INACTIVE]' : ''}
                            </option>
                        ))}
                    </select>

                    {/* Plan Details */}
                    {getSelectedPlanDetails() && (
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs">
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                                    <span className={`ml-2 font-medium ${getSelectedPlanDetails().isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {getSelectedPlanDetails().isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Buy Levels:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">
                                        {getSelectedPlanDetails().buyLevels.filter(l => !l.isHit).length}/{getSelectedPlanDetails().buyLevels.length} pending
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Targets:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">
                                        {getSelectedPlanDetails().targetPrices.filter(t => !t.isHit).length}/{getSelectedPlanDetails().targetPrices.length} pending
                                    </span>
                                </div>
                                <div className="col-span-3">
                                    <span className="text-gray-500 dark:text-gray-400">Stop Loss:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">
                                        Rs. {getSelectedPlanDetails().stopLoss.price} {getSelectedPlanDetails().stopLoss.isHit ? '(Hit ❌)' : '(Pending ⏳)'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scenario Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Buy Level */}
                        <button
                            onClick={() => handleMockScenario('buy_level')}
                            disabled={loading.buy_level || !selectedPlan}
                            className="bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {loading.buy_level ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <TrendingUp className="w-4 h-4" />
                                    Buy Level
                                </>
                            )}
                        </button>

                        {/* Target */}
                        <button
                            onClick={() => handleMockScenario('target')}
                            disabled={loading.target || !selectedPlan}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {loading.target ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <Target className="w-4 h-4" />
                                    Target
                                </>
                            )}
                        </button>

                        {/* Stop Loss */}
                        <button
                            onClick={() => handleMockScenario('stop_loss')}
                            disabled={loading.stop_loss || !selectedPlan}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {loading.stop_loss ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="w-4 h-4" />
                                    Stop Loss
                                </>
                            )}
                        </button>
                    </div>

                    {/* Reset Button */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleResetPlan}
                            disabled={loading.reset || !selectedPlan}
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white rounded-lg py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {loading.reset ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Resetting...
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="w-4 h-4" />
                                    Reset Plan to Initial State
                                </>
                            )}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                            Resets all buy levels, targets, and stop loss to unhit state
                        </p>
                    </div>
                </div>
            )}

            {/* No Plans Message */}
            {!loadingPlans && tradePlans.length === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        No trade plans found
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                        To test trade plan scenarios, you need to create a trade plan first.
                    </p>
                    <button
                        onClick={() => window.location.href = '/trade-plans'}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg py-2 px-4 text-sm font-medium transition"
                    >
                        Go to Trade Plans Page
                    </button>
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
                    <strong>Testing Workflow:</strong>
                </p>
                <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-2 ml-4 list-decimal">
                    <li>
                        <strong>Select a trade plan</strong> from the dropdown
                    </li>
                    <li>
                        <strong>Test scenarios:</strong> Click Buy Level, Target, or Stop Loss to test each stage
                    </li>
                    <li>
                        <strong>Reset plan:</strong> Use "Reset Plan" button to clear all hits and test again
                    </li>
                    <li>
                        <strong>Check notifications:</strong> Each test triggers real notifications
                    </li>
                </ol>
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                        <strong>📋 Test Requirements:</strong>
                    </p>
                    <ul className="text-xs text-blue-700 dark:text-blue-400 ml-4 space-y-1 list-disc">
                        <li>Targets and Stop Loss require a buy level to be hit first (matches production)</li>
                        <li>Each test uses actual production logic - price set → handler runs → price restored</li>
                        <li>Reset button unmarks all levels so you can test the same plan multiple times</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
