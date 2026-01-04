import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, TrendingUp, TrendingDown, Users } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function PortfolioList() {
    const navigate = useNavigate();
    const [portfolios, setPortfolios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        loadPortfolios();
    }, []);

    const loadPortfolios = async () => {
        try {
            const response = await api.get('/portfolios');
            setPortfolios(response.data.data);
        } catch (error) {
            console.error('Error loading portfolios:', error);
            toast.error(error.response?.data?.message || 'Failed to load portfolios');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Portfolios</h1>
                    <p className="text-gray-600 mt-1">Track your investments and performance</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Portfolio
                </button>
            </div>

            {portfolios.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No portfolios yet</h3>
                    <p className="text-gray-600 mb-4">Create your first portfolio to start tracking</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700"
                    >
                        Create Portfolio
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {portfolios.map(portfolio => (
                        <PortfolioCard
                            key={portfolio._id}
                            portfolio={portfolio}
                            onClick={() => navigate(`/portfolios/${portfolio._id}`)}
                        />
                    ))}
                </div>
            )}

            {showCreateModal && (
                <CreatePortfolioModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(newPortfolio) => {
                        setPortfolios([...portfolios, newPortfolio]);
                        setShowCreateModal(false);
                        navigate(`/portfolios/${newPortfolio._id}`);
                    }}
                />
            )}
        </div>
    );
}

function PortfolioCard({ portfolio, onClick }) {
    const { totalValue = 0, totalPnL = 0, totalPnLPct = 0 } = portfolio.dashboardCache || {};
    const isProfit = totalPnL >= 0;

    return (
        <div
            onClick={onClick}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{portfolio.name}</h3>
                    {portfolio.description && (
                        <p className="text-sm text-gray-600 mt-1">{portfolio.description}</p>
                    )}
                </div>
                {portfolio.sharedWith?.length > 0 && (
                    <Users className="w-5 h-5 text-gray-400" />
                )}
            </div>

            <div className="space-y-3">
                <div>
                    <div className="text-sm text-gray-600">Total Value</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {portfolio.currency === 'USD' ? '$' : 'Rs.'} {totalValue.toLocaleString()}
                    </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                        <div className="text-sm text-gray-600">P/L</div>
                        <div className={`text-lg font-semibold ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isProfit ? '+' : ''}{portfolio.currency === 'USD' ? '$' : 'Rs.'} {totalPnL.toLocaleString()}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {isProfit ? (
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                        ) : (
                            <TrendingDown className="w-5 h-5 text-red-600" />
                        )}
                        <span className={`text-lg font-semibold ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
                            {totalPnLPct.toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>

            {portfolio.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                    {portfolio.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function CreatePortfolioModal({ onClose, onCreated }) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        calculationMethod: 'AVERAGE_COST',
        currency: 'PKR'
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const response = await api.post('/portfolios', formData);
            toast.success('Portfolio created successfully');
            onCreated(response.data.data);
        } catch (error) {
            console.error('Error creating portfolio:', error);
            toast.error(error.response?.data?.message || 'Failed to create portfolio');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Portfolio</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Portfolio Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            rows="3"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Calculation Method
                        </label>
                        <select
                            value={formData.calculationMethod}
                            onChange={(e) => setFormData({ ...formData, calculationMethod: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                            <option value="AVERAGE_COST">Average Cost (Simple)</option>
                            <option value="FIFO">FIFO (Tax Compliant)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Currency
                        </label>
                        <select
                            value={formData.currency}
                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                            <option value="PKR">PKR (Pakistani Rupee)</option>
                            <option value="USD">USD (US Dollar)</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {submitting ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
