import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Filter, Download, Edit2, Trash2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import EditTransactionModal from './EditTransactionModal';

export default function TransactionList({ portfolioId, currency, onTransactionChange }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [editingTransaction, setEditingTransaction] = useState(null);

    useEffect(() => {
        loadTransactions();
    }, [portfolioId]);

    const loadTransactions = async () => {
        try {
            const response = await api.get(`/portfolios/${portfolioId}/transactions`);
            setTransactions(response.data.data);
        } catch (error) {
            toast.error('Failed to load transactions');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (transactionId) => {
        if (!confirm('Are you sure you want to delete this transaction? This will recalculate your holdings.')) {
            return;
        }

        try {
            await api.delete(`/portfolios/${portfolioId}/transactions/${transactionId}`);
            toast.success('Transaction deleted');
            loadTransactions();
            if (onTransactionChange) onTransactionChange();
        } catch (error) {
            console.error('Error deleting transaction:', error);
            toast.error(error.response?.data?.message || 'Failed to delete transaction');
        }
    };

    const handleEdit = (transaction) => {
        setEditingTransaction(transaction);
    };

    const filteredTransactions = transactions.filter(tx =>
        typeFilter === 'ALL' || tx.type === typeFilter
    );

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">No transactions yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                        <option value="ALL">All Types</option>
                        <option value="BUY">Buy</option>
                        <option value="SELL">Sell</option>
                        <option value="DIV">Dividend</option>
                        <option value="DEPOSIT">Deposit</option>
                        <option value="WITHDRAW">Withdraw</option>
                    </select>
                </div>
            </div>

            {/* Transaction List */}
            <div className="space-y-2">
                {filteredTransactions.map((tx) => (
                    <TransactionRow
                        key={tx._id}
                        transaction={tx}
                        currency={currency}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                    />
                ))}
            </div>

            {filteredTransactions.length === 0 && (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                    No transactions found for selected filter.
                </div>
            )}

            {editingTransaction && (
                <EditTransactionModal
                    portfolioId={portfolioId}
                    transaction={editingTransaction}
                    currency={currency}
                    onClose={() => setEditingTransaction(null)}
                    onUpdated={() => {
                        loadTransactions();
                        setEditingTransaction(null);
                        if (onTransactionChange) onTransactionChange();
                    }}
                />
            )}
        </div>
    );
}

function TransactionRow({ transaction, currency, onDelete, onEdit }) {
    const typeColors = {
        BUY: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        SELL: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        DIV: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        DEPOSIT: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        WITHDRAW: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };

    const typeIcons = {
        BUY: <TrendingUp className="w-4 h-4" />,
        SELL: <TrendingDown className="w-4 h-4" />,
        DIV: <TrendingUp className="w-4 h-4" />,
        DEPOSIT: <TrendingUp className="w-4 h-4" />,
        WITHDRAW: <TrendingDown className="w-4 h-4" />
    };

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md dark:hover:shadow-lg transition-all group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${typeColors[transaction.type]}`}>
                        {typeIcons[transaction.type]}
                        {transaction.type}
                    </div>

                    <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{transaction.symbol}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(transaction.executedAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        {(['BUY', 'SELL'].includes(transaction.type)) && (
                            <>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {transaction.quantity} shares @ {currency === 'USD' ? '$' : 'Rs.'} {transaction.price.toFixed(2)}
                                </div>
                                <div className="font-semibold text-gray-900 dark:text-white">
                                    {currency === 'USD' ? '$' : 'Rs.'} {(transaction.quantity * transaction.price).toLocaleString()}
                                </div>
                                {transaction.fees > 0 && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Fees: {currency === 'USD' ? '$' : 'Rs.'} {transaction.fees}
                                    </div>
                                )}
                            </>
                        )}

                        {transaction.type === 'DIV' && (
                            <div className="font-semibold text-green-600 dark:text-green-400">
                                +{currency === 'USD' ? '$' : 'Rs.'} {transaction.dividendCash?.toLocaleString() || '0'}
                            </div>
                        )}

                        {(['DEPOSIT', 'WITHDRAW'].includes(transaction.type)) && (
                            <div className={`font-semibold ${transaction.type === 'DEPOSIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {transaction.type === 'DEPOSIT' ? '+' : '-'}{currency === 'USD' ? '$' : 'Rs.'} {transaction.amount?.toLocaleString() || '0'}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => onEdit(transaction)}
                            className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
                            title="Edit transaction"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onDelete(transaction._id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete transaction"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {transaction.notes && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
                    {transaction.notes}
                </div>
            )}
        </div>
    );
}
