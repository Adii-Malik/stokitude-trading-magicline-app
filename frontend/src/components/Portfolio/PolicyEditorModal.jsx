import { useState, useEffect } from 'react';
import { X, Info, Check, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const INVESTMENT_GOALS = {
    INCOME: {
        name: 'Steady Income',
        description: 'Focus on dividend-paying stocks for regular income. Conservative and stable.',
        icon: '💰',
        strategyType: 'DIVIDEND_GROWTH',
        defaults: {
            minDividendYield: 3.0,
            maxPayoutRatio: 85,
            maxPositionPct: 15
        }
    },
    BALANCED: {
        name: 'Balanced Growth',
        description: 'Mix of dividend and growth stocks. Moderate risk, steady returns.',
        icon: '⚖️',
        strategyType: 'BALANCED',
        defaults: {
            minDividendYield: 2.0,
            maxPayoutRatio: 90,
            maxPositionPct: 20
        }
    },
    GROWTH: {
        name: 'Aggressive Growth',
        description: 'Focus on high-growth stocks. Higher risk, higher potential returns.',
        icon: '🚀',
        strategyType: 'GROWTH',
        defaults: {
            minDividendYield: 0,
            maxPayoutRatio: 100,
            maxPositionPct: 25
        }
    }
};

export default function PolicyEditorModal({ portfolioId, existingPolicy, onClose, onSaved }) {
    const [investmentGoal, setInvestmentGoal] = useState('INCOME');
    const [universeMode, setUniverseMode] = useState('MANUAL_LIST');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [holdings, setHoldings] = useState([]);
    const [selectedStocks, setSelectedStocks] = useState([]);
    const [settings, setSettings] = useState({
        minDividendYield: 3.0,
        maxPayoutRatio: 85,
        maxPositionPct: 15
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHoldings();
    }, [portfolioId]);

    useEffect(() => {
        // Auto-update settings when goal changes
        const goal = INVESTMENT_GOALS[investmentGoal];
        if (goal) {
            setSettings(goal.defaults);
        }
    }, [investmentGoal]);

    const loadHoldings = async () => {
        try {
            const response = await api.get(`/portfolios/${portfolioId}/holdings`);
            const holdingsList = response.data.data || [];
            setHoldings(holdingsList);

            // Pre-select all holdings for MANUAL_LIST mode
            setSelectedStocks(holdingsList.map(h => h.symbol));

            // Auto-select universe mode based on holdings
            if (holdingsList.length === 0) {
                setUniverseMode('MARKET'); // Force market scan if no holdings
            }
        } catch (error) {
            console.error('Error loading holdings:', error);
            toast.error('Failed to load portfolio holdings');
        } finally {
            setLoading(false);
        }
    };

    const toggleStock = (symbol) => {
        setSelectedStocks(prev =>
            prev.includes(symbol)
                ? prev.filter(s => s !== symbol)
                : [...prev, symbol]
        );
    };

    const handleSave = async () => {
        try {
            const goal = INVESTMENT_GOALS[investmentGoal];

            let policyData = {
                strategyType: goal.strategyType,
                universeMode: universeMode,
                allowedSymbols: universeMode === 'MANUAL_LIST' ? selectedStocks : undefined,
            };

            // Configure based on strategy type
            if (goal.strategyType === 'DIVIDEND_GROWTH' || goal.strategyType === 'GROWTH') {
                policyData = {
                    ...policyData,
                    scoringWeights: {
                        dividendYield: goal.strategyType === 'DIVIDEND_GROWTH' ? 0.40 : 0.20,
                        payoutSafety: 0.25,
                        growth: goal.strategyType === 'GROWTH' ? 0.40 : 0.20,
                        quality: 0.15
                    },
                    filters: {
                        minDividendYield: settings.minDividendYield,
                        maxPayoutRatio: settings.maxPayoutRatio
                    },
                    constraints: {
                        minHoldings: universeMode === 'MANUAL_LIST' ? Math.min(3, selectedStocks.length) : 3,
                        maxHoldings: universeMode === 'MANUAL_LIST' ? selectedStocks.length : 15,
                        maxPositionPct: settings.maxPositionPct
                    }
                };
            } else if (goal.strategyType === 'BALANCED') {
                // Equal weight for all selected
                const equalWeight = 100 / selectedStocks.length;
                policyData.targets = selectedStocks.map(symbol => ({
                    symbol,
                    targetWeight: parseFloat(equalWeight.toFixed(2))
                }));
            }

            await api.put(`/portfolios/${portfolioId}/policy`, policyData);
            toast.success('SIP policy saved successfully!');
            onSaved();
            onClose();
        } catch (error) {
            console.error('Error saving policy:', error);
            toast.error(error.response?.data?.message || 'Failed to save policy');
        }
    };


    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto"></div>
                </div>
            </div>
        );
    }

    if (holdings.length === 0) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                    <div className="text-center">
                        <Info className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            No Holdings Found
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Add some stocks to your portfolio first, then setup SIP allocation policy.
                        </p>
                        <button
                            onClick={onClose}
                            className="bg-cyan-500 text-white px-6 py-2 rounded-lg hover:bg-cyan-600"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Setup SIP Allocation
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Quick setup - just 2 questions
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Question 1: Investment Goal */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                            1. What's your investment goal?
                        </h3>
                        <div className="space-y-3">
                            {Object.entries(INVESTMENT_GOALS).map(([key, goal]) => (
                                <button
                                    key={key}
                                    onClick={() => setInvestmentGoal(key)}
                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${investmentGoal === key
                                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-cyan-300'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">{goal.icon}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                                    {goal.name}
                                                </h4>
                                                {investmentGoal === key && (
                                                    <Check className="w-5 h-5 text-cyan-500" />
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                {goal.description}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Question 2: Stock Universe */}
                    {holdings.length > 0 && (
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                                2. Where should we look for stocks?
                            </h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => setUniverseMode('MANUAL_LIST')}
                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${universeMode === 'MANUAL_LIST'
                                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-cyan-300'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">📋</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                                    My Current Holdings
                                                </h4>
                                                {universeMode === 'MANUAL_LIST' && (
                                                    <Check className="w-5 h-5 text-cyan-500" />
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                Optimize your existing {holdings.length} stocks. Best for regular monthly SIP.
                                            </p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setUniverseMode('MARKET')}
                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${universeMode === 'MARKET'
                                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-cyan-300'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">🌍</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                                    Scan Entire Market
                                                </h4>
                                                {universeMode === 'MARKET' && (
                                                    <Check className="w-5 h-5 text-cyan-500" />
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                Discover new opportunities from 480+ PSX stocks. Best for diversification.
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                    )}

                    {/* Advanced Settings (Collapsible) */}
                    <div className="space-y-4">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-lg">⚙️</span>
                                <span className="font-medium text-gray-900 dark:text-white">Advanced Settings</span>
                            </div>
                            {showAdvanced ? (
                                <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                        </button>

                        {showAdvanced && (
                            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4 bg-blue-50 dark:bg-blue-900/20">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    Fine-tune the AI scoring algorithm to match your risk profile
                                </p>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Min Dividend Yield (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.minDividendYield}
                                        onChange={(e) => setSettings({ ...settings, minDividendYield: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                        min="0"
                                        max="20"
                                        step="0.5"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Only buy stocks yielding above this</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Max Payout Ratio (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.maxPayoutRatio}
                                        onChange={(e) => setSettings({ ...settings, maxPayoutRatio: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                        min="0"
                                        max="100"
                                        step="5"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Avoid unsustainable dividends (lower = safer)</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Max Position Size (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.maxPositionPct}
                                        onChange={(e) => setSettings({ ...settings, maxPositionPct: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                        min="5"
                                        max="50"
                                        step="5"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Maximum % of portfolio in one stock (lower = more diversified)</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Rebalance Alert Threshold (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.rebalanceThreshold}
                                        onChange={(e) => setSettings({ ...settings, rebalanceThreshold: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                        min="1"
                                        max="50"
                                        step="1"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Get notified when stock drifts this much from target
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 flex items-center gap-2"
                    >
                        Save & Generate Recommendation
                    </button>
                </div>
            </div>
        </div>
    );
}
