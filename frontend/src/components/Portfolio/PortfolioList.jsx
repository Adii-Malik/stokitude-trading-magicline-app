import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, TrendingUp, TrendingDown, Users, MoreVertical, Edit2, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatPercent, getPnLColorClass } from '../../utils/portfolioUtils';
import CommissionSlabEditor from './CommissionSlabEditor';
import OtherChargesEditor from './OtherChargesEditor';

export default function PortfolioList() {
    const navigate = useNavigate();
    const [portfolios, setPortfolios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingPortfolio, setEditingPortfolio] = useState(null);

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

    const handleDelete = async (portfolioId, e) => {
        e.stopPropagation();

        if (!confirm('Are you sure you want to delete this portfolio? This action cannot be undone.')) {
            return;
        }

        try {
            await api.delete(`/portfolios/${portfolioId}`);
            toast.success('Portfolio deleted');
            loadPortfolios();
        } catch (error) {
            console.error('Error deleting portfolio:', error);
            toast.error(error.response?.data?.message || 'Failed to delete portfolio');
        }
    };

    const handleEdit = (portfolio, e) => {
        e.stopPropagation();
        setEditingPortfolio(portfolio);
    }; if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-muted">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Portfolios</h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">Track your investments and performance</p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 shrink-0 whitespace-nowrap bg-cyan-500 hover:bg-cyan-600 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-card"
                        >
                            <Plus className="w-5 h-5 shrink-0" />
                            New Portfolio
                        </button>
                    </div>

                    {portfolios.length === 0 ? (
                        <div className="text-center py-12 bg-surface rounded-card border-2 border-dashed border-gray-300 dark:border-gray-700">
                            <FolderOpen className="w-16 h-16 text-ink-faint mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No portfolios yet</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first portfolio to start tracking</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="bg-cyan-500 hover:bg-cyan-600 text-white font-medium px-6 py-2 rounded-lg transition-colors shadow-card"
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
                                    onDelete={handleDelete}
                                    onEdit={handleEdit}
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

                    {editingPortfolio && (
                        <CreatePortfolioModal
                            portfolio={editingPortfolio}
                            onClose={() => setEditingPortfolio(null)}
                            onCreated={() => {
                                loadPortfolios();
                                setEditingPortfolio(null);
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function PortfolioCard({ portfolio, onClick, onDelete, onEdit }) {
    const { totalValue = 0, totalPnL = 0, totalPnLPct = 0 } = portfolio.dashboardCache || {};
    const isProfit = totalPnL >= 0;
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div
            className="bg-surface rounded-card shadow-card hover:shadow-dialog border border-hairline p-6 transition-all hover:-translate-y-1 cursor-pointer relative group"
        >
            {/* Three-dot menu */}
            <div className="absolute top-4 right-4">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                    <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-surface rounded-lg shadow-card border border-hairline py-1 z-10">
                        <button
                            onClick={(e) => {
                                setShowMenu(false);
                                onEdit(portfolio, e);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                            <Edit2 className="w-4 h-4" />
                            Edit portfolio
                        </button>
                        <button
                            onClick={(e) => {
                                setShowMenu(false);
                                onDelete(portfolio._id, e);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            <div onClick={onClick}>
                <div className="flex items-start justify-between mb-4 pr-8">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{portfolio.name}</h3>
                        {portfolio.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{portfolio.description}</p>
                        )}
                    </div>
                    {portfolio.sharedWith?.length > 0 && (
                        <Users className="w-5 h-5 text-ink-faint" />
                    )}
                </div>

                <div className="space-y-3">
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Value</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(totalValue, portfolio.currency)}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-hairline">
                        <div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">P/L</div>
                            <div className={`text-lg font-semibold ${getPnLColorClass(totalPnL)}`}>
                                {formatCurrency(totalPnL, portfolio.currency, { signed: true })}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {isProfit ? (
                                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                                <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                            )}
                            <span className={`text-lg font-semibold ${getPnLColorClass(totalPnL)}`}>
                                {formatPercent(totalPnLPct)}
                            </span>
                        </div>
                    </div>
                </div>

                {portfolio.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {portfolio.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CreatePortfolioModal({ portfolio, onClose, onCreated }) {
    const [formData, setFormData] = useState({
        name: portfolio?.name || '',
        description: portfolio?.description || '',
        currency: portfolio?.currency || 'PKR',

        commissionSlabs: portfolio?.commissionSlabs || [],
        charges: portfolio?.charges || []
    });
    const [submitting, setSubmitting] = useState(false);

    // PKR is PSX here, and PSX is the only market whose fees and settlement
    // this form knows how to describe.
    const isPSX = (formData.currency || 'PKR').toUpperCase() === 'PKR';


    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        // Slabs typed before switching to USD are still in state but no longer on
        // screen, and they describe a market this book does not trade on.
        const payload = isPSX ? formData : { ...formData, commissionSlabs: [], charges: [] };

        try {
            let response;
            if (portfolio) {
                response = await api.put(`/portfolios/${portfolio._id}`, payload);
                toast.success('Portfolio updated');
            } else {
                response = await api.post('/portfolios', payload);
                toast.success('Portfolio created');
            }
            onCreated(response.data.data);
        } catch (error) {
            console.error('Error saving portfolio:', error);
            toast.error(error.response?.data?.message || 'Failed to save portfolio');
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div
                className="bg-surface rounded-card shadow-dialog w-full max-w-2xl max-h-[90vh] flex flex-col my-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-hairline shrink-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {portfolio ? 'Edit Portfolio' : 'Create New Portfolio'}
                    </h2>
                    <button
                        type="button" onClick={onClose} aria-label="Close"
                        className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
                    <div className="overflow-y-auto px-6 py-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Portfolio Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                rows="3"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Currency
                            </label>

                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                disabled={!!portfolio}
                            >
                                <option value="PKR">PKR (Pakistani Rupee)</option>
                                <option value="USD">USD (US Dollar)</option>
                            </select>
                            {portfolio && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Currency cannot be changed after creation</p>
                            )}
                        </div>

                        {/* Brokerage bands and per-share charges are how PSX bills. They
                            describe no other market, so a non-PKR book is not asked. */}
                        {isPSX ? (
                            <>
                                <CommissionSlabEditor
                                    slabs={formData.commissionSlabs}
                                    onChange={(commissionSlabs) => setFormData({ ...formData, commissionSlabs })}
                                />

                                <OtherChargesEditor
                                    charges={formData.charges}
                                    onChange={(charges) => setFormData({ ...formData, charges })}
                                />
                            </>
                        ) : (
                            <p className="text-xs text-ink-muted">
                                Fees come from each transaction as entered.
                            </p>
                        )}

                    </div>

                    <div className="flex gap-3 px-6 py-4 border-t border-hairline shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50 transition-colors shadow-card"
                        >
                            {submitting ? 'Saving...' : portfolio ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
