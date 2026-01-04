import { useState, useEffect } from 'react';
import { Target, Calendar, CheckCircle, Edit, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AllocationView({ portfolioId, currency }) {
    const [policy, setPolicy] = useState(null);
    const [sipPlan, setSipPlan] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [drift, setDrift] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPolicyEditor, setShowPolicyEditor] = useState(false);

    useEffect(() => {
        loadAllocationData();
    }, [portfolioId]);

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
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            await api.post(`/portfolios/${portfolioId}/recommendations/generate`, {
                forMonth: currentMonth,
                autoApprove: false
            });
            toast.success('Recommendation generated');
            loadAllocationData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to generate recommendation');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!policy || !sipPlan) {
        return (
            <div className="text-center py-12">
                <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">SIP Allocation Not Configured</h3>
                <p className="text-gray-600 mb-4">Set up your allocation policy and SIP plan to get started</p>
                <button
                    onClick={() => setShowPolicyEditor(true)}
                    className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700"
                >
                    Configure Now
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Policy Summary */}
            <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Allocation Strategy</h3>
                    <button
                        onClick={() => setShowPolicyEditor(true)}
                        className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-sm"
                    >
                        <Edit className="w-4 h-4" />
                        Edit
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div className="text-sm text-gray-600">Strategy Type</div>
                        <div className="font-semibold text-gray-900">{policy.strategyType}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Monthly SIP</div>
                        <div className="font-semibold text-gray-900">
                            {currency === 'USD' ? '$' : 'Rs.'} {sipPlan.monthlyAmount.toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Universe</div>
                        <div className="font-semibold text-gray-900">{policy.universeMode}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Execution</div>
                        <div className="font-semibold text-gray-900">{sipPlan.executionMode}</div>
                    </div>
                </div>
            </div>

            {/* Drift Alert */}
            {drift?.hasDrift && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-800 mb-2">
                        <TrendingUp className="w-5 h-5" />
                        <span className="font-semibold">Portfolio Drift Detected</span>
                    </div>
                    <p className="text-sm text-yellow-700 mb-3">
                        {drift.drifts.length} position(s) have drifted from target weights
                    </p>
                    <div className="space-y-2">
                        {drift.drifts.map((d) => (
                            <div key={d.symbol} className="flex justify-between text-sm">
                                <span className="font-medium">{d.symbol}</span>
                                <span className="text-yellow-700">
                                    {d.currentWeight.toFixed(1)}% → {d.targetWeight.toFixed(1)}% (Drift: {d.drift.toFixed(1)}%)
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Generate Recommendation */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Monthly Recommendations</h3>
                <button
                    onClick={generateRecommendation}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                >
                    <Calendar className="w-4 h-4" />
                    Generate for This Month
                </button>
            </div>

            {/* Recommendations List */}
            {recommendations.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
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
        </div>
    );
}

function RecommendationCard({ recommendation, currency, portfolioId, onUpdate }) {
    const statusColors = {
        DRAFT: 'bg-gray-100 text-gray-700',
        APPROVED: 'bg-emerald-100 text-emerald-700',
        EXECUTED: 'bg-blue-100 text-blue-700',
        SKIPPED: 'bg-red-100 text-red-700'
    };

    const approveRecommendation = async () => {
        try {
            await api.patch(`/portfolios/${portfolioId}/recommendations/${recommendation.forMonth}/approve`);
            toast.success('Recommendation approved');
            onUpdate();
        } catch (error) {
            toast.error('Failed to approve');
        }
    };

    const markExecuted = async () => {
        try {
            await api.patch(`/portfolios/${portfolioId}/recommendations/${recommendation.forMonth}/execute`);
            toast.success('Marked as executed');
            onUpdate();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                        {new Date(recommendation.forMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h4>
                    <p className="text-sm text-gray-600">
                        Budget: {currency === 'USD' ? '$' : 'Rs.'} {recommendation.budget.toLocaleString()}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[recommendation.status]}`}>
                        {recommendation.status}
                    </span>
                    {recommendation.status === 'DRAFT' && (
                        <button
                            onClick={approveRecommendation}
                            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                        >
                            Approve
                        </button>
                    )}
                    {recommendation.status === 'APPROVED' && (
                        <button
                            onClick={markExecuted}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                            Mark Executed
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {recommendation.allocations.map((alloc) => (
                    <div key={alloc.symbol} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex-1">
                            <div className="font-semibold text-gray-900">{alloc.symbol}</div>
                            <div className="text-sm text-gray-600">
                                {alloc.estShares} shares @ {currency === 'USD' ? '$' : 'Rs.'} {alloc.estPrice.toFixed(2)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-semibold text-gray-900">
                                {currency === 'USD' ? '$' : 'Rs.'} {alloc.amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-600">
                                Target: {alloc.targetWeight.toFixed(1)}% | Current: {alloc.currentWeight.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
