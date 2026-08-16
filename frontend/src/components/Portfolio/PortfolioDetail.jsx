import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Download, RefreshCw, Upload, FileText, X } from 'lucide-react';
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

                    <Summary dashboard={dashboard} currency={portfolio.currency} />

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
                            charges={portfolio.charges}
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


/**
 * The account as a statement rather than a scoreboard: what it is worth, what
 * it has made, what that cost. Grouped so each heading is the sum of the rows
 * under it, which is the question that kept getting lost among equal-weight
 * cards - and it reads the same on a phone as on a desktop.
 */
function Summary({ dashboard, currency }) {
    const {
        totalValue = 0, totalCost = 0, cashBalance = 0, cashTracked,
        unrealizedPnL = 0, realizedPnL = 0, totalDividends = 0,
        totalPnL = 0, totalPnLPct = 0, totalFees = 0,
        capitalGainsTax = 0, netRealizedPnL = 0, taxRatePct = 15
    } = dashboard;

    const money = (v, opts) => formatCurrency(v, currency, opts);
    const accountValue = totalValue + (cashTracked ? cashBalance : 0);
    const bite = totalFees > 0 && realizedPnL > 0 ? (totalFees / realizedPnL) * 100 : null;
    const gain = totalPnL >= 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                        grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x
                        divide-gray-200 dark:divide-gray-700">
            <Section title="Account value" value={money(accountValue)}>
                <Line label="Holdings" value={money(totalValue)} />
                {cashTracked && <Line label="Cash" value={money(cashBalance)} />}
                <Line label="Cost of holdings" value={money(totalCost)} muted />
            </Section>

            <Section
                title="Total P/L"
                value={money(totalPnL, { signed: true })}
                note={formatPercent(totalPnLPct)}
                tone={gain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
            >
                <Line label="Unrealised on holdings" value={money(unrealizedPnL, { signed: true })} />
                <Line label="Realised from sales" value={money(realizedPnL, { signed: true })} />
                <Line label="Dividends received" value={money(totalDividends)} />
            </Section>

            <Section title="What it cost" value={money(totalFees + capitalGainsTax)}
                tone="text-amber-600 dark:text-amber-400">
                <Line label="Commission" value={money(totalFees)}
                    note={bite !== null ? `${bite.toFixed(0)}% of realised gains` : null} />
                <Line label={`Capital gains tax ${taxRatePct}%`} value={money(capitalGainsTax)} />
                <Line label="In hand from sales" value={money(netRealizedPnL, { signed: true })} strong />
            </Section>
        </div>
    );
}

function Section({ title, value, note, tone = 'text-gray-900 dark:text-white', children }) {
    return (
        <div className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</span>
                {note && <span className={`text-xs ${tone}`}>{note}</span>}
            </div>
            <div className={`text-2xl font-bold mt-0.5 ${tone}`}>{value}</div>
            <div className="mt-3 space-y-1.5">{children}</div>
        </div>
    );
}

function Line({ label, value, note, muted, strong }) {
    return (
        <div className={`flex items-baseline justify-between gap-3 text-sm
                        ${strong ? 'pt-1.5 border-t border-gray-200 dark:border-gray-700' : ''}`}>
            <span className={muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}>
                {label}
                {note && <span className="block text-xs text-gray-400 dark:text-gray-500">{note}</span>}
            </span>
            <span className={`shrink-0 tabular-nums ${strong ? 'font-semibold' : ''}
                            ${muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                {value}
            </span>
        </div>
    );
}
