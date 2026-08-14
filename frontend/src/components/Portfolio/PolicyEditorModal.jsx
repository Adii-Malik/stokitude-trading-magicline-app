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
            minPayoutRatio: 20,
            maxPositionPct: 15,
            shariahOnly: true
        },
        weights: 'Dividend Yield: 35%, Payout Safety: 50%, Quality: 15%',
        criteria: 'High dividend yield (3%+), sustainable payouts (20-120%), strong cash coverage (2x+)'
    },
    BALANCED: {
        name: 'Balanced Growth',
        description: 'Mix of dividend and growth stocks. Moderate risk, steady returns.',
        icon: '⚖️',
        strategyType: 'BALANCED',
        defaults: {
            minDividendYield: 2.0,
            minPayoutRatio: 15,
            maxPositionPct: 20,
            shariahOnly: true
        },
        weights: 'Dividend Yield: 25%, Payout Safety: 20%, Growth: 30%, Quality: 25%',
        criteria: 'Moderate dividends (2%+), balanced growth & income, stable companies'
    },
    GROWTH: {
        name: 'Aggressive Growth',
        description: 'Focus on high-growth stocks. Higher risk, higher potential returns.',
        icon: '🚀',
        strategyType: 'GROWTH',
        defaults: {
            minDividendYield: 0,
            minPayoutRatio: 0,
            maxPositionPct: 25,
            shariahOnly: true
        },
        weights: 'Growth: 50%, Quality: 30%, Dividend Yield: 10%, Payout Safety: 10%',
        criteria: 'High revenue growth (10%+), strong ROE (12%+), no dividend requirements'
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
        minPayoutRatio: 20,
        maxPositionPct: 15,
        shariahOnly: true
    });
    const [loading, setLoading] = useState(true);
    const [policyLoaded, setPolicyLoaded] = useState(false);

    useEffect(() => {
        loadHoldings();
        if (existingPolicy) {
            loadExistingPolicy();
        } else {
            setPolicyLoaded(true);
        }
    }, [portfolioId]);

    useEffect(() => {
        // Auto-update settings when goal changes ONLY if no existing policy was loaded
        if (policyLoaded && !existingPolicy) {
            const goal = INVESTMENT_GOALS[investmentGoal];
            if (goal) {
                setSettings(goal.defaults);
            }
        }
    }, [investmentGoal, policyLoaded]);

    const loadExistingPolicy = () => {
        console.log('Loading existing policy:', existingPolicy);

        // Load investment goal from strategy type FIRST
        let goalKey = 'INCOME';
        if (existingPolicy.strategyType) {
            const goal = Object.entries(INVESTMENT_GOALS).find(([_, g]) => g.strategyType === existingPolicy.strategyType);
            if (goal) {
                goalKey = goal[0];
                setInvestmentGoal(goal[0]);
            }
        }

        // Load settings from existing policy (use ?? not ||)
        const goalDefaults = INVESTMENT_GOALS[goalKey].defaults;
        const loadedSettings = {
            minDividendYield: existingPolicy.filters?.minDividendYield ?? goalDefaults.minDividendYield,
            minPayoutRatio: existingPolicy.filters?.minPayoutRatio ?? goalDefaults.minPayoutRatio,
            shariahOnly: existingPolicy.filters?.shariahOnly ?? goalDefaults.shariahOnly,
            maxPositionPct: existingPolicy.constraints?.maxPositionPct ?? goalDefaults.maxPositionPct
        };

        console.log('Loaded settings:', loadedSettings);
        setSettings(loadedSettings);

        // Load universe mode
        if (existingPolicy.universeMode) {
            setUniverseMode(existingPolicy.universeMode);
        }

        // Load selected stocks
        if (existingPolicy.allowedSymbols) {
            setSelectedStocks(existingPolicy.allowedSymbols);
        }

        setPolicyLoaded(true);
    }; const loadHoldings = async () => {
        try {
            const response = await api.get(`/portfolios/${portfolioId}/holdings`);
            const holdingsList = response.data.data || [];
            setHoldings(holdingsList);

            // Pre-select all holdings for MANUAL_LIST mode
            setSelectedStocks(holdingsList.map(h => h.symbol));

            // Auto-select universe mode based on holdings
            if (holdingsList.length === 0) {
                setUniverseMode('MARKET'); // Auto-select market scan if no holdings
            } else {
                setUniverseMode('MANUAL_LIST'); // Default to holdings if available
            }
        } catch (error) {
            console.error('Error loading holdings:', error);
            toast.error('Failed to load portfolio holdings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const goal = INVESTMENT_GOALS[investmentGoal];

            console.log('Saving with settings:', settings);

            let policyData = {
                strategyType: goal.strategyType,
                universeMode: universeMode,
                allowedSymbols: universeMode === 'MANUAL_LIST' ? selectedStocks : undefined,
            };

            // Configure based on strategy type
            if (goal.strategyType === 'DIVIDEND_GROWTH') {
                policyData = {
                    ...policyData,
                    scoringWeights: {
                        dividendYield: 0.35,
                        payoutSafety: 0.50,
                        growth: 0.00,
                        quality: 0.15
                    },
                    filters: {
                        minDividendYield: settings.minDividendYield,
                        minPayoutRatio: settings.minPayoutRatio,
                        shariahOnly: settings.shariahOnly
                    },
                    constraints: {
                        minHoldings: universeMode === 'MANUAL_LIST' && selectedStocks.length > 0
                            ? Math.min(3, selectedStocks.length)
                            : 3,
                        maxHoldings: universeMode === 'MANUAL_LIST' && selectedStocks.length > 0
                            ? selectedStocks.length
                            : 15,
                        maxPositionPct: settings.maxPositionPct
                    }
                };
                console.log('Sending policy data:', policyData);
            } else if (goal.strategyType === 'GROWTH') {
                // Growth-focused strategy - NO dividend filters
                policyData = {
                    ...policyData,
                    scoringWeights: {
                        dividendYield: 0.10,
                        payoutSafety: 0.10,
                        growth: 0.50,
                        quality: 0.30
                    },
                    filters: {
                        shariahOnly: settings.shariahOnly
                    },
                    constraints: {
                        minHoldings: universeMode === 'MANUAL_LIST' && selectedStocks.length > 0
                            ? Math.min(3, selectedStocks.length)
                            : 3,
                        maxHoldings: universeMode === 'MANUAL_LIST' && selectedStocks.length > 0
                            ? selectedStocks.length
                            : 15,
                        maxPositionPct: settings.maxPositionPct
                    }
                };
            } else if (goal.strategyType === 'BALANCED') {
                // For BALANCED with MARKET mode, use dynamic allocation based on scoring
                if (universeMode === 'MARKET' || selectedStocks.length === 0) {
                    // Balanced strategy - moderate dividend filters
                    policyData = {
                        ...policyData,
                        scoringWeights: {
                            dividendYield: 0.25,
                            payoutSafety: 0.20,
                            growth: 0.30,
                            quality: 0.25
                        },
                        filters: {
                            minDividendYield: Math.max(0, settings.minDividendYield - 1.5),
                            shariahOnly: settings.shariahOnly
                        },
                        constraints: {
                            minHoldings: 5,
                            maxHoldings: 15,
                            maxPositionPct: settings.maxPositionPct
                        }
                    };
                } else {
                    // Equal weight for selected holdings
                    const equalWeight = 100 / selectedStocks.length;
                    policyData.targets = selectedStocks.map(symbol => ({
                        symbol,
                        targetWeight: parseFloat(equalWeight.toFixed(2))
                    }));
                }
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
                                            {investmentGoal === key && (
                                                <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-cyan-200 dark:border-cyan-800">
                                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">📊 Scoring Weights:</p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400">{goal.weights}</p>
                                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2 mb-1">🎯 Selection Criteria:</p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400">{goal.criteria}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Question 2: Stock Universe */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                            2. Where should we look for stocks?
                        </h3>
                        {holdings.length === 0 && (
                            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        You don't have any holdings yet. We'll scan the entire market to find the best stocks for you!
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="space-y-3">
                            {holdings.length > 0 && (
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
                            )}

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
                                            {holdings.length === 0
                                                ? "We'll analyze all 480+ PSX stocks and pick the best ones for you!"
                                                : "Discover new opportunities from 480+ PSX stocks. Best for diversification."}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

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

                                {/* Dividend filters - only for Steady Income */}
                                {investmentGoal === 'INCOME' && (
                                    <>
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
                                                Min Payout Ratio (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.minPayoutRatio}
                                                onChange={(e) => setSettings({ ...settings, minPayoutRatio: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                                min="0"
                                                max="100"
                                                step="5"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Minimum payout ratio - stocks must pay at least this % of earnings as dividends</p>
                                        </div>
                                    </>
                                )}

                                {/* Dividend yield filter for Balanced */}
                                {investmentGoal === 'BALANCED' && (
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
                                )}

                                {/* Growth filters - only for Aggressive Growth */}
                                {investmentGoal === 'GROWTH' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Min Revenue Growth (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.minRevenueGrowth || 10}
                                                onChange={(e) => setSettings({ ...settings, minRevenueGrowth: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                                min="0"
                                                max="100"
                                                step="5"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Target high-growth companies (higher = more aggressive)</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Min ROE (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.minROE || 12}
                                                onChange={(e) => setSettings({ ...settings, minROE: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                                min="0"
                                                max="50"
                                                step="1"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Return on Equity - quality of earnings (higher = better)</p>
                                        </div>
                                    </>
                                )}

                                {/* Global settings for all strategies */}
                                <div className="border-t border-gray-300 dark:border-gray-600 pt-4 mt-4">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Global Settings</p>

                                    <div className="mb-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.shariahOnly || false}
                                                onChange={(e) => setSettings({ ...settings, shariahOnly: e.target.checked })}
                                                className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Shariah Compliant Only
                                            </span>
                                        </label>
                                        <p className="text-xs text-gray-500 mt-1 ml-6">Only invest in Shariah-compliant stocks</p>
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
