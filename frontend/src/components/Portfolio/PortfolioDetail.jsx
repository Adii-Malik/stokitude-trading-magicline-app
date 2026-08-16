import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, TrendingUp, TrendingDown, DollarSign,
    PieChart, Plus, Download, RefreshCw, Target, Upload, FileText, Wallet, X
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatPercent } from '../../utils/portfolioUtils';
import HoldingsTable from './HoldingsTable';
import PerformanceChart from './PerformanceChart';
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
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    const [uploading, setUploading] = useState(false);
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

    const handleExport = async () => {
        try {
            const res = await api.get(`/portfolios/${id}/transactions/export`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${portfolio.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-transactions.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to export transactions');
        }
    };

    const handleRebuild = async () => {
        try {
            const res = await api.post(`/portfolios/${id}/rebuild`);
            toast.success(res.data.message || 'Positions rebuilt');
            loadPortfolio();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Rebuild failed');
        }
    };

    const handleFileUpload = async (e) => {
        e.preventDefault();

        if (!uploadFile) {
            toast.error('Please select a CSV file');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);

            const response = await api.post(`/portfolios/${id}/transactions/upload/csv`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 180000  // a long file outlasts the default
            });

            const result = response.data.data;
            setUploadResult(result);

            // Say what actually happened; "uploaded 0" reads like success.
            const parts = [`${result.inserted} imported`];
            if (result.skipped) parts.push(`${result.skipped} already present`);
            if (result.errors?.length) parts.push(`${result.errors.length} failed`);
            const message = parts.join(', ');
            if (result.errors?.length) toast.error(message); else toast.success(message);

            setUploadFile(null);
            loadPortfolio();
        } catch (error) {
            console.error('Error uploading CSV:', error);
            toast.error(error.response?.data?.message || 'Failed to upload CSV');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!portfolio || !dashboard) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <p className="text-gray-600 dark:text-gray-400">Portfolio not found</p>
            </div>
        );
    }

    const { totalValue, totalCost, totalPnL, totalPnLPct, realizedPnL, unrealizedPnL, cashBalance, cashTracked,
        taxRatePct, capitalGainsTax, netRealizedPnL, totalDividends } = dashboard;
    const isProfit = (totalPnL || 0) >= 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-6">
                    {/* Header */}
                    {/* Stacked on phones: a title and four buttons cannot share
                        one row at 390px without colliding. */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/portfolios')}
                                className="p-2 shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">{portfolio.name}</h1>
                                {portfolio.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">{portfolio.description}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button
                                onClick={handleRebuild}
                                title="Recalculate positions from the transaction ledger"
                                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium px-4 py-2 rounded-lg transition-colors"
                            >
                                <RefreshCw className="w-5 h-5" />
                                <span className="hidden sm:inline">Rebuild</span>
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium px-4 py-2 rounded-lg transition-colors"
                            >
                                <Download className="w-5 h-5" />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium px-4 py-2 rounded-lg transition-colors"
                            >
                                <Upload className="w-5 h-5" />
                                <span className="hidden sm:inline">Import CSV</span>
                            </button>
                            <button
                                onClick={() => setShowAddTransaction(true)}
                                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-lg"
                            >
                                <Plus className="w-5 h-5" />
                                Add Transaction
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    {/* Cash first, then what you hold, then the totals it rolls
                        up into - so Total P/L reads as the conclusion. */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
                        {cashTracked && (
                            <StatCard
                                title="Cash Balance"
                                value={formatCurrency(cashBalance, portfolio.currency)}
                                subtitle={cashBalance < 0 ? 'Overdrawn - check deposits' : 'Available to invest'}
                                icon={Wallet}
                                iconColor={cashBalance < 0 ? 'text-red-600' : 'text-emerald-600'}
                                iconBg={cashBalance < 0 ? 'bg-red-50' : 'bg-emerald-50'}
                            />
                        )}
                        <StatCard
                            title="Total Value"
                            value={formatCurrency(totalValue, portfolio.currency)}
                            icon={DollarSign}
                            iconColor="text-blue-600"
                            iconBg="bg-blue-50"
                        />
                        <StatCard
                            title="Total Cost"
                            value={formatCurrency(totalCost, portfolio.currency)}
                            icon={PieChart}
                            iconColor="text-purple-600"
                            iconBg="bg-purple-50"
                        />
                        <StatCard
                            title="Realized P/L"
                            value={formatCurrency(realizedPnL, portfolio.currency, { signed: true })}
                            subtitle={`Stocks sold. Unrealized: ${formatCurrency(unrealizedPnL, portfolio.currency)}`}
                            icon={Target}
                            iconColor={(realizedPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}
                            iconBg={(realizedPnL || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}
                        />
                        <StatCard
                            title="Total P/L"
                            value={formatCurrency(totalPnL, portfolio.currency, { signed: true })}
                            subtitle={`${formatPercent(totalPnLPct)} · incl. dividends`}
                            icon={isProfit ? TrendingUp : TrendingDown}
                            iconColor={isProfit ? 'text-green-600' : 'text-red-600'}
                            iconBg={isProfit ? 'bg-green-50' : 'bg-red-50'}
                            valueColor={isProfit ? 'text-green-600' : 'text-red-600'}
                        />
                    </div>

                    <TakeHome
                        realized={realizedPnL}
                        tax={capitalGainsTax}
                        net={netRealizedPnL}
                        ratePct={taxRatePct}
                        dividends={totalDividends}
                        currency={portfolio.currency}
                    />

                    <PerformanceChart portfolioId={id} currency={portfolio.currency} />

                    {/* Tabs */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div className="border-b border-gray-200 dark:border-gray-700">
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
                                <TransactionList
                                    portfolioId={id}
                                    currency={portfolio.currency}
                                    onTransactionChange={loadPortfolio}
                                />
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
                            commissionSlabs={portfolio.commissionSlabs}
                            onClose={() => setShowAddTransaction(false)}
                            onAdded={() => {
                                setShowAddTransaction(false);
                                loadPortfolio();
                            }}
                        />
                    )}

                    {/* Upload CSV Modal */}
                    {showUploadModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
                                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Transactions CSV</h2>
                                    <button
                                        onClick={() => {
                                            setShowUploadModal(false);
                                            setUploadResult(null);
                                            setUploadFile(null);
                                        }}
                                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleFileUpload} className="p-6 space-y-4">
                                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                                        <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => setUploadFile(e.target.files[0])}
                                            className="hidden"
                                            id="csv-upload-transactions"
                                        />
                                        <label
                                            htmlFor="csv-upload-transactions"
                                            className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer transition"
                                        >
                                            {uploadFile ? uploadFile.name : 'Choose CSV File'}
                                        </label>
                                    </div>

                                    <div className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-lg p-4">
                                        <h4 className="font-semibold text-cyan-900 dark:text-cyan-400 mb-2">Expected Format:</h4>
                                        <code className="text-sm text-cyan-800 dark:text-cyan-300 block mb-2">
                                            Type,Symbol,Quantity,Price,Fees,Amount,Date,Notes
                                        </code>
                                        <p className="text-xs text-cyan-700 dark:text-cyan-400">
                                            • <strong>Type</strong>: BUY, SELL, DIV, DEPOSIT, WITHDRAW<br />
                                            • <strong>BUY/SELL</strong>: Requires Symbol, Quantity, Price (Fees optional)<br />
                                            • <strong>DIV</strong>: Requires Symbol, Amount<br />
                                            • <strong>DEPOSIT/WITHDRAW</strong>: Requires Amount<br />
                                            • <strong>Date</strong>: YYYY-MM-DD format (required for all)
                                        </p>
                                    </div>

                                    {uploadResult && (
                                        <div className="bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Upload Result:</h4>
                                            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                                <p>Rows read: {uploadResult.total}</p>
                                                <p className="text-green-700 dark:text-green-400">Imported: {uploadResult.inserted}</p>
                                                {uploadResult.skipped > 0 && (
                                                    <p>Already present: {uploadResult.skipped}</p>
                                                )}
                                                {uploadResult.errors?.length > 0 && (
                                                    <>
                                                        <p className="text-red-600 dark:text-red-400">Failed: {uploadResult.errors.length}</p>
                                                        {/* The reason matters more than the count. */}
                                                        <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-red-600 dark:text-red-400 space-y-0.5">
                                                            {uploadResult.errors.slice(0, 10).map((e, i) => (
                                                                <li key={i}>{e.data?.symbol || e.data?.type || `row ${e.line}`}: {e.error}</li>
                                                            ))}
                                                        </ul>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-4">
                                        <button
                                            type="submit"
                                            disabled={!uploadFile || uploading}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                        >
                                            {uploading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                            {uploading ? 'Importing…' : 'Upload CSV'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={uploading}
                                            onClick={() => {
                                                setShowUploadModal(false);
                                                setUploadResult(null);
                                                setUploadFile(null);
                                            }}
                                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * What actually reaches you: realised gains less capital gains tax. Dividends
 * sit apart because PSX withholds on them at source, so the recorded amount is
 * already net - taxing it again here would double-count.
 */
function TakeHome({ realized, tax, net, ratePct, dividends, currency }) {
    if (!realized && !dividends) return null;
    const money = (v, opts) => formatCurrency(v, currency, opts);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Realised</span>
            <span className="font-semibold text-gray-900 dark:text-white">{money(realized, { signed: true })}</span>

            {tax > 0 && (
                <>
                    <span className="text-gray-400">−</span>
                    <span className="text-gray-600 dark:text-gray-400">CGT {ratePct}%</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">{money(tax)}</span>
                </>
            )}

            <span className="text-gray-400">=</span>
            <span className={`font-bold ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {money(net, { signed: true })}
            </span>
            <span className="text-gray-500 dark:text-gray-400">in hand</span>

            {dividends > 0 && (
                <span className="text-gray-500 dark:text-gray-400 ml-auto">
                    plus {money(dividends)} dividends
                    <span className="text-xs"> (taxed at source)</span>
                </span>
            )}
        </div>
    );
}

function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, valueColor }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            {/* Icon sits beside the label on phones; stacking it wastes a third
                of the card's height for decoration. */}
            <div className="flex items-center gap-2 mb-1 sm:mb-4 sm:block">
                <div className={`p-1.5 sm:p-3 rounded-lg shrink-0 sm:inline-block ${iconBg}`}>
                    <Icon className={`w-4 h-4 sm:w-6 sm:h-6 ${iconColor}`} />
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 sm:mt-4 sm:mb-1 truncate">{title}</div>
            </div>
            <div className={`text-lg sm:text-2xl font-bold truncate ${valueColor || 'text-gray-900 dark:text-white'}`}>
                {value}
            </div>
            {subtitle && (
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">{subtitle}</div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${active
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
        >
            {label}
        </button>
    );
}
