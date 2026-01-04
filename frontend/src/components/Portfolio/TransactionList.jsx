import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Filter, Download } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function TransactionList({ portfolioId, currency }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('ALL');

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

    const filteredTransactions = transactions.filter(tx =>
        typeFilter === 'ALL' || tx.type === typeFilter
    );

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">No transactions yet.</p>
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
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                    <TransactionRow key={tx._id} transaction={tx} currency={currency} />
                ))}
            </div>

            {filteredTransactions.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                    No transactions found for selected filter.
                </div>
            )}
        </div>
    );
}

function TransactionRow({ transaction, currency }) {
    const typeColors = {
        BUY: 'bg-blue-50 text-blue-700',
        SELL: 'bg-orange-50 text-orange-700',
        DIV: 'bg-emerald-50 text-emerald-700',
        DEPOSIT: 'bg-purple-50 text-purple-700',
        WITHDRAW: 'bg-red-50 text-red-700'
    };

    const typeIcons = {
        BUY: <TrendingUp className="w-4 h-4" />,
        SELL: <TrendingDown className="w-4 h-4" />,
        DIV: <TrendingUp className="w-4 h-4" />,
        DEPOSIT: <TrendingUp className="w-4 h-4" />,
        WITHDRAW: <TrendingDown className="w-4 h-4" />
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${typeColors[transaction.type]}`}>
                        {typeIcons[transaction.type]}
                        {transaction.type}
                    </div>

                    <div>
                        <div className="font-semibold text-gray-900">{transaction.symbol}</div>
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(transaction.executedAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    {(['BUY', 'SELL'].includes(transaction.type)) && (
                        <>
                            <div className="text-sm text-gray-600">
                                {transaction.quantity} shares @ {currency === 'USD' ? '$' : 'Rs.'} {transaction.price.toFixed(2)}
                            </div>
                            <div className="font-semibold text-gray-900">
                                {currency === 'USD' ? '$' : 'Rs.'} {(transaction.quantity * transaction.price).toLocaleString()}
                            </div>
                            {transaction.fees > 0 && (
                                <div className="text-xs text-gray-500">
                                    Fees: {currency === 'USD' ? '$' : 'Rs.'} {transaction.fees}
                                </div>
                            )}
                        </>
                    )}

                    {transaction.type === 'DIV' && (
                        <div className="font-semibold text-emerald-600">
                            +{currency === 'USD' ? '$' : 'Rs.'} {transaction.amount.toLocaleString()}
                        </div>
                    )}

                    {(['DEPOSIT', 'WITHDRAW'].includes(transaction.type)) && (
                        <div className={`font-semibold ${transaction.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {transaction.type === 'DEPOSIT' ? '+' : '-'}{currency === 'USD' ? '$' : 'Rs.'} {transaction.amount.toLocaleString()}
                        </div>
                    )}
                </div>
            </div>

            {transaction.notes && (
                <div className="mt-2 text-sm text-gray-600 border-t border-gray-100 pt-2">
                    {transaction.notes}
                </div>
            )}
        </div>
    );
}
