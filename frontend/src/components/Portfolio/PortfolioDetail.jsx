import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, TrendingUp, TrendingDown, DollarSign,
    PieChart, Plus, Download, Settings, Target
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import HoldingsTable from './HoldingsTable';
import TransactionList from './TransactionList';
import AddTransactionModal from './AddTransactionModal';
import AllocationView from './AllocationView';

export default function PortfolioDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [portfolio, setPortfolio] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [activeTab, setActiveTab] = useState('holdings');
    const [showAddTransaction, setShowAddTransaction] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPortfolio();
    }, [id]);

    const loadPortfolio = async () => {
        try {
            const [portfolioRes, dashboardRes] = await Promise.all([
                api.get(`/portfolios/${id}`),
                api.get(`/portfolios/${id}/dashboard`)
            ]);

            setPortfolio(portfolioRes.data.data);
            setDashboard(dashboardRes.data.data);
        } catch (error) {
            console.error('Error loading portfolio:', error);
            toast.error(error.response?.data?.message || 'Failed to load portfolio');
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

    if (!portfolio || !dashboard) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">Portfolio not found</p>
            </div>
        );
    }

    const { totalValue, totalCost, totalPnL, totalPnLPct, realizedPnL, unrealizedPnL } = dashboard;
    const isProfit = (totalPnL || 0) >= 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/portfolios')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{portfolio.name}</h1>
                        {portfolio.description && (
                            <p className="text-gray-600 mt-1">{portfolio.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAddTransaction(true)}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
                    >
                        <Plus className="w-5 h-5" />
                        Add Transaction
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Value"
                    value={`${portfolio.currency === 'USD' ? '$' : 'Rs.'} ${(totalValue || 0).toLocaleString()}`}
                    icon={DollarSign}
                    iconColor="text-blue-600"
                    iconBg="bg-blue-50"
                />
                <StatCard
                    title="Total Cost"
                    value={`${portfolio.currency === 'USD' ? '$' : 'Rs.'} ${(totalCost || 0).toLocaleString()}`}
                    icon={PieChart}
                    iconColor="text-purple-600"
                    iconBg="bg-purple-50"
                />
                <StatCard
                    title="Total P/L"
                    value={`${isProfit ? '+' : ''}${portfolio.currency === 'USD' ? '$' : 'Rs.'} ${(totalPnL || 0).toLocaleString()}`}
                    subtitle={`${(totalPnLPct || 0).toFixed(2)}%`}
                    icon={isProfit ? TrendingUp : TrendingDown}
                    iconColor={isProfit ? 'text-emerald-600' : 'text-red-600'}
                    iconBg={isProfit ? 'bg-emerald-50' : 'bg-red-50'}
                    valueColor={isProfit ? 'text-emerald-600' : 'text-red-600'}
                />
                <StatCard
                    title="Realized P/L"
                    value={`${(realizedPnL || 0) >= 0 ? '+' : ''}${portfolio.currency === 'USD' ? '$' : 'Rs.'} ${(realizedPnL || 0).toLocaleString()}`}
                    subtitle={`Unrealized: ${(unrealizedPnL || 0).toLocaleString()}`}
                    icon={Target}
                    iconColor={(realizedPnL || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}
                    iconBg={(realizedPnL || 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
                />
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6">
                        <TabButton
                            active={activeTab === 'holdings'}
                            onClick={() => setActiveTab('holdings')}
                            label="Holdings"
                        />
                        <TabButton
                            active={activeTab === 'transactions'}
                            onClick={() => setActiveTab('transactions')}
                            label="Transactions"
                        />
                        <TabButton
                            active={activeTab === 'allocation'}
                            onClick={() => setActiveTab('allocation')}
                            label="SIP Allocation"
                        />
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'holdings' && (
                        <HoldingsTable portfolioId={id} currency={portfolio.currency} />
                    )}
                    {activeTab === 'transactions' && (
                        <TransactionList portfolioId={id} currency={portfolio.currency} />
                    )}
                    {activeTab === 'allocation' && (
                        <AllocationView portfolioId={id} currency={portfolio.currency} />
                    )}
                </div>
            </div>

            {showAddTransaction && (
                <AddTransactionModal
                    portfolioId={id}
                    currency={portfolio.currency}
                    onClose={() => setShowAddTransaction(false)}
                    onAdded={() => {
                        setShowAddTransaction(false);
                        loadPortfolio();
                    }}
                />
            )}
        </div>
    );
}

function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, valueColor }) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${iconBg}`}>
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">{title}</div>
            <div className={`text-2xl font-bold ${valueColor || 'text-gray-900'}`}>
                {value}
            </div>
            {subtitle && (
                <div className="text-sm text-gray-600 mt-1">{subtitle}</div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${active
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
        >
            {label}
        </button>
    );
}
