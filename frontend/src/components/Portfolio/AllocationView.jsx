import { useState, useEffect } from 'react';
import { Target, Calendar, Edit, TrendingUp, Settings, Trash2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatPercent } from '../../utils/portfolioUtils';
import PolicyEditorModal from './PolicyEditorModal';
import SIPPlanModal from './SIPPlanModal';

export default function AllocationView({ portfolioId, currency, refreshKey = 0 }) {
    const [policy, setPolicy] = useState(null);
    const [sipPlan, setSipPlan] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [drift, setDrift] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [showPolicyEditor, setShowPolicyEditor] = useState(false);
    const [showSIPPlanEditor, setShowSIPPlanEditor] = useState(false);

    // Drift is measured against the holdings, so a transaction booked on another
    // tab moves it. refreshKey is how that reaches here without a remount.
    useEffect(() => {
        loadAllocationData();
    }, [portfolioId, refreshKey]);

    const loadAllocationData = async () => {
        try {
            const [policyRes, sipRes, recsRes, driftRes] = await Promise.all([
                api.get(`/portfolios/${portfolioId}/policy`).catch(() => ({ data: { data: null } })),
                api.get(`/portfolios/${portfolioId}/sip-plan`).catch(() => ({ data: { data: null } })),
                api.get(`/portfolios/${portfolioId}/recommendations`).catch(() => ({ data: { data: [] } })),
                api.get(`/portfolios/${portfolioId}/drift`).catch(() => ({ data: { data: null } }))
            ]);

            setPolicy(policyRes.data.data);
            setSipPlan(sipRes.data.data);
            setRecommendations(recsRes.data.data || []);
            setDrift(driftRes.data.data);
        } catch (error) {
            console.error('Error loading allocation data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateRecommendation = async () => {
        setGenerating(true);
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            await api.post(`/portfolios/${portfolioId}/recommendations/generate`, {
                forMonth: currentMonth,
                autoApprove: false
            });
            toast.success('Recommendation generated');
            await loadAllocationData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to generate recommendation');
        } finally {
            setGenerating(false);
        }
    };

    const deletePolicy = async () => {
        if (!confirm('Delete allocation policy? This will also delete all recommendations.')) return;

        try {
            await api.delete(`/portfolios/${portfolioId}/policy`);
            toast.success('Policy deleted');
            loadAllocationData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete policy');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!policy || !sipPlan) {
        return (
            <>
                <div className="text-center py-12">
                    <Target className="w-16 h-16 text-ink-faint mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">SIP Allocation Not Configured</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Set up your allocation policy and SIP plan to get started</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => setShowPolicyEditor(true)}
                            className="bg-cyan-500 text-white px-6 py-2 rounded-lg hover:bg-cyan-600"
                        >
                            Configure Policy
                        </button>
                        {policy && !sipPlan && (
                            <button
                                onClick={() => setShowSIPPlanEditor(true)}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                            >
                                Setup SIP Plan
                            </button>
                        )}
                    </div>
                </div>

                {showPolicyEditor && (
                    <PolicyEditorModal
                        portfolioId={portfolioId}
                        existingPolicy={policy}
                        onClose={() => setShowPolicyEditor(false)}
                        onSaved={loadAllocationData}
                    />
                )}

                {showSIPPlanEditor && (
                    <SIPPlanModal
                        portfolioId={portfolioId}
                        currency={currency}
                        existingPlan={sipPlan}
                        onClose={() => setShowSIPPlanEditor(false)}
                        onSaved={loadAllocationData}
                    />
                )}
            </>
        );
    }

    return (
        <div className="space-y-6">
            {/* Policy Summary */}
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Allocation Strategy</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowPolicyEditor(true)}
                            className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 flex items-center gap-1 text-sm"
                        >
                            <Edit className="w-4 h-4" />
                            Edit
                        </button>
                        <button
                            onClick={() => setShowSIPPlanEditor(true)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                        >
                            <Settings className="w-4 h-4" />
                            SIP Plan
                        </button>
                        <button
                            onClick={deletePolicy}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 text-sm"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Strategy Type</div>
                        <div className="font-semibold text-gray-900 dark:text-white">{policy.strategyType}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Monthly SIP</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(sipPlan.monthlyAmount, currency)}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Universe</div>
                        <div className="font-semibold text-gray-900 dark:text-white">{policy.universeMode}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Execution</div>
                        <div className="font-semibold text-gray-900 dark:text-white">{sipPlan.executionMode}</div>
                    </div>
                </div>
            </div>

            {/* Drift Alert */}
            {drift?.hasDrift && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300 mb-2">
                        <TrendingUp className="w-5 h-5" />
                        <span className="font-semibold">Portfolio Drift Detected</span>
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                        {drift.drifts.length} position(s) have drifted from target weights
                    </p>
                    <div className="space-y-2">
                        {drift.drifts.map((d) => (
                            <div key={d.symbol} className="flex justify-between text-sm">
                                <span className="font-medium dark:text-white">{d.symbol}</span>
                                <span className="text-yellow-700 dark:text-yellow-400">
                                    {d.currentWeight.toFixed(1)}% → {d.targetWeight.toFixed(1)}% (Drift: {d.drift.toFixed(1)}%)
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Generate Recommendation */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Recommendations</h3>
                <button
                    onClick={generateRecommendation}
                    disabled={generating}
                    className="bg-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-cyan-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {generating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Calendar className="w-4 h-4" />
                            Generate for This Month
                        </>
                    )}
                </button>
            </div>

            {/* Recommendations List */}
            {recommendations.length === 0 ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                    No recommendations yet. Generate your first recommendation above.
                </div>
            ) : (
                <div className="space-y-4">
                    {recommendations.map((rec) => (
                        <RecommendationCard
                            key={rec._id}
                            recommendation={rec}
                            currency={currency}
                            portfolioId={portfolioId}
                            onUpdate={loadAllocationData}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {showPolicyEditor && (
                <PolicyEditorModal
                    portfolioId={portfolioId}
                    existingPolicy={policy}
                    onClose={() => setShowPolicyEditor(false)}
                    onSaved={loadAllocationData}
                />
            )}

            {showSIPPlanEditor && (
                <SIPPlanModal
                    portfolioId={portfolioId}
                    currency={currency}
                    existingPlan={sipPlan}
                    onClose={() => setShowSIPPlanEditor(false)}
                    onSaved={loadAllocationData}
                />
            )}
        </div>
    );
}

function RecommendationCard({ recommendation, currency, portfolioId, onUpdate }) {
    const statusColors = {
        DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        EXECUTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        SKIPPED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };

    const approveRecommendation = async () => {
        try {
            await api.patch(`/portfolios/${portfolioId}/recommendations/${recommendation.forMonth}/approve`);
            toast.success('Recommendation approved');
            onUpdate();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to approve recommendation');
        }
    };

    const markExecuted = async () => {
        const allocCount = recommendation.allocations?.length || 0;
        const confirmed = window.confirm(
            `Execute this recommendation?\n\n` +
            `This will create ${allocCount} BUY transactions in your portfolio.\n` +
            `You can edit the transaction details later if needed.`
        );

        if (!confirmed) return;

        try {
            const response = await api.patch(`/portfolios/${portfolioId}/recommendations/${recommendation.forMonth}/execute`);
            const transactionCount = response.data.transactions?.length || 0;
            toast.success(
                `✅ Created ${transactionCount} BUY transactions!\n\n` +
                `Switch to the "Transactions" tab to view them, or refresh the page.`,
                { duration: 6000 }
            );
            onUpdate();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to mark as executed');
        }
    };

    return (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-hairline rounded-card shadow-card hover:shadow-card-hover transition-shadow p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-hairline">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                        <Calendar className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                            {new Date(recommendation.forMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <span className="font-medium">Budget:</span>
                            <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                                {formatCurrency(recommendation.budget, currency)}
                            </span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-full text-sm font-semibold shadow-card ${statusColors[recommendation.status]}`}>
                        {recommendation.status}
                    </span>
                    {recommendation.status === 'DRAFT' && (
                        <button
                            onClick={approveRecommendation}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors shadow-card"
                        >
                            Approve
                        </button>
                    )}
                    {recommendation.status === 'APPROVED' && (
                        <button
                            onClick={markExecuted}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-card"
                        >
                            Mark Executed
                        </button>
                    )}
                </div>
            </div>

            {recommendation.allocations && recommendation.allocations.length > 0 ? (
                <div className="space-y-4">
                    {recommendation.allocations.map((alloc, index) => (
                        <div
                            key={alloc.symbol}
                            className="group bg-surface rounded-lg p-4 border border-hairline hover:border-cyan-400 dark:hover:border-cyan-500 hover:shadow-card-hover transition-all"
                        >
                            {/* Stock Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-card">
                                        <span className="text-white font-bold text-sm">{alloc.symbol.substring(0, 2)}</span>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-gray-900 dark:text-white">{alloc.symbol}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            <span className="font-medium">{alloc.estShares} shares</span>
                                            <span className="mx-2">×</span>
                                            <span>{formatCurrency(alloc.estPrice, currency)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                                        {formatCurrency(alloc.amount, currency)}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-end gap-2">
                                        <div className="flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            <span className="font-medium">{formatPercent(alloc.targetWeight, 1)}</span>
                                        </div>
                                        <span>→</span>
                                        <span>Current: {formatPercent(alloc.currentWeight, 1)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Research Links */}
                            <div className="flex items-center gap-2 pt-3 border-t border-hairline">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <Target className="w-3 h-3" />
                                    Research:
                                </span>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={`https://scstrade.com/stockscreening/SS_CompanySnapShot.aspx?symbol=${alloc.symbol}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-1 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-xs font-medium rounded transition-colors"
                                    >
                                        SCS Trade
                                    </a>
                                    <a
                                        href={`https://www.tradingview.com/symbols/PSX-${alloc.symbol}/financials-overview/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-medium rounded transition-colors"
                                    >
                                        TradingView
                                    </a>
                                    <a
                                        href={`https://stockanalysis.com/quote/psx/${alloc.symbol}/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-medium rounded transition-colors"
                                    >
                                        Stock Analysis
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-dashed border-yellow-300 dark:border-yellow-700 rounded-card">
                    <div className="text-5xl mb-3">⚠️</div>
                    <p className="text-yellow-800 dark:text-yellow-200 font-bold text-lg mb-2">No Allocations Generated</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-1">
                        Your filters might be too strict, or no stocks matched the criteria
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Try adjusting your policy settings (e.g., lower Min Dividend Yield)
                    </p>
                </div>
            )}
        </div>
    );
}

